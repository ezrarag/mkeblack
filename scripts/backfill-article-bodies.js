#!/usr/bin/env node
/**
 * Backfill native article body content into Firestore.
 *
 * Usage:
 *   node scripts/backfill-article-bodies.js ./article-bodies.json
 *
 * JSON shape:
 * [
 *   {
 *     "slug": "example-article",
 *     "body": "# Heading\n\nArticle body in markdown.",
 *     "excerpt": "Optional updated excerpt",
 *     "href": "Optional original/source URL"
 *   }
 * ]
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/backfill-article-bodies.js ./article-bodies.json");
  process.exit(1);
}

const resolvedInputPath = path.resolve(process.cwd(), inputPath);

if (!fs.existsSync(resolvedInputPath)) {
  console.error(`Input file not found: ${resolvedInputPath}`);
  process.exit(1);
}

const env = loadEnv();
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function main() {
  const raw = fs.readFileSync(resolvedInputPath, "utf-8");
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) {
    throw new Error("Input JSON must be an array.");
  }

  let updatedCount = 0;

  for (const item of items) {
    const slug = typeof item?.slug === "string" ? item.slug.trim() : "";
    const body = typeof item?.body === "string" ? item.body.trim() : "";

    if (!slug || !body) {
      console.warn(`Skipping row with missing slug/body: ${JSON.stringify(item)}`);
      continue;
    }

    const snapshot = await db
      .collection("articles")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`No article found for slug: ${slug}`);
      continue;
    }

    const articleDoc = snapshot.docs[0];
    const payload = {
      body,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (typeof item.excerpt === "string") {
      payload.excerpt = item.excerpt.trim();
    }

    if (typeof item.href === "string") {
      payload.href = item.href.trim();
    }

    await articleDoc.ref.set(payload, { merge: true });
    updatedCount += 1;
    console.log(`Updated article: ${slug}`);
  }

  console.log(`\nBackfilled ${updatedCount} article(s).`);
}

main().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exit(1);
});
