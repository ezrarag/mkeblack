#!/usr/bin/env node
/**
 * Fix the featured_articles homepage module to link to /news-articles
 * Run: node scripts/fix-articles-link.js
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const env = loadEnv();
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function fix() {
  console.log("\n🔧 Fixing featured_articles module CTA link...");

  await db.collection("homepage_modules").doc("featured_articles").set(
    {
      content: {
        description: "The latest from the MKE Black community.",
        ctaLabel: "View all articles",
        ctaHref: "/news-articles",
      }
    },
    { merge: true }
  );

  console.log("✅ Done — homepage articles CTA now links to /news-articles\n");
  process.exit(0);
}

fix().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
