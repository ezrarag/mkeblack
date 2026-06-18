#!/usr/bin/env node
/**
 * Read-only Firestore audit for business map coordinates.
 * Run: npm run audit:business-locations
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const MILWAUKEE_CENTER = {
  lat: 43.0389,
  lng: -87.9065
};

function isFiniteLocation(location) {
  return (
    location &&
    typeof location.lat === "number" &&
    Number.isFinite(location.lat) &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lng)
  );
}

function isDefaultMapLocation(location) {
  return (
    isFiniteLocation(location) &&
    Math.abs(location.lat - MILWAUKEE_CENTER.lat) < 0.000001 &&
    Math.abs(location.lng - MILWAUKEE_CENTER.lng) < 0.000001
  );
}

function coordinateKey(location) {
  return `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
}

function labelBusiness(doc) {
  return `${doc.name || "(untitled)"} [${doc.id}]${doc.address ? ` - ${doc.address}` : ""}`;
}

function printSample(title, items, formatter = labelBusiness) {
  console.log(`\n${title}: ${items.length}`);

  for (const item of items.slice(0, 25)) {
    console.log(`  - ${formatter(item)}`);
  }

  if (items.length > 25) {
    console.log(`  ... ${items.length - 25} more`);
  }
}

async function main() {
  const env = loadEnv();
  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();
  const snapshot = await db.collection("businesses").get();
  const businesses = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
  const missingOrInvalid = [];
  const defaultCenter = [];
  const explicitlyUnverified = [];
  const inferredUnverified = [];
  const statusCounts = new Map();
  const coordinateGroups = new Map();

  for (const business of businesses) {
    const location = business.location;
    const status = business.geocodingStatus || "missing_status";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

    if (!isFiniteLocation(location)) {
      missingOrInvalid.push(business);
      continue;
    }

    if (isDefaultMapLocation(location)) {
      defaultCenter.push(business);
    }

    if (business.locationVerified === false) {
      explicitlyUnverified.push(business);
    }

    if (
      business.locationVerified === false ||
      (business.locationVerified !== true && isDefaultMapLocation(location))
    ) {
      inferredUnverified.push(business);
    }

    const key = coordinateKey(location);
    const group = coordinateGroups.get(key) || [];
    group.push(business);
    coordinateGroups.set(key, group);
  }

  const duplicateGroups = Array.from(coordinateGroups.entries())
    .filter(([, group]) => group.length > 1)
    .sort((left, right) => right[1].length - left[1].length);

  console.log("\nBusiness location audit");
  console.log("=======================");
  console.log(`Total businesses: ${businesses.length}`);
  console.log(`Mappable finite coordinates: ${businesses.length - missingOrInvalid.length}`);
  console.log(`Missing/invalid coordinates: ${missingOrInvalid.length}`);
  console.log(`Fallback Milwaukee-center coordinates: ${defaultCenter.length}`);
  console.log(`Explicitly unverified locations: ${explicitlyUnverified.length}`);
  console.log(`Map-hidden inferred unverified locations: ${inferredUnverified.length}`);
  console.log(`Duplicate coordinate groups: ${duplicateGroups.length}`);

  console.log("\nGeocoding status counts:");
  for (const [status, count] of Array.from(statusCounts.entries()).sort()) {
    console.log(`  - ${status}: ${count}`);
  }

  printSample("Fallback Milwaukee-center records", defaultCenter);
  printSample("Map-hidden inferred unverified records", inferredUnverified);

  console.log("\nLargest duplicate coordinate groups:");
  for (const [key, group] of duplicateGroups.slice(0, 12)) {
    console.log(`  - ${key}: ${group.length}`);
    for (const business of group.slice(0, 8)) {
      console.log(`      ${labelBusiness(business)}`);
    }
    if (group.length > 8) {
      console.log(`      ... ${group.length - 8} more`);
    }
  }
}

main().catch((error) => {
  console.error("Location audit failed:", error.message);
  process.exit(1);
});
