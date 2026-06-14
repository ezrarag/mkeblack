import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { normalizeCapabilities } from "@/lib/user-capabilities";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

export async function GET(req: NextRequest) {
  const auth = getAuth(getFirebaseAdminApp());
  const db = getFirebaseAdminDb();
  const token = getBearerToken(req);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const userSnapshot = await db.collection("users").doc(decoded.uid).get();
    const userData = userSnapshot.data() ?? {};
    const hasAdminAccess =
      decoded.admin === true ||
      userData.role === "admin" ||
      normalizeCapabilities(userData.capabilities).includes("admin");

    if (!hasAdminAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await auth.listUsers(1000);
    return NextResponse.json({
      users: result.users.map((user) => ({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        disabled: user.disabled,
        createdAt: user.metadata.creationTime ?? null,
        lastSignInAt: user.metadata.lastSignInTime ?? null,
        providerIds: user.providerData.map((provider) => provider.providerId)
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load auth users." },
      { status: 500 }
    );
  }
}
