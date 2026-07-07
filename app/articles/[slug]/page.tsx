import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublicArticleBySlug } from "@/lib/articles-public";

type ArticlePageProps = {
  params: {
    slug: string;
  };
};

function formatDate(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export async function generateMetadata({
  params
}: ArticlePageProps): Promise<Metadata> {
  const article = await getPublicArticleBySlug(params.slug);

  if (!article) {
    return {
      title: "Article Not Found | MKE Black"
    };
  }

  return {
    title: `${article.title} | MKE Black`,
    description: article.excerpt || "MKE Black article"
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getPublicArticleBySlug(params.slug);

  if (!article) {
    notFound();
  }

  const publishedLabel = formatDate(article.publishedAt);

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/news-articles"
            className="text-xs font-semibold uppercase tracking-[0.24em] text-accent transition hover:text-accentSoft"
          >
            Back to News & Articles
          </Link>
          <h1 className="mt-6 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
            {article.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-stone-400">
            <span>{article.author}</span>
            {publishedLabel ? <span>{publishedLabel}</span> : null}
            {article.readTime ? <span>{article.readTime}</span> : null}
          </div>
          {article.excerpt ? (
            <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-300">
              {article.excerpt}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt={article.title}
            className="mb-10 aspect-[16/9] w-full rounded-[2rem] border border-line object-cover shadow-glow"
          />
        ) : null}

        {article.hasContent ? (
          <article className="rounded-[2rem] border border-line bg-panel/85 p-6 shadow-glow sm:p-8">
            <div className="prose prose-stone max-w-none prose-headings:font-display prose-headings:text-ink prose-p:text-stone-300 prose-li:text-stone-300 prose-strong:text-ink prose-a:text-accent">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.body}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
          <article className="rounded-[2rem] border border-line bg-panel/85 p-6 shadow-glow sm:p-8">
            <p className="text-sm leading-7 text-stone-300">
              This article has been preserved in the MKE Black archive, but the
              full body has not been backfilled into Firebase yet.
            </p>
            {article.sourceHref ? (
              <a
                href={article.sourceHref}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-300 transition hover:border-accent/40 hover:text-accentSoft"
              >
                Open original source
              </a>
            ) : null}
          </article>
        )}
      </section>
    </main>
  );
}
