/**
 * Shared env loader for MKE Black admin scripts.
 * Handles quoted values, escaped newlines, and multi-line private keys.
 *
 * The .env.local format from Vercel CLI wraps values in double quotes:
 *   NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
 *
 * This loader strips surrounding quotes and converts \n → real newlines.
 */

const fs = require("fs");
const path = require("path");

function loadEnv(envFilePath) {
  const envPath = envFilePath ?? path.join(__dirname, "../.env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1);

    // Strip surrounding double or single quotes added by Vercel CLI
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    // Convert escaped newlines to real newlines (private keys need this)
    val = val.replace(/\\n/g, "\n");

    env[key] = val;
  }

  return env;
}

function getFirebaseAdminConfig(env) {
  const projectId   = env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
  const clientEmail = env["NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL"];
  const privateKey  = env["NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY"];

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Missing Firebase Admin credentials:");
    if (!projectId)   console.error("   • NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    if (!clientEmail) console.error("   • NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL");
    if (!privateKey)  console.error("   • NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY");
    process.exit(1);
  }

  return { projectId, clientEmail, privateKey };
}

module.exports = { loadEnv, getFirebaseAdminConfig };
