import { getAuth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { normalizeCapabilities } from "@/lib/user-capabilities";

export async function requireAdminRequest(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token);
    const db = getFirebaseAdminDb();
    const profile = await db.collection("users").doc(decoded.uid).get();
    const data = profile.data();
    const isAdmin =
      decoded.admin === true ||
      data?.role === "admin" ||
      normalizeCapabilities(data?.capabilities).includes("admin");
    return isAdmin ? { decoded, db } : null;
  } catch {
    return null;
  }
}
