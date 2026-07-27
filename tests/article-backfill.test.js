const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractBodyFromHtml,
  fetchText,
  rankArchivedPostUrls,
  similarity
} = require("../scripts/backfill-legacy-articles");

const archivedUrls = [
  "http://www.mkeblack.org/post/10-black-owned-vegan-eats-in-milwaukee",
  "https://www.mkeblack.org/post/discover-the-near-west-side",
  "https://www.mkeblack.org/post/holiday-gift-guide-23",
  "https://www.mkeblack.org/post/unrelated-community-story"
];

test("fuzzy matching resolves known legacy slug mismatches", () => {
  const vegan = rankArchivedPostUrls(
    {
      slug: "vegan-options-milwaukee-black-owned",
      title: "10 Black-Owned Vegan Eats in Milwaukee"
    },
    archivedUrls
  );
  assert.match(vegan[0].url, /10-black-owned-vegan-eats-in-milwaukee$/);

  const nearWestSide = rankArchivedPostUrls(
    {
      slug: "near-west-side-black-owned-businesses",
      title: "Discover the Near West Side"
    },
    archivedUrls
  );
  assert.match(nearWestSide[0].url, /discover-the-near-west-side$/);
});

test("exact archive slugs outrank unrelated posts", () => {
  const ranked = rankArchivedPostUrls(
    { slug: "holiday-gift-guide-23", title: "2023 Holiday Gift Guide" },
    archivedUrls
  );
  assert.equal(ranked[0].score, 1);
  assert.match(ranked[0].url, /holiday-gift-guide-23$/);
});

test("Wix content viewer HTML converts to clean Markdown", () => {
  const html = `
    <html><head><meta property="og:title" content="Archive Test"></head><body>
      <div data-id="content-viewer"><div><p>Opening paragraph.</p>
      <div><h2>Places to visit</h2><p><a href="https://example.test">Example</a></p></div>
      </div></div>
    </body></html>`;
  const body = extractBodyFromHtml(html);
  assert.match(body, /Opening paragraph\./);
  assert.match(body, /## Places to visit/);
  assert.match(body, /\[Example\]\(https:\/\/example\.test\)/);
});

test("similarity remains conservative for unrelated posts", () => {
  assert.ok(similarity("holiday-gift-guide-23", "unrelated-community-story") < 0.28);
});

test("Wayback requests retry throttling/server errors with backoff", async () => {
  let calls = 0;
  const delays = [];
  const body = await fetchText("https://web.archive.org/example", {
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) {
        return {
          ok: false,
          status: calls === 1 ? 429 : 503,
          headers: { get: () => null }
        };
      }
      return { ok: true, text: async () => "recovered" };
    },
    sleepImpl: async (delay) => delays.push(delay)
  });

  assert.equal(body, "recovered");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("Wayback requests do not retry permanent 404 responses", async () => {
  let calls = 0;
  await assert.rejects(
    fetchText("https://web.archive.org/missing", {
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 404, headers: { get: () => null } };
      },
      sleepImpl: async () => undefined
    }),
    /HTTP 404/
  );
  assert.equal(calls, 1);
});
