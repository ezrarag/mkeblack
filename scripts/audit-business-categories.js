#!/usr/bin/env node
/**
 * Audit category labels used by businesses against business_categories.
 * Read-only by default. Pass --fix to create missing category records.
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

function createCategoryId(label) {
  return label.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeCategory(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length) return String(parsed[0]).trim();
  } catch {}
  return trimmed.replace(/^\[/, "").replace(/\]$/, "").split(",")[0].replace(/^"+|"+$/g, "").trim();
}

async function main() {
  const fix = process.argv.includes("--fix");
  const env = loadEnv();
  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);
  if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  const db = getFirestore();
  const [businessSnapshot, categorySnapshot] = await Promise.all([
    db.collection("businesses").get(),
    db.collection("business_categories").get()
  ]);
  const usage = new Map();
  for (const doc of businessSnapshot.docs) {
    const value = doc.get("category");
    const label = typeof value === "string" ? normalizeCategory(value) : "";
    if (label) usage.set(label, (usage.get(label) || 0) + 1);
  }
  const recordsByLabel = new Map(categorySnapshot.docs.map((doc) => [String(doc.get("label") || doc.id).trim(), doc]));
  const orphaned = [...usage].filter(([label]) => !recordsByLabel.has(label)).sort(([a], [b]) => a.localeCompare(b));

  console.log(`Businesses: ${businessSnapshot.size}`);
  console.log(`Category records: ${categorySnapshot.size}`);
  console.log(`Distinct category labels in use: ${usage.size}`);
  console.log(`Orphaned labels: ${orphaned.length}`);
  for (const [label, count] of orphaned) console.log(`  - ${label} (${count})`);

  if (fix && orphaned.length) {
    const batch = db.batch();
    for (const [label, count] of orphaned) {
      const id = createCategoryId(label);
      batch.set(db.collection("business_categories").doc(id), {
        id, label, slug: id, active: true, usageCount: count, createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
    console.log(`Created ${orphaned.length} active category record(s).`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
