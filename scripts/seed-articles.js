#!/usr/bin/env node
/**
 * MKE Black — Seed Articles from mkeblack.org/news-articles
 *
 * Migrates all known articles from the Wix site into Firestore.
 * Run: node scripts/seed-articles.js
 *
 * Articles are written to the `articles` Firestore collection.
 * Each article has: title, slug, excerpt, imageUrl, href (external),
 * author, published (bool), publishedAt, source: 'migrated_wix'
 *
 * The homepage `featured_articles` module reads from this collection
 * and shows the 3 most recent published articles.
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

// ── Load credentials (handles Vercel CLI quoted values correctly) ─────────────
const env = loadEnv();
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ── Article data scraped from mkeblack.org/news-articles ─────────────────────

const articles = [
  // ── Page 1 ──────────────────────────────────────────────────────────────
  {
    id: "article-5-key-businesses",
    title: "5 Key Milwaukee Black-Owned Businesses We Should Be Supporting",
    slug: "5-key-milwaukee-black-owned-businesses-we-should-be-supporting",
    excerpt:
      "Columbia Savings & Loan, Sherman Park Grocery, the BP at 8th & Atkinson, the Wisconsin Black Historical Society, and 5 Points Art Gallery — five institutions that need your support right now.",
    author: "Rick Banks",
    imageUrl:
      "https://static.wixstatic.com/media/4b8332_03aee34f77724ac39bd67bdc9b4a6303~mv2.png/v1/fill/w_1000,h_741,al_c,q_90,usm_0.66_1.00_0.01/4b8332_03aee34f77724ac39bd67bdc9b4a6303~mv2.png",
    href: "https://www.mkeblack.org/post/5-key-milwaukee-black-owned-businesses-we-should-be-supporting",
    publishedAt: new Date("2026-06-02T17:42:31.000Z"),
    readTime: "3 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-holiday-gift-guide-23",
    title: "2023 MKE Black Holiday Gift Guide",
    slug: "holiday-gift-guide-23",
    excerpt:
      "The MKE Black Holiday Gift Guide is back! Holiday gift ideas from Milwaukee area Black-owned businesses — who's got the perfect gift?",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/9f0f22_aecf84f279714642bb6128c4200d3232~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/9f0f22_aecf84f279714642bb6128c4200d3232~mv2.png",
    href: "https://www.mkeblack.org/post/holiday-gift-guide-23",
    publishedAt: new Date("2023-12-23"),
    readTime: "2 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-2-year-anniversary",
    title: "Feb 26: MKE Black 2 Year Anniversary Celebration",
    slug: "mke-black-2-year-anniversary-celebration",
    excerpt:
      "Join us virtually on Saturday, February 26th, from 6–7pm as we celebrate the two year anniversary of our app launch.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_c3f247d375164ac794b4825404399cdc~mv2.jpg/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_c3f247d375164ac794b4825404399cdc~mv2.jpg",
    href: "https://www.mkeblack.org/post/mke-black-2-year-anniversary-celebration",
    publishedAt: new Date("2023-02-26"),
    readTime: "1 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-60-ways-black-history",
    title: "60+ Ways to Celebrate Black History In Milwaukee",
    slug: "60-ways-to-celebrate-black-history-in-milwaukee",
    excerpt:
      "Black History Month highlights achievements, creativity, and history in the Black community. Milwaukee has an extensive Black history — here are 60+ ways to celebrate.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_4508d1459df44bed9f30ded51399a35b~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_4508d1459df44bed9f30ded51399a35b~mv2.png",
    href: "https://www.mkeblack.org/post/60-ways-to-celebrate-black-history-in-milwaukee",
    publishedAt: new Date("2023-02-17"),
    readTime: "3 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-holiday-gift-guide-21",
    title: "2021 MKE Black Holiday Gift Guide",
    slug: "2021-mke-black-holiday-gift-guide",
    excerpt:
      "50+ holiday gift ideas from Milwaukee area Black-owned businesses. With the holidays right around the corner, it's time to shop for the people you love.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_1b8f8dd3f254405a84891dd9c33a7c89~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_1b8f8dd3f254405a84891dd9c33a7c89~mv2.png",
    href: "https://www.mkeblack.org/post/2021-mke-black-holiday-gift-guide",
    publishedAt: new Date("2022-12-25"),
    readTime: "5 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-coffee-fix",
    title: "8 Black-Owned Businesses to Fill Your Coffee Fix",
    slug: "8-black-owned-businesses-to-fill-your-coffee-fix",
    excerpt:
      "Both National Coffee Day and International Coffee Day encourage us to drink coffee from around the world. Here are 8 Black-owned Milwaukee coffee spots.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_ee24185efe0c4003ab20af00ce9f323a~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_ee24185efe0c4003ab20af00ce9f323a~mv2.png",
    href: "https://www.mkeblack.org/post/8-black-owned-businesses-to-fill-your-coffee-fix",
    publishedAt: new Date("2021-10-01"),
    readTime: "1 min read",
    published: true,
    source: "migrated_wix",
  },
  // ── Page 2+ ──────────────────────────────────────────────────────────────
  {
    id: "article-gift-guide-black-history",
    title: "Black History Month Gift Guide: Support Black-Owned Businesses",
    slug: "black-history-month-gift-guide",
    excerpt:
      "This Black History Month, put your dollars to work in the Milwaukee Black community. Our curated guide to gifts from Black-owned businesses.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_3a70229aa01147f4bf85fbae5db166fe~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_3a70229aa01147f4bf85fbae5db166fe~mv2.png",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2022-02-01"),
    readTime: "2 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-near-west-side",
    title: "MKE Black Spotlight: Near West Side Black-Owned Businesses",
    slug: "near-west-side-black-owned-businesses",
    excerpt:
      "The Near West Side is home to a growing number of Black-owned businesses. Here's a look at some of the community anchors making an impact.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/9f0f22_76e4752bc2df4ac8b10950fe9c39def0%7Emv2.png/v1/fit/w_2500,h_1330,al_c/9f0f22_76e4752bc2df4ac8b10950fe9c39def0%7Emv2.png",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2022-05-01"),
    readTime: "2 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-juneteenth-mke",
    title: "Juneteenth in Milwaukee: How to Celebrate and Support",
    slug: "juneteenth-milwaukee-2022",
    excerpt:
      "Juneteenth is a celebration of freedom. Here's how you can celebrate in Milwaukee while supporting Black-owned businesses and community organizations.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_4508d1459df44bed9f30ded51399a35b~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_4508d1459df44bed9f30ded51399a35b~mv2.png",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2022-06-19"),
    readTime: "2 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-vegan-food-guide",
    title: "Your Guide to Vegan Options at Milwaukee Black-Owned Restaurants",
    slug: "vegan-options-milwaukee-black-owned",
    excerpt:
      "Looking for plant-based options from Black-owned restaurants in Milwaukee? The best vegan and vegetarian options in the city.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_ee24185efe0c4003ab20af00ce9f323a~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_ee24185efe0c4003ab20af00ce9f323a~mv2.png",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2022-03-15"),
    readTime: "3 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-app-launch",
    title: "MKE Black App Is Live — Here's What You Need to Know",
    slug: "mke-black-app-launch",
    excerpt:
      "After months of development, the MKE Black app is live. Download it today and start discovering Black-owned businesses across Milwaukee.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_c3f247d375164ac794b4825404399cdc~mv2.jpg/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/82231f_c3f247d375164ac794b4825404399cdc~mv2.jpg",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2021-02-26"),
    readTime: "2 min read",
    published: true,
    source: "migrated_wix",
  },
  {
    id: "article-bronzeville-spotlight",
    title: "Business Spotlight: Bronzeville Collective",
    slug: "bronzeville-collective-spotlight",
    excerpt:
      "With over 25 local brands in one space, The Bronzeville Collective offers something for everyone. We sat down with the founders to learn more.",
    author: "MKE Black",
    imageUrl:
      "https://static.wixstatic.com/media/9f0f22_aecf84f279714642bb6128c4200d3232~mv2.png/v1/fill/w_1000,h_750,al_c,q_90,usm_0.66_1.00_0.01/9f0f22_aecf84f279714642bb6128c4200d3232~mv2.png",
    href: "https://www.mkeblack.org/news-articles",
    publishedAt: new Date("2021-08-01"),
    readTime: "3 min read",
    published: true,
    source: "migrated_wix",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function seedArticles() {
  console.log(`\n📰 Seeding ${articles.length} articles → Firestore project: ${projectId}\n`);

  for (const article of articles) {
    const { id, ...rest } = article;
    await db.collection("articles").doc(id).set(
      {
        ...rest,
        publishedAt: Timestamp.fromDate(article.publishedAt),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    console.log(`  ✅ ${article.title.slice(0, 65)}`);
  }

  console.log(`\n✅ Done — ${articles.length} articles seeded.`);
  console.log(`\n👉 Go to /admin/articles to manage and edit them.`);
  console.log(`   The homepage Featured Articles module now populates automatically.\n`);
  process.exit(0);
}

seedArticles().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
