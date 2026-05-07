"use client";

import Link from "next/link";
import { useArticles } from "@/hooks/use-articles";
import { ArticleSummary } from "@/lib/types";

function ArticleCard({ article }: { article: ArticleSummary }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : null;

  return (
    <article className="rounded-2xl border border-line bg-panel/80 p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow">
      {date ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {date}
        </p>
      ) : null}
      <h2 className="mt-3 font-display text-xl font-bold leading-snug text-ink">
        {article.title}
      </h2>
      {article.excerpt ? (
        <p className="mt-3 text-sm leading-7 text-stone-300">{article.excerpt}</p>
      ) : null}
      {article.href ? (
        <a
          href={article.href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:text-accentSoft"
        >
          Read story →
        </a>
      ) : null}
    </article>
  );
}

export function NewsArticlesPage() {
  const { articles, loading } = useArticles();

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            News &amp; Articles
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Black Business Spotlight.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Stories, features, and news from Milwaukee&apos;s Black business community.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
          <p className="text-sm leading-7 text-stone-200">
            Want to be featured in the Black Business Spotlight?{" "}
            <Link
              href="/contact"
              className="font-semibold text-accent transition hover:text-accentSoft"
            >
              Complete the form here
            </Link>
          </p>
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-40 animate-pulse rounded-2xl border border-line bg-panel/70"
                />
              ))}
            </div>
          ) : articles.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-panel/80 p-10 text-center">
              <p className="font-display text-xl font-bold text-ink">
                No articles yet
              </p>
              <p className="mt-3 text-sm text-stone-400">
                Stories will appear here once published. Check back soon.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
