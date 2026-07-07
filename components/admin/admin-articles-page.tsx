"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
} from "@/lib/firebase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  author: string;
  imageUrl: string;
  href: string;
  publishedAt: string; // ISO string for form inputs
  readTime: string;
  published: boolean;
  source: string;
};

function blankArticle(): Omit<Article, "id"> {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    author: "MKE Black",
    imageUrl: "",
    href: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    readTime: "",
    published: true,
    source: "manual",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getHelpers() {
  const [mod, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb(),
  ]);
  if (!db) throw new Error("Firestore not available");
  return { mod, db };
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // ── Slide-over state
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<Omit<Article, "id">>(blankArticle());

  // ── Load articles ─────────────────────────────────────────────────────────

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const { mod, db } = await getHelpers();
      const snap = await mod.getDocs(
        mod.query(
          mod.collection(db, "articles"),
          mod.orderBy("publishedAt", "desc")
        )
      );
      const rows: Article[] = snap.docs.map((doc) => {
        const d = doc.data();
        const rawDate =
          d.publishedAt?.toDate?.()?.toISOString?.() ??
          d.publishedAt ??
          "";
        return {
          id: doc.id,
          title: d.title ?? "",
          slug: d.slug ?? "",
          excerpt: d.excerpt ?? "",
          body: d.body ?? d.content ?? "",
          author: d.author ?? "MKE Black",
          imageUrl: d.imageUrl ?? "",
          href: d.href ?? "",
          publishedAt:
            typeof rawDate === "string"
              ? rawDate.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
          readTime: d.readTime ?? "",
          published: d.published !== false,
          source: d.source ?? "manual",
        };
      });
      setArticles(rows);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to load articles",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  // ── Open slide-over ───────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(blankArticle());
    setSlideOpen(true);
  }

  function openEdit(article: Article) {
    setEditing(article);
    setForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      body: article.body,
      author: article.author,
      imageUrl: article.imageUrl,
      href: article.href,
      publishedAt: article.publishedAt,
      readTime: article.readTime,
      published: article.published,
      source: article.source,
    });
    setSlideOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const { mod, db } = await getHelpers();
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
        publishedAt: mod.Timestamp
          ? mod.Timestamp.fromDate(new Date(form.publishedAt))
          : new Date(form.publishedAt),
        updatedAt: mod.serverTimestamp
          ? mod.serverTimestamp()
          : new Date(),
      };

      if (editing) {
        await mod.setDoc(
          mod.doc(db, "articles", editing.id),
          payload,
          { merge: true }
        );
        setFeedback({ tone: "success", text: "Article updated." });
      } else {
        const ref = mod.doc(mod.collection(db, "articles"));
        await mod.setDoc(ref, {
          ...payload,
          id: ref.id,
          createdAt: mod.serverTimestamp ? mod.serverTimestamp() : new Date(),
        });
        setFeedback({ tone: "success", text: "Article created." });
      }

      setSlideOpen(false);
      void loadArticles();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle published ──────────────────────────────────────────────────────

  async function handleTogglePublished(article: Article) {
    try {
      const { mod, db } = await getHelpers();
      await mod.setDoc(
        mod.doc(db, "articles", article.id),
        { published: !article.published, updatedAt: mod.serverTimestamp ? mod.serverTimestamp() : new Date() },
        { merge: true }
      );
      void loadArticles();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Toggle failed",
      });
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(article: Article) {
    if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    setDeletingId(article.id);
    try {
      const { mod, db } = await getHelpers();
      await mod.deleteDoc(mod.doc(db, "articles", article.id));
      void loadArticles();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setDeletingId(null);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const published = articles.filter((a) => a.published);
  const drafts = articles.filter((a) => !a.published);

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="rounded-[2.4rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">Admin</p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink">
                Articles.
              </h1>
              <p className="mt-4 text-sm leading-7 text-stone-300">
                Manage the articles that appear in the{" "}
                <span className="text-accentSoft">Featured Articles</span> module
                on the homepage. Published articles are sorted newest-first and
                the top 3 show publicly.
              </p>
            </div>
            <button
              type="button"
              onClick={openNew}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
            >
              + Add article
            </button>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Total</p>
              <p className="mt-2 text-2xl font-bold text-ink">{articles.length}</p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Published</p>
              <p className="mt-2 text-2xl font-bold text-green-400">{published.length}</p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Drafts</p>
              <p className="mt-2 text-2xl font-bold text-amber-400">{drafts.length}</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-success/35 bg-success/10 text-stone-100"
                : "border-danger/35 bg-danger/10 text-stone-100"
            }`}
          >
            {feedback.text}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-3 text-stone-400 hover:text-stone-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Article table */}
        <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              All articles
            </p>
            <button
              type="button"
              onClick={() => void loadArticles()}
              className="rounded-full border border-line px-4 py-2 text-xs text-stone-400 hover:text-accentSoft transition"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-line bg-panelAlt/60"
                />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-stone-500">No articles yet.</p>
              <p className="mt-2 text-xs text-stone-600">
                Run{" "}
                <code className="rounded bg-panelAlt px-2 py-0.5 text-stone-300">
                  node scripts/seed-articles.js
                </code>{" "}
                to import from mkeblack.org, or click &quot;+ Add article&quot; above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panelAlt/60 px-4 py-4"
                >
                  {/* Thumbnail */}
                  {article.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-14 w-20 shrink-0 rounded-xl bg-panelAlt flex items-center justify-center">
                      <span className="text-xs text-stone-600">No img</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-stone-100 truncate">
                        {article.title}
                      </p>
                      {article.source === "migrated_wix" && (
                        <span className="text-[10px] uppercase tracking-wider border border-line px-2 py-0.5 rounded-full text-stone-500">
                          Wix
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500 truncate">
                      {article.author} · {article.publishedAt} ·{" "}
                      {article.readTime}
                    </p>
                    <p className="mt-1 text-xs text-stone-600 truncate">
                      {article.excerpt.slice(0, 100)}
                      {article.excerpt.length > 100 ? "…" : ""}
                    </p>
                    {article.body ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-accent">
                        Native content saved
                      </p>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Published toggle */}
                    <button
                      type="button"
                      onClick={() => void handleTogglePublished(article)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        article.published
                          ? "bg-success/15 text-green-400 border border-success/30 hover:bg-danger/10 hover:text-rose-400"
                          : "bg-panelAlt text-stone-500 border border-line hover:bg-success/10 hover:text-green-400"
                      }`}
                    >
                      {article.published ? "Published" : "Draft"}
                    </button>

                    {article.slug ? (
                      <a
                        href={`/articles/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-400 hover:text-accentSoft transition"
                      >
                        Open article
                      </a>
                    ) : null}
                    {article.href ? (
                      <a
                        href={article.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-400 hover:text-accentSoft transition"
                      >
                        Source ↗
                      </a>
                    ) : null}

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => openEdit(article)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-300 hover:border-accent/40 hover:text-accentSoft transition"
                    >
                      Edit
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => void handleDelete(article)}
                      disabled={deleting === article.id}
                      className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-danger/20 transition disabled:opacity-50"
                    >
                      {deleting === article.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-[2rem] border border-line/60 bg-panelAlt/30 p-5 text-sm leading-7 text-stone-500">
          <p className="font-semibold text-stone-400 mb-1">How this works</p>
          <p>
            The{" "}
            <span className="text-stone-300">Featured Articles</span> module on
            the homepage reads from this collection in real time. The 3 most
            recently published articles appear automatically — no code deploy
            needed. Set an article to{" "}
            <span className="text-stone-300">Draft</span> to hide it without
            deleting it.
          </p>
          <p className="mt-3">
            Articles marked <span className="text-stone-300">Wix</span> were
            migrated from mkeblack.org. Add markdown to{" "}
            <span className="text-stone-300">Body content</span> to preserve
            the full article in Firebase; the public article page will then use
            native stored content instead of relying on the original source.
          </p>
        </div>
      </section>

      {/* ── Slide-over form ── */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={() => setSlideOpen(false)}
          />

          {/* Panel */}
          <div className="w-full max-w-xl bg-panel border-l border-line flex flex-col overflow-y-auto">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <p className="font-semibold text-stone-100">
                {editing ? "Edit article" : "New article"}
              </p>
              <button
                type="button"
                onClick={() => setSlideOpen(false)}
                className="text-stone-500 hover:text-stone-200 text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 px-6 py-6 space-y-5">

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: f.slug || slugify(title),
                    }));
                  }}
                  placeholder="Article headline"
                  required
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Slug (auto-generated from title)
                </label>
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="url-friendly-slug"
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-400 placeholder:text-stone-600 focus:border-accent/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Excerpt
                </label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, excerpt: e.target.value }))
                  }
                  rows={3}
                  placeholder="Short description shown on the homepage card"
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Body content
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                  rows={12}
                  placeholder="Write or paste the full article in markdown."
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                />
                <p className="mt-1 text-xs text-stone-600">
                  Stored in Firebase and rendered on the native /articles/[slug]
                  page.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                    Author
                  </label>
                  <input
                    value={form.author}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, author: e.target.value }))
                    }
                    placeholder="MKE Black"
                    className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                    Read time
                  </label>
                  <input
                    value={form.readTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, readTime: e.target.value }))
                    }
                    placeholder="3 min read"
                    className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Published date
                </label>
                <input
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publishedAt: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 focus:border-accent/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Cover image URL
                </label>
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="https://static.wixstatic.com/..."
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                />
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="mt-2 h-32 w-full rounded-xl object-cover"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Original/source URL
                </label>
                <input
                  value={form.href}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, href: e.target.value }))
                  }
                  placeholder="https://www.mkeblack.org/post/..."
                  className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
                />
                <p className="mt-1 text-xs text-stone-600">
                  Optional. Keep the legacy source link here for reference or
                  archive recovery. Public article cards now open the native
                  internal article page when a slug exists.
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-panelAlt/50 px-4 py-4">
                <label className="flex items-center gap-3 text-sm text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, published: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-line bg-panelAlt text-accent focus:ring-accent/30"
                  />
                  Published — visible on homepage and in article listings
                </label>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Create article"}
                </button>
                <button
                  type="button"
                  onClick={() => setSlideOpen(false)}
                  className="rounded-full border border-line px-5 py-3 text-sm text-stone-400 hover:text-stone-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
