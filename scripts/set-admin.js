#!/usr/bin/env node
/**
 * MKE Black — Set Admin Role
 * Run: node scripts/set-admin.js <firebase-uid>
 *
 * Creates or updates the user doc in Firestore with role: 'admin'
 * Get your UID from Firebase Console → Authentication → Users
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const uid = process.argv[2];
if (!uid) {
  console.error("❌ Usage: node scripts/set-admin.js <firebase-uid>");
  console.error("   Find your UID in Firebase Console → Authentication → Users");
  process.exit(1);
}

const env = loadEnv();
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function setAdmin() {
  console.log(`\n🔐 Setting admin role for UID: ${uid}`);
  await db.collection("users").doc(uid).set(
    { uid, role: "admin", updatedAt: new Date().toISOString() },
    { merge: true }
  );
  console.log(`✅ Done — ${uid} is now an admin.`);
  console.log(`   Sign out and back in to the app for the role to take effect.\n`);
  process.exit(0);
}

setAdmin().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
