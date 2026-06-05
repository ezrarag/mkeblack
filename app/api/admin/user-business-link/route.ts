import { NextRequest, NextResponse } from "next/server";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeCapabilities, removeCapability } from "@/lib/user-capabilities";

function getAdminApp() {
  if (getApps().length) return getApp();

  const privateKey = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: privateKey!
    })
  });
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function getNormalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getVerifiedAdmin(req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userSnapshot.data() ?? {};
    const hasAdminAccess =
      decodedToken.admin === true ||
      userData.role === "admin" ||
      normalizeCapabilities(userData.capabilities).includes("admin");

    return hasAdminAccess ? { db } : null;
  } catch {
    return null;
  }
}

export async function DELETE(req: NextRequest) {
  const context = await getVerifiedAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { uid?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestedUid = body.uid?.trim() ?? "";
  const requestedEmail = body.email ? getNormalizedEmail(body.email) : "";

  if (!requestedUid && !requestedEmail) {
    return NextResponse.json(
      { error: "uid or email is required" },
      { status: 400 }
    );
  }

  try {
    const { db } = context;
    let uid = requestedUid;
    let userSnapshot = uid ? await db.collection("users").doc(uid).get() : null;

    if (!uid && requestedEmail) {
      const matchingUsers = await db
        .collection("users")
        .where("email", "==", requestedEmail)
        .limit(1)
        .get();

      userSnapshot = matchingUsers.docs[0] ?? null;
      uid = userSnapshot?.id ?? "";
    }

    if (!uid || !userSnapshot?.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnapshot.data() ?? {};
    const linkedBusinessId =
      typeof userData.businessId === "string" ? userData.businessId.trim() : "";
    const nextCapabilities = removeCapability(userData.capabilities, "business");
    const hasAdminAccess =
      userData.role === "admin" || nextCapabilities.includes("admin");

    const ownerMatches = await db
      .collection("businesses")
      .where("ownerUid", "==", uid)
      .get();
    const batch = db.batch();

    if (linkedBusinessId) {
      batch.set(
        db.collection("businesses").doc(linkedBusinessId),
        {
          ownerUid: null,
          claimInviteStatus: "not_invited"
        },
        { merge: true }
      );
    }

    ownerMatches.docs.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          ownerUid: null,
          claimInviteStatus: "not_invited"
        },
        { merge: true }
      );
    });

    batch.set(
      db.collection("users").doc(uid),
      {
        businessId: null,
        capabilities: nextCapabilities,
        role: hasAdminAccess ? "admin" : "visitor"
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json({
      success: true,
      uid,
      clearedBusinessId: linkedBusinessId || null,
      clearedOwnerRecords: ownerMatches.size
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
