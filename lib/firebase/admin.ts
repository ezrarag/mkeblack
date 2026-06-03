import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  return (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ??
    process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY ??
    ""
  ).replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApp();

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail:
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL ??
        process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: getPrivateKey()
    })
  });
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
