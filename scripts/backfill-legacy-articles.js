#!/usr/bin/env node
/**
 * Backfill missing article bodies in Firestore's active `articles` collection.
 *
 * Source priority:
 *   1. Optional JSON export supplied with --input
 *   2. Optional Firestore archive collection supplied with --archive-collection
 *   3. Stored Wix post URL or fuzzy-matched URL from the Wayback CDX index
 *
 * The migration is idempotent: documents with a non-empty body/content field
 * are skipped and no existing body is overwritten. It also refuses to run
 * unless exactly one of --dry-run or --apply is provided.
 *
 * Usage:
 *   node scripts/backfill-legacy-articles.js --dry-run
 *   node scripts/backfill-legacy-articles.js --apply
 *   node scripts/backfill-legacy-articles.js --input ./archive.json --dry-run
 *   node scripts/backfill-legacy-articles.js --archive-collection legacy_articles --apply
 */

const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

const ACTIVE_COLLECTION = "articles";
const DEFAULT_ORIGIN = "https://www.mkeblack.org";
const REQUEST_HEADERS = {
  "User-Agent": "MKEBlackArticleBackfill/1.0 (+https://www.mkeblack.org)"
};
const WAYBACK_TIMEOUT_MS = 60000;
const WAYBACK_MAX_ATTEMPTS = 6;
const FUZZY_MATCH_MIN_SCORE = 0.28;
const MATCH_STOP_WORDS = new Set([
  "a", "an", "and", "at", "black", "for", "from", "in", "mke",
  "milwaukee", "of", "owned", "the", "to", "with"
]);

function parseArgs(argv) {
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");

  if (dryRun === apply) {
    throw new Error("Choose exactly one mode: --dry-run or --apply.");
  }

  return {
    dryRun,
    inputPath: valueAfter("--input"),
    archiveCollection: valueAfter("--archive-collection"),
    skipFetch: argv.includes("--no-fetch")
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value) {
  return text(value).replace(/^\/+|\/+$/g, "").toLowerCase();
}

function slugFromPostUrl(value) {
  try {
    const pathname = new URL(value).pathname;
    const marker = "/post/";
    const index = pathname.toLowerCase().indexOf(marker);
    return index >= 0 ? normalizeSlug(pathname.slice(index + marker.length)) : "";
  } catch {
    return "";
  }
}

function matchTokens(value) {
  return normalizeSlug(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !MATCH_STOP_WORDS.has(token));
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function similarity(leftValue, rightValue) {
  const left = normalizeSlug(leftValue).replace(/[^a-z0-9]+/g, "-");
  const right = normalizeSlug(rightValue).replace(/[^a-z0-9]+/g, "-");
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = new Set(matchTokens(left));
  const rightTokens = new Set(matchTokens(right));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const jaccard = intersection / union;
  const edit = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  const containment = left.includes(right) || right.includes(left) ? 1 : 0;
  return jaccard * 0.6 + edit * 0.3 + containment * 0.1;
}

function rankArchivedPostUrls(article, archivedUrls, limit = 5) {
  const slug = normalizeSlug(article?.slug || article?.id);
  const title = text(article?.title || article?.headline);
  return archivedUrls
    .map((url) => {
      const candidateSlug = slugFromPostUrl(url);
      return {
        url,
        slug: candidateSlug,
        score: Math.max(similarity(slug, candidateSlug), similarity(title, candidateSlug))
      };
    })
    .filter((candidate) => candidate.slug)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function recordBody(record) {
  return text(record?.body || record?.content || record?.articleBody);
}

function loadJsonRecords(inputPath) {
  if (!inputPath) return [];
  const resolved = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Archive JSON not found: ${resolved}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Archive JSON must contain an array of article records.");
  }
  return parsed;
}

function indexRecords(records) {
  const index = new Map();
  for (const record of records) {
    const keys = [record?.slug, record?.id].map(normalizeSlug).filter(Boolean);
    for (const key of keys) index.set(key, record);
  }
  return index;
}

async function loadFirestoreArchive(db, collectionName) {
  if (!collectionName) return [];
  if (collectionName === ACTIVE_COLLECTION) {
    throw new Error("--archive-collection must not be the active articles collection.");
  }
  const snapshot = await db.collection(collectionName).get();
  console.log(`Loaded ${snapshot.size} record(s) from archive collection "${collectionName}".`);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function decodeEntities(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function extractBalancedContentViewer(html) {
  const marker = /<div\b[^>]*data-id=["']content-viewer["'][^>]*>/i.exec(html);
  if (!marker) return "";

  const start = marker.index;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(html))) {
    depth += /^<\/div/i.test(match[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  return "";
}

function htmlToMarkdown(html) {
  let value = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) =>
      alt.trim() ? `\n\n${alt.trim()}\n\n` : ""
    );

  // Preserve link destinations before stripping the remaining markup.
  for (let pass = 0; pass < 4; pass += 1) {
    value = value.replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, label) => {
        const cleanLabel = decodeEntities(label.replace(/<[^>]+>/g, "")).trim();
        return cleanLabel ? `[${cleanLabel}](${href})` : "";
      }
    );
  }

  value = value
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<h[1-6]\b[^>]*>/gi, "\n\n## ")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(value)
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBodyFromHtml(html) {
  const jsonLdPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdPattern.exec(html))) {
    try {
      const parsed = JSON.parse(match[1]);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const articleBody = records.map((item) => text(item?.articleBody)).find(Boolean);
      if (articleBody) return decodeEntities(articleBody);
    } catch {
      // Continue to the rendered Wix content viewer.
    }
  }

  const viewer = extractBalancedContentViewer(html);
  return viewer ? htmlToMarkdown(viewer) : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, options = {}) {
  const isWayback = new URL(url).hostname === "web.archive.org";
  const maxAttempts = isWayback ? WAYBACK_MAX_ATTEMPTS : 1;
  const fetchImpl = options.fetchImpl || fetch;
  const sleepImpl = options.sleepImpl || sleep;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: REQUEST_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(isWayback ? WAYBACK_TIMEOUT_MS : 30000)
      });
      if (response.ok) return response.text();

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = retryable;
        throw error;
      }
      const retryAfterSeconds = Number(response.headers?.get?.("retry-after"));
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.warn(`[wayback-retry] HTTP ${response.status}; attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
      await sleepImpl(delay);
    } catch (error) {
      lastError = error;
      if (error.retryable === false || attempt === maxAttempts) break;
      const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.warn(`[wayback-retry] ${error.message}; attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
      await sleepImpl(delay);
    }
  }
  throw lastError || new Error("Wayback request failed");
}

async function enumerateArchivedPostUrls() {
  const endpoint = new URL("https://web.archive.org/cdx/search/cdx");
  endpoint.searchParams.set("url", "mkeblack.org/post/*");
  endpoint.searchParams.set("output", "json");
  endpoint.searchParams.set("filter", "statuscode:200");
  endpoint.searchParams.append("filter", "mimetype:text/html");
  endpoint.searchParams.set("fl", "original");
  endpoint.searchParams.set("collapse", "urlkey");

  const rows = JSON.parse(await fetchText(endpoint.toString()));
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return Array.from(
    new Set(
      rows
        .slice(1)
        .map((row) => text(row[0]))
        .filter((url) => /\/post\//i.test(url))
    )
  );
}

async function latestWaybackSnapshots(sourceUrl) {
  const endpoint = new URL("https://web.archive.org/cdx/search/cdx");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("output", "json");
  endpoint.searchParams.set("filter", "statuscode:200");
  endpoint.searchParams.append("filter", "mimetype:text/html");
  endpoint.searchParams.set("fl", "timestamp,original");
  endpoint.searchParams.set("collapse", "digest");
  endpoint.searchParams.set("limit", "-5");

  const rows = JSON.parse(await fetchText(endpoint.toString()));
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows
    .slice(1)
    .reverse()
    .map(([timestamp, original]) => ({
      timestamp,
      url: `https://web.archive.org/web/${timestamp}id_/${original}`
    }));
}

function sourceUrlCandidates(article) {
  const slug = normalizeSlug(article.slug || article.id);
  const stored = text(article.href || article.url || article.externalUrl);
  const candidates = [];
  if (/\/post\//i.test(stored)) candidates.push(stored);
  if (slug) candidates.push(`${DEFAULT_ORIGIN}/post/${slug}`);
  return Array.from(new Set(candidates));
}

function extractArchivedTitle(html) {
  const headline = /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html);
  if (headline) return decodeEntities(headline[1]);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return title ? decodeEntities(title[1].replace(/<[^>]+>/g, "")).trim() : "";
}

async function recoverBodyFromWeb(article, archivedUrls) {
  const failures = [];
  const directUrls = sourceUrlCandidates(article);
  const ranked = rankArchivedPostUrls(article, archivedUrls);
  const fuzzyUrls = ranked
    .filter((candidate) => candidate.score >= FUZZY_MATCH_MIN_SCORE)
    .map((candidate) => candidate.url);
  const candidates = Array.from(new Set([...directUrls, ...fuzzyUrls]));

  if (ranked[0]) {
    console.log(
      `[match] ${normalizeSlug(article.slug || article.id)} -> ${ranked[0].url} (${ranked[0].score.toFixed(3)})`
    );
  }

  for (const sourceUrl of candidates) {
    try {
      const snapshots = await latestWaybackSnapshots(sourceUrl);
      for (const snapshot of snapshots) {
        try {
          const html = await fetchText(snapshot.url);
          const body = extractBodyFromHtml(html);
          const archivedTitle = extractArchivedTitle(html);
          const validationScore = Math.max(
            similarity(article.slug || article.id, slugFromPostUrl(sourceUrl)),
            similarity(article.title || article.headline, archivedTitle)
          );
          const isDirect = directUrls.includes(sourceUrl);
          if (body && (isDirect || validationScore >= FUZZY_MATCH_MIN_SCORE)) {
            return {
              body,
              source: `wayback:${snapshot.timestamp}:${sourceUrl}`,
              matchedUrl: sourceUrl,
              archivedTitle
            };
          }
          failures.push(
            `${snapshot.url}: ${body ? `title mismatch (${validationScore.toFixed(3)})` : "no article body found"}`
          );
        } catch (error) {
          failures.push(`${snapshot.url}: ${error.message}`);
        }
      }
    } catch (error) {
      failures.push(`Wayback lookup for ${sourceUrl}: ${error.message}`);
    }
  }
  return { body: "", source: "", failures, ranked };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const config = getFirebaseAdminConfig(env);
  if (!getApps().length) initializeApp({ credential: cert(config) });
  const db = getFirestore();

  const jsonIndex = indexRecords(loadJsonRecords(options.inputPath));
  const archiveIndex = indexRecords(
    await loadFirestoreArchive(db, options.archiveCollection)
  );
  const snapshot = await db.collection(ACTIVE_COLLECTION).get();
  const stats = { recovered: 0, written: 0, complete: 0, missing: 0, failed: 0 };
  const manualRecovery = [];
  let archivedUrls = [];

  if (!options.skipFetch) {
    archivedUrls = await enumerateArchivedPostUrls();
    console.log(`Wayback CDX index contains ${archivedUrls.length} archived post URL(s).`);
  }

  console.log(
    `${options.dryRun ? "DRY RUN" : "APPLY"}: scanning ${snapshot.size} active article(s) in project ${config.projectId}.`
  );

  for (const doc of snapshot.docs) {
    const article = { id: doc.id, ...doc.data() };
    const slug = normalizeSlug(article.slug || doc.id);
    const existingBody = recordBody(article);
    if (existingBody) {
      console.log(`[skip] ${slug}: body already populated (${existingBody.length} chars)`);
      stats.complete += 1;
      continue;
    }

    let recovered = jsonIndex.get(slug) || jsonIndex.get(normalizeSlug(doc.id));
    let body = recordBody(recovered);
    let source = body ? `json:${options.inputPath}` : "";

    if (!body) {
      recovered = archiveIndex.get(slug) || archiveIndex.get(normalizeSlug(doc.id));
      body = recordBody(recovered);
      if (body) source = `firestore:${options.archiveCollection}`;
    }

    if (!body && !options.skipFetch) {
      const webResult = await recoverBodyFromWeb(article, archivedUrls);
      body = webResult.body;
      source = webResult.source;
      if (!body && webResult.failures?.length) {
        console.warn(`[source-miss] ${slug}: ${webResult.failures.join("; ")}`);
      }
    }

    if (!body) {
      console.warn(`[missing] ${slug}: no body found in configured sources`);
      const ranked = rankArchivedPostUrls(article, archivedUrls, 3);
      manualRecovery.push({
        slug,
        title: text(article.title || article.headline),
        candidates: ranked.map((item) => `${item.url} (${item.score.toFixed(3)})`)
      });
      stats.missing += 1;
      continue;
    }

    stats.recovered += 1;
    console.log(
      `[${options.dryRun ? "would-write" : "write"}] ${slug}: ${body.length} chars from ${source}`
    );

    if (!options.dryRun) {
      try {
        // Re-read immediately before the write so a concurrent admin edit is
        // never overwritten during a long archive recovery run.
        const fresh = await doc.ref.get();
        if (recordBody(fresh.data())) {
          console.log(`[skip] ${slug}: body was populated during this run`);
          stats.complete += 1;
          continue;
        }
        await doc.ref.set(
          {
            body,
            bodyBackfillSource: source,
            bodyBackfilledAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        stats.written += 1;
      } catch (error) {
        console.error(`[failure] ${slug}: ${error.message}`);
        stats.failed += 1;
      }
    }
  }

  console.log("\nSummary");
  console.log(`  Already complete: ${stats.complete}`);
  console.log(`  Bodies recovered: ${stats.recovered}`);
  console.log(`  Bodies written: ${stats.written}`);
  console.log(`  Still missing: ${stats.missing}`);
  console.log(`  Write failures: ${stats.failed}`);
  if (manualRecovery.length) {
    console.log("\nManual recovery required:");
    for (const item of manualRecovery) {
      console.log(`  - ${item.slug}${item.title ? ` — ${item.title}` : ""}`);
      if (item.candidates.length) {
        console.log(`    Best archive candidates: ${item.candidates.join("; ")}`);
      } else {
        console.log("    No plausible archived URL was found; supply a URL or body JSON.");
      }
    }
  }
  if (stats.failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Article body backfill failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  extractBalancedContentViewer,
  extractBodyFromHtml,
  extractArchivedTitle,
  fetchText,
  htmlToMarkdown,
  parseArgs,
  rankArchivedPostUrls,
  similarity,
  slugFromPostUrl,
  sourceUrlCandidates
};
