"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useArticles } from "@/hooks/use-articles";
import { ArticleSummary } from "@/lib/types";

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  const date = formatDate(article.publishedAt);

  const inner = (
    <article className="group flex gap-4 rounded-2xl border border-line bg-panel/80 p-4 transition hover:border-accent/40 hover:bg-panelAlt/80">
      {/* Thumbnail */}
      {article.imageUrl ? (
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas/60">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-16 w-24 shrink-0 rounded-xl border border-line bg-panelAlt/60 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">MKE Black</span>
        </div>
      )}

      {/* Text */}
      <div className="flex min-w-0 flex-col justify-center gap-1">
        {date ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {date}
          </p>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {article.title}
        </h3>
        <p className="text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
          Read story →
        </p>
      </div>
    </article>
  );

  if (!article.href) return inner;

  const isExternal = article.href.startsWith("http");
  if (isExternal) {
    return (
      <a href={article.href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={article.href}>{inner}</Link>;
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
        {/* Spotlight CTA */}
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

        {/* Articles list */}
        <div className="mt-10">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-24 animate-pulse rounded-2xl border border-line bg-panel/70"
                />
              ))}
            </div>
          ) : articles.length ? (
            <div className="space-y-3">
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
