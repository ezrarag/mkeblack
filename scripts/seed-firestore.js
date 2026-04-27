#!/usr/bin/env node
/**
 * MKE Black — Firestore Seed Script
 * Run: node scripts/seed-firestore.js
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

// Parse .env.local manually
const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  env[key] = val;
}

const projectId = env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const clientEmail = env["NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL"];
const privateKey = env["NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing Firebase Admin credentials in .env.local");
  console.error("   Need: NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

// ── SEED DATA ─────────────────────────────────────────────────────────────────

const homepageModules = [
  {
    id: "hero",
    type: "hero",
    title: "Hero Banner",
    visible: true,
    order: 1,
    content: {
      headline: "Milwaukee's Black Business Community",
      subheadline: "MKE Black celebrates and promotes Black business, events, culture, and advancement in the greater Milwaukee area.",
      ctaPrimary: { label: "Search Business Directory", href: "/directory" },
      ctaSecondary: { label: "Submit Your Business", href: "/contact" },
    },
  },
  {
    id: "featured_articles",
    type: "featured_articles",
    title: "News & Articles",
    visible: true,
    order: 2,
    content: {
      description: "The latest from the MKE Black community.",
      ctaLabel: "View All Articles",
      ctaHref: "/news",
    },
  },
  {
    id: "membership_cta",
    type: "membership_cta",
    title: "Solidarity Circle Membership",
    visible: true,
    order: 3,
    content: {
      description: "Join our community and become a part of the movement that champions Black-owned businesses!",
      benefits: [
        "Discounts at Black-owned businesses",
        "Exclusive member-only events",
        "Free MKE Black T-Shirt",
      ],
      cta: { label: "Become a Member!", href: "/membership" },
    },
  },
  {
    id: "member_discounts",
    type: "member_discounts",
    title: "Member Discounts",
    visible: true,
    order: 4,
    content: {
      description: "Exclusive discounts for MKE Black Solidarity Circle members.",
      emptyState: "Member discounts coming soon.",
    },
  },
  {
    id: "editorial_food",
    type: "editorial",
    title: "In the Mood for Food?",
    visible: true,
    order: 5,
    content: {
      body: "With nearly 80 Black owned food and drink establishments, the Milwaukee area is no stranger to southern inspired cuisine. Morning favorites of scrambled eggs, bacon, and hash browns are a must try at Rise and Grind Cafe.\n\nIn the mood for soul? Head over to Daddy's Soul Food & Grille, one of the city's best southern style restaurants. For vegan diners, Twisted Plants is the area's go to place for delicious plant based burgers.",
      imageUrl: "",
    },
  },
  {
    id: "editorial_shop",
    type: "editorial",
    title: "Shop 'Til You Drop",
    visible: true,
    order: 6,
    content: {
      body: "With over 25 local brands in one space, The Bronzeville Collective offers something for everyone. Discover handcrafted jewelry, one of a kind apparel, bath products and more. Sherman Phoenix offers a variety of restaurants, shops, and services.",
      imageUrl: "",
    },
  },
  {
    id: "editorial_nightlife",
    type: "editorial",
    title: "Hitting The Bar",
    visible: true,
    order: 7,
    content: {
      body: "Milwaukee is known as \"Brew City\" for a reason, offering an exciting nightlife with ample places to drink, dance, and socialize. For an upscale experience, visit KISS Ultra Lounge. Jazz fans are in luck at Garfield's 502, described as one of the city's \"best kept secrets.\"",
      imageUrl: "",
    },
  },
  {
    id: "editorial_history",
    type: "editorial",
    title: "Dive Into Local History",
    visible: true,
    order: 8,
    content: {
      body: "Milwaukee is home to museums that dive into African American history. America's Black Holocaust Museum offers visitors a powerful look at the history and ongoing legacy of racism in America.",
      imageUrl: "",
    },
  },
];

const memberDiscounts = [
  { id: "discount_wallstreet", businessName: "Wall Street Stock Bar", logoUrl: "", discountText: "10% OFF", businessUrl: "https://wallstreetstockbar.com", active: true, order: 1 },
  { id: "discount_twistedplants", businessName: "Twisted Plants", logoUrl: "", discountText: "10% OFF", businessUrl: "https://www.twistedplants.com", active: true, order: 2 },
  { id: "discount_enhancedbydae", businessName: "Enhanced by Dae", logoUrl: "", discountText: "10% off all facial and body treatments + free add-on", businessUrl: "https://www.enhancedbydae.com", active: true, order: 3 },
  { id: "discount_rbj", businessName: "RBJ Community", logoUrl: "", discountText: "$50 off Nonprofit Startup Package & $250 off Professional Development Training", businessUrl: "https://www.rbjcommunity.com", active: true, order: 4 },
  { id: "discount_stylepopcafe", businessName: "Style Pop Cafe", logoUrl: "", discountText: "15% OFF", businessUrl: "https://stylepopcafe.com", active: true, order: 5 },
];

const benefitTypes = [
  { id: "benefit_tshirt", label: "MKE Black T-Shirt", description: "Free MKE Black t-shirt mailed to member", active: true, autoApply: true, createdAt: Timestamp.now() },
  { id: "benefit_events", label: "Member-Only Events", description: "Access to exclusive MKE Black events", active: true, autoApply: true, createdAt: Timestamp.now() },
  { id: "benefit_discounts", label: "Business Discounts", description: "Discounts at participating Black-owned businesses", active: true, autoApply: true, createdAt: Timestamp.now() },
];

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const businessTagSeeds = [
  { label: "Black-owned", category: "Identity", adminOnly: true },
  { label: "LGBTQ+ Affirming", category: "Identity", adminOnly: false },
  { label: "Woman-owned", category: "Identity", adminOnly: false },
  { label: "Veteran-owned", category: "Identity", adminOnly: false },
  { label: "Minority-owned", category: "Identity", adminOnly: false },
  { label: "Vegan Options", category: "Dietary", adminOnly: false },
  { label: "Vegetarian", category: "Dietary", adminOnly: false },
  { label: "Gluten-Free", category: "Dietary", adminOnly: false },
  { label: "Halal", category: "Dietary", adminOnly: false },
  { label: "Soul Food", category: "Dietary", adminOnly: false },
  { label: "Caribbean", category: "Dietary", adminOnly: false },
  { label: "Family-Friendly", category: "Vibe", adminOnly: false },
  { label: "Date Night", category: "Vibe", adminOnly: false },
  { label: "Live Music", category: "Vibe", adminOnly: false },
  { label: "Outdoor Seating", category: "Vibe", adminOnly: false },
  { label: "Late Night", category: "Vibe", adminOnly: false },
  { label: "Wheelchair Accessible", category: "Accessibility", adminOnly: false },
  { label: "ASL Friendly", category: "Accessibility", adminOnly: false },
  { label: "Delivery", category: "Service", adminOnly: false },
  { label: "Takeout", category: "Service", adminOnly: false },
  { label: "Catering", category: "Service", adminOnly: false },
  { label: "Appointment Only", category: "Service", adminOnly: false },
  { label: "Walk-ins Welcome", category: "Service", adminOnly: false },
].map((tag) => ({
  ...tag,
  id: slugify(tag.label),
  slug: slugify(tag.label),
  active: true,
}));

// ── RUNNER ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n🌱 Seeding Firestore — project: ${projectId}\n`);

  console.log("📄 homepage_modules...");
  for (const mod of homepageModules) {
    await db.collection("homepage_modules").doc(mod.id).set(mod, { merge: true });
    console.log(`   ✅ ${mod.id}`);
  }

  console.log("\n💳 member_discounts...");
  for (const d of memberDiscounts) {
    await db.collection("member_discounts").doc(d.id).set(d, { merge: true });
    console.log(`   ✅ ${d.businessName}`);
  }

  console.log("\n🎁 benefit_types...");
  for (const b of benefitTypes) {
    await db.collection("benefit_types").doc(b.id).set(b, { merge: true });
    console.log(`   ✅ ${b.label}`);
  }

  console.log("\n🏷️ business_tags...");
  for (const tag of businessTagSeeds) {
    const ref = db.collection("business_tags").doc(tag.id);
    const snapshot = await ref.get();
    const existing = snapshot.exists ? snapshot.data() : {};
    await ref.set(
      {
        ...tag,
        createdAt: existing.createdAt ?? Timestamp.now(),
        usageCount: existing.usageCount ?? 0,
      },
      { merge: true }
    );
    console.log(`   ✅ ${tag.label}`);
  }

  console.log("\n✅ Seed complete!\n");
  console.log("👉 Next: sign up in the app, then run:");
  console.log("   node scripts/set-admin.js <your-firebase-uid>\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
