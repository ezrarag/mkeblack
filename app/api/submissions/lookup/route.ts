import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

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
        ownerEmail: normalizeEmail(data.ownerEmail),
        businessEmail: normalizeEmail(data.businessEmail),
        submitterUidAttached: Boolean(data.submitterUid),
        submittedAt: serializeDate(data.submittedAt),
        approvedBusinessId: data.approvedBusinessId ?? null
      };
    })
    .filter(
      (submission) =>
        submission.ownerEmail === email || submission.businessEmail === email
    )
    .sort(
      (left, right) =>
        new Date(right.submittedAt ?? 0).getTime() -
        new Date(left.submittedAt ?? 0).getTime()
    );

  return NextResponse.json({ submissions });
}
