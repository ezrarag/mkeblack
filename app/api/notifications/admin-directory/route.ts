import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { findPossibleDuplicates, normalizeBusinessRecord } from "@/lib/businesses";
import { normalizeCapabilities } from "@/lib/user-capabilities";

type EventKind = "submission" | "claim";

function bool(value: unknown) {
  return value === true;
}

async function sendSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from || !to) return false;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ To: to, From: from, Body: body })
    }
  );
  return response.ok;
}

export async function POST(req: NextRequest) {
  let body: { kind?: EventKind; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const kind = body.kind;
  const id = body.id?.trim() ?? "";
  if ((kind !== "submission" && kind !== "claim") || !id) {
    return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
  }

  const db = getFirebaseAdminDb();
  const sourceCollection = kind === "submission" ? "contactSubmissions" : "pending_claims";
  const source = await db.collection(sourceCollection).doc(id).get();
  if (!source.exists) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const data = source.data() ?? {};
  if (kind === "submission" && data.reason !== "submit_business") {
    return NextResponse.json({ error: "Not a directory submission." }, { status: 400 });
  }
  if (kind === "claim" && data.status !== "pending_verification") {
    return NextResponse.json({ delivered: 0, skipped: true });
  }

  let duplicate = false;
  if (kind === "submission") {
    const businessesSnapshot = await db.collection("businesses").get();
    duplicate = findPossibleDuplicates(
      businessesSnapshot.docs.map((document) =>
        normalizeBusinessRecord(document.data(), document.id)
      ),
      String(data.businessName ?? ""),
      String(data.address ?? "")
    ).length > 0;
  }

  const eventType = duplicate
    ? "admin_possible_duplicate"
    : kind === "submission"
      ? "admin_directory_submission"
      : "admin_claim_verification";
  const eventRef = db.collection("admin_notification_events").doc(`${kind}_${id}`);
  const claimed = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return false;
    transaction.create(eventRef, { kind, sourceId: id, eventType, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return NextResponse.json({ delivered: 0, duplicateEvent: true });

  const [roleAdmins, capabilityAdmins] = await Promise.all([
    db.collection("users").where("role", "==", "admin").get(),
    db.collection("users").where("capabilities", "array-contains", "admin").get()
  ]);
  const admins = new Map([...roleAdmins.docs, ...capabilityAdmins.docs].map((document) => [document.id, document]));
  const businessName = String(data.businessName ?? "Unnamed business");
  const text = duplicate
    ? `${businessName} may already be in the directory and needs duplicate review.`
    : kind === "submission"
      ? `${businessName} submitted a directory listing for approval.`
      : `${businessName} has a business claim awaiting verification.`;
  const href = "/admin/claims";
  const writes: Promise<unknown>[] = [];

  for (const [uid, admin] of admins) {
    const adminData = admin.data();
    if (
      adminData.role !== "admin" &&
      !normalizeCapabilities(adminData.capabilities).includes("admin")
    ) continue;
    const prefs = adminData.adminNotificationPrefs ?? {};
    const eventEnabled = duplicate
      ? bool(prefs.possibleDuplicates)
      : kind === "submission"
        ? bool(prefs.directorySubmissions)
        : bool(prefs.claimVerifications);
    if (!eventEnabled) continue;

    if (bool(prefs.inApp)) {
      writes.push(db.collection("users").doc(uid).collection("notifications").add({
        type: eventType,
        groupId: "admin",
        groupName: "Directory approvals",
        actorUid: "system",
        actorName: "MKE Black",
        targetId: id,
        text,
        href,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      }));
    }
    if (bool(prefs.email) && typeof adminData.email === "string" && adminData.email.trim()) {
      writes.push(db.collection("mail").add({
        to: [adminData.email.trim()],
        message: {
          subject: duplicate ? `Possible duplicate: ${businessName}` : `Directory approval needed: ${businessName}`,
          text: `${text}\n\nOpen the admin queue: ${new URL(href, req.nextUrl.origin).toString()}`,
          html: `<p>${text}</p><p><a href="${new URL(href, req.nextUrl.origin).toString()}">Open the admin queue</a></p>`
        },
        createdAt: FieldValue.serverTimestamp(),
        adminNotificationEventId: eventRef.id
      }));
    }
    if (bool(prefs.sms) && typeof prefs.phone === "string") {
      writes.push(sendSms(prefs.phone.trim(), `${text} ${new URL(href, req.nextUrl.origin).toString()}`));
    }
  }

  await Promise.allSettled(writes);
  return NextResponse.json({ delivered: writes.length, duplicate });
}
