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
const fs = require("fs");
const path = require("path");

const uid = process.argv[2];
if (!uid) {
  console.error("❌ Usage: node scripts/set-admin.js <firebase-uid>");
  console.error("   Find your UID in Firebase Console → Authentication → Users");
  process.exit(1);
}

// Parse .env.local
const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const projectId = env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const clientEmail = env["NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL"];
const privateKey = env["NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

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
