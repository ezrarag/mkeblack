import type { User } from "firebase/auth";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";

export type LoginIntent =
  | "email_password_signin"
  | "email_password_signup"
  | "google_popup"
  | "claim_invite_password"
  | "password_reset";

export function getProviderIds(user: User) {
  return Array.from(
    new Set(user.providerData.map((provider) => provider.providerId).filter(Boolean))
  );
}

export function getReadableLoginMethod(providerId: string) {
  if (providerId === "password") return "Email/password";
  if (providerId === "google.com") return "Google";
  if (!providerId) return "Unknown";
  return providerId;
}

export async function recordAuthTracking(params: {
  user: User;
  intent: LoginIntent;
  providerId?: string;
}) {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    return;
  }

  const providerIds = getProviderIds(params.user);
  const providerId = params.providerId || providerIds[0] || "password";
  await firestoreModule.setDoc(
    firestoreModule.doc(db, "users", params.user.uid),
    {
      uid: params.user.uid,
      email: params.user.email ?? "",
      emailLower: (params.user.email ?? "").trim().toLowerCase(),
      displayName: params.user.displayName ?? null,
      authProviderIds: providerIds.length ? providerIds : [providerId],
      lastAuthProviderId: providerId,
      lastLoginMethod: getReadableLoginMethod(providerId),
      lastLoginIntent: params.intent,
      lastLoginAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export async function recordPasswordResetRequest(email: string) {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const usersRef = firestoreModule.collection(db, "users");
  const snapshots = await Promise.all([
    firestoreModule.getDocs(
      firestoreModule.query(
        usersRef,
        firestoreModule.where("emailLower", "==", normalizedEmail),
        firestoreModule.limit(1)
      )
    ),
    firestoreModule.getDocs(
      firestoreModule.query(
        usersRef,
        firestoreModule.where("email", "==", normalizedEmail),
        firestoreModule.limit(1)
      )
    ),
    firestoreModule.getDocs(
      firestoreModule.query(
        usersRef,
        firestoreModule.where("email", "==", email.trim()),
        firestoreModule.limit(1)
      )
    )
  ]);
  const doc = snapshots.flatMap((snapshot) => snapshot.docs)[0];

  if (!doc) {
    return;
  }

  await firestoreModule.setDoc(
    doc.ref,
    {
      lastLoginIntent: "password_reset",
      lastRequestedLoginMethod: "Password reset",
      passwordResetRequestedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}
