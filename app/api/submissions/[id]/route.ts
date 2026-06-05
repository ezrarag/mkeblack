import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/lib/firebase/admin";

type RouteContext = {
  params: {
    id: string;
  };
};

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
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

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const submissionId = params.id.trim();

  if (!submissionId) {
    return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });
  }

  const db = getFirebaseAdminDb();
  const snapshot = await db.collection("contactSubmissions").doc(submissionId).get();

  if (!snapshot.exists || snapshot.data()?.reason !== "submit_business") {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const data = snapshot.data() ?? {};

  return NextResponse.json({
    id: snapshot.id,
    status: data.status ?? "pending",
    businessName: data.businessName ?? "",
    ownerEmail: data.ownerEmail ?? "",
    businessEmail: data.businessEmail ?? "",
    submitterUidAttached: Boolean(data.submitterUid),
    submittedAt: serializeDate(data.submittedAt),
    approvedAt: serializeDate(data.approvedAt),
    approvedBusinessId: data.approvedBusinessId ?? null
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const submissionId = params.id.trim();
  const token = getBearerToken(req);

  if (!submissionId || !token) {
    return NextResponse.json({ error: "Submission ID and login are required." }, { status: 400 });
  }

  const auth = getAuth(getFirebaseAdminApp());
  const decodedToken = await auth.verifyIdToken(token);
  const db = getFirebaseAdminDb();
  const submissionReference = db.collection("contactSubmissions").doc(submissionId);
  const snapshot = await submissionReference.get();

  if (!snapshot.exists || snapshot.data()?.reason !== "submit_business") {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const data = snapshot.data() ?? {};

  if (data.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending submissions can be attached to Google." },
      { status: 409 }
    );
  }

  if (data.submitterUid && data.submitterUid !== decodedToken.uid) {
    return NextResponse.json(
      { error: "This submission is already attached to another Google account." },
      { status: 409 }
    );
  }

  await submissionReference.set(
    {
      submitterUid: decodedToken.uid,
      submitterDisplayName: decodedToken.name ?? null,
      submitterPhotoUrl: decodedToken.picture ?? null,
      ownerName: data.ownerName || decodedToken.name || "",
      ownerEmail: data.ownerEmail || decodedToken.email || ""
    },
    { merge: true }
  );

  return NextResponse.json({ attached: true });
}
