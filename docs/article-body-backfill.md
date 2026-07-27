# Article body backfill

The public article detail route reads from Firestore's active `articles`
collection. The migration script fills only missing `body` fields and never
overwrites an existing `body` or legacy `content` value.

## Sources

The script checks these sources in order:

1. A JSON array passed with `--input` (`slug` or `id`, plus `body`, `content`,
   or `articleBody`).
2. A Firestore collection passed with `--archive-collection`.
3. The Wayback CDX index for `mkeblack.org/post/*`. Active article slugs and
   titles are fuzzy-matched against every archived Wix post URL, then the most
   recent usable snapshot is converted to Markdown.

The current production project has 12 documents in `articles` and no separate
archive collection. The documents are `migrated_wix` records; six contain a
direct `/post/...` source URL and six require the slug-derived URL/archive
lookup.

Wayback requests use a 60-second timeout and retry HTTP 429/5xx responses and
network timeouts up to six times with exponential backoff. Recovered snapshot
titles are checked against the active title/slug before a fuzzy match is
accepted. Any unresolved article is printed under `Manual recovery required`,
along with its three best URL candidates.

## Run safely

From the repository root, ensure `.env.local` contains the production Firebase
Admin credentials, then run the read-only preview:

```bash
node scripts/backfill-legacy-articles.js --dry-run
```

Review every `[would-write]`, `[source-miss]`, and `[missing]` line. If you have
a trusted JSON export, prefer it and preview again:

```bash
node scripts/backfill-legacy-articles.js \
  --input ./legacy-archive-export.json \
  --dry-run
```

Only after reviewing the dry run, apply the same source configuration by
replacing `--dry-run` with `--apply`:

```bash
node scripts/backfill-legacy-articles.js --apply
```

Or, with the JSON export:

```bash
node scripts/backfill-legacy-articles.js \
  --input ./legacy-archive-export.json \
  --apply
```

The script requires exactly one of `--dry-run` or `--apply`, skips populated
articles, rechecks each document immediately before writing, merges only the
body and audit fields, and reports successes, skips, missing sources, and write
failures.

## Verify

After applying, open an article URL such as:

```text
/articles/5-key-milwaukee-black-owned-businesses-we-should-be-supporting
```

`lib/articles-public.ts` maps `body` (or legacy `content`) into
`article.body` and `hasContent`. `app/articles/[slug]/page.tsx` renders populated
bodies with `ReactMarkdown`; `ArticleBodyFallback` remains only when both body
fields are genuinely empty.
