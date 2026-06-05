import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/lib/firebase/admin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function serializeDate(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date.toISOString() : null;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return NextResponse.json({ error: "Login is required." }, { status: 401 });
  }

  const decodedToken = await getAuth(getFirebaseAdminApp()).verifyIdToken(token);
  const email = normalizeEmail(decodedToken.email);
  const db = getFirebaseAdminDb();
  const snapshot = await db
    .collection("contactSubmissions")
    .where("reason", "==", "submit_business")
    .get();

  const submissions = snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        businessName: data.businessName ?? "",
        status: data.status ?? "pending",
        ownerName: data.ownerName ?? "",
        ownerEmail: normalizeEmail(data.ownerEmail),
        businessEmail: normalizeEmail(data.businessEmail),
        submitterUid: data.submitterUid ?? null,
        submitterUidAttached: Boolean(data.submitterUid),
        submittedAt: serializeDate(data.submittedAt),
        approvedBusinessId: data.approvedBusinessId ?? null,
        solidarityCheckoutStarted: Boolean(data.solidarityCheckoutStarted),
        solidarityMemberId: data.solidarityMemberId ?? null
      };
    })
    .filter(
      (submission) =>
        submission.submitterUid === decodedToken.uid ||
        (!!email &&
          (submission.ownerEmail === email || submission.businessEmail === email))
    )
    .sort(
      (left, right) =>
        new Date(right.submittedAt ?? 0).getTime() -
        new Date(left.submittedAt ?? 0).getTime()
    );

  return NextResponse.json({ submissions });
}
