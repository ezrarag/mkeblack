#!/usr/bin/env node
/**
 * Backfill the legacy article archive into the production `articles`
 * Firestore collection.
 *
 * Why this exists
 * ----------------
 * app/articles/[slug]/page.tsx already degrades gracefully (see
 * components/news/article-body-fallback.tsx) when an `articles` doc EXISTS
 * but its `body` field is empty. The hard 404s users were hitting on mobile
 * happen one step earlier: the `articles` doc doesn't exist at all yet for
 * a given legacy slug, so lib/articles-public.ts#getPublicArticleBySlug
 * returns null and the page calls notFound().
 *
 * This script closes that gap in two passes:
 *   1. STUB PASS — for every legacy record, if no `articles` doc exists for
 *      its slug, create one immediately with real metadata and an empty
 *      body. That alone eliminates the 404 — the page will render the
 *      "preserved in the archive, not backfilled yet" message instead.
 *   2. BODY PASS — for every legacy record that includes real body content,
 *      write it into the matching `articles` doc, but only if that doc's
 *      body is currently empty. It will never overwrite a body an admin
 *      already edited by hand in /admin/articles.
 *
 * Safe to re-run: matching is by slug, writes are additive/merge-only, nothing
 * is deleted, and a manually-curated body is never clobbered.
 *
 * This is a read/write **utility script**, not a Firebase Cloud Function —
 * this project doesn't use Cloud Functions (no functions/ directory, no
 * firebase-functions dependency; it's deployed on Vercel with Firestore as
 * the only Firebase piece). Running it as a one-off admin script matches how
 * scripts/backfill-article-bodies.js and scripts/seed-articles.js already
 * work in this repo. If recurring/automatic backfill is wanted later, the
 * cleanest fit for this stack is a Vercel Cron hitting a new authenticated
 * route under app/api/admin/ that calls the same upsert logic below — not a
 * Cloud Function, since there's no Functions deployment target configured.
 *
 * Usage:
 *   node scripts/backfill-legacy-articles.js ./legacy-archive-export.json
 *   node scripts/backfill-legacy-articles.js ./legacy-archive-export.json --dry-run
 *
 * Legacy source JSON shape (array):
 * [
 *   {
 *     "slug": "example-legacy-post",       // required, must match the slug
 *                                           // the /articles/[slug] route uses
 *     "title": "Example Legacy Post",       // required
 *     "body": "Full markdown body...",      // optional — omit if not yet
 *                                           // recovered from the archive
 *     "excerpt": "One-line summary",        // optional
 *     "author": "MKE Black",                // optional, defaults below
 *     "imageUrl": "https://...",            // optional
 *     "href": "https://www.mkeblack.org/post/example-legacy-post", // original
 *                                           // Wix URL, used as "Open original
 *                                           // source" while body is missing
 *     "publishedAt": "2022-01-01"           // optional, ISO date string
 *   }
 * ]
 *
 * Swap-in note: if the "historic legacy archive" actually lives in its own
 * Firestore collection (e.g. `legacy_articles`) rather than a JSON export,
 * change loadLegacyRecords() below to read from that collection instead —
 * everything after that point (matching/upsert logic) stays the same.
 */

const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const ARTICLES_COLLECTION = "articles";

function parseArgs(argv) {
  const inputPath = argv.find((arg) => !arg.startsWith("--"));
  const dryRun = argv.includes("--dry-run");
  return { inputPath, dryRun };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTimestampOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

function loadLegacyRecords(inputPath) {
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Legacy archive export not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Legacy archive export must be a JSON array.");
  }

  return parsed;
}

async function findArticleDocBySlug(db, slug) {
  const snapshot = await db
    .collection(ARTICLES_COLLECTION)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  return snapshot.docs[0] ?? null;
}

async function main() {
  const { inputPath, dryRun } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    console.error(
      "Usage: node scripts/backfill-legacy-articles.js ./legacy-archive-export.json [--dry-run]"
    );
    process.exit(1);
  }

  const env = loadEnv();
  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();
  const records = loadLegacyRecords(inputPath);

  const stats = {
    stubsCreated: 0,
    bodiesBackfilled: 0,
    metadataFilledIn: 0,
    skippedAlreadyComplete: 0,
    skippedInvalid: 0,
    errors: 0
  };

  console.log(
    `Loaded ${records.length} legacy record(s) from ${inputPath}${
      dryRun ? " (dry run — no writes will happen)" : ""
    }.`
  );

  for (const record of records) {
    const slug = text(record?.slug);
    const title = text(record?.title || record?.headline);

    if (!slug || !title) {
      console.warn(`Skipping invalid record (missing slug/title): ${JSON.stringify(record)}`);
      stats.skippedInvalid += 1;
      continue;
    }

    try {
      const existingDoc = await findArticleDocBySlug(db, slug);
      const legacyBody = text(record.body);
      const legacyHref = text(record.href || record.url);

      if (!existingDoc) {
        // STUB PASS: create the doc now so the page never 404s again for
        // this slug, even if we don't have the body content yet.
        const payload = {
          slug,
          title,
          excerpt: text(record.excerpt || record.summary),
          body: legacyBody, // may be "" — that's expected and handled by
          // the frontend's ArticleBodyFallback component.
          href: legacyHref,
          imageUrl: text(record.imageUrl || record.coverImageUrl),
          author: text(record.author) || "MKE Black",
          readTime: text(record.readTime),
          publishedAt: toTimestampOrNull(record.publishedAt) ?? FieldValue.serverTimestamp(),
          published: true,
          source: "legacy_archive",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        console.log(
          `${dryRun ? "[dry-run] Would create" : "Creating"} stub article for slug: ${slug}${
            legacyBody ? " (with body)" : " (metadata only, no body yet)"
          }`
        );

        if (!dryRun) {
          await db.collection(ARTICLES_COLLECTION).add(payload);
        }

        stats.stubsCreated += 1;
        if (legacyBody) stats.bodiesBackfilled += 1;
        continue;
      }

      // Doc already exists — only fill in what's missing. Never clobber a
      // body or metadata an admin already edited by hand.
      const existingData = existingDoc.data() ?? {};
      const currentBody = text(existingData.body || existingData.content);
      const updatePayload = {};

      if (!currentBody && legacyBody) {
        updatePayload.body = legacyBody;
      }

      if (!text(existingData.excerpt) && text(record.excerpt)) {
        updatePayload.excerpt = text(record.excerpt);
      }

      if (!text(existingData.imageUrl) && text(record.imageUrl)) {
        updatePayload.imageUrl = text(record.imageUrl);
      }

      if (!text(existingData.href) && legacyHref) {
        updatePayload.href = legacyHref;
      }

      if (Object.keys(updatePayload).length === 0) {
        stats.skippedAlreadyComplete += 1;
        continue;
      }

      updatePayload.updatedAt = FieldValue.serverTimestamp();

      console.log(
        `${dryRun ? "[dry-run] Would update" : "Updating"} article for slug: ${slug} (${Object.keys(
          updatePayload
        )
          .filter((key) => key !== "updatedAt")
          .join(", ")})`
      );

      if (!dryRun) {
        await existingDoc.ref.set(updatePayload, { merge: true });
      }

      if (updatePayload.body) stats.bodiesBackfilled += 1;
      else stats.metadataFilledIn += 1;
    } catch (error) {
      console.error(`Failed processing slug "${slug}":`, error.message);
      stats.errors += 1;
    }
  }

  console.log("\nBackfill summary:");
  console.log(`  Stub articles created (previously hard 404s): ${stats.stubsCreated}`);
  console.log(`  Bodies backfilled: ${stats.bodiesBackfilled}`);
  console.log(`  Metadata-only updates: ${stats.metadataFilledIn}`);
  console.log(`  Already complete / skipped: ${stats.skippedAlreadyComplete}`);
  console.log(`  Invalid records skipped: ${stats.skippedInvalid}`);
  console.log(`  Errors: ${stats.errors}`);

  if (stats.errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Legacy article backfill failed:", error);
  process.exit(1);
});
