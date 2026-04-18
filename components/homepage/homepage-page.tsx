"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StatePanel } from "@/components/ui/state-panel";
import { useHomepageModules } from "@/hooks/use-homepage-modules";
import { useLatestArticles } from "@/hooks/use-latest-articles";
import { useMemberDiscounts } from "@/hooks/use-member-discounts";
import { HOMEPAGE_MODULE_LABELS } from "@/lib/homepage";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { ArticleSummary, HomepageModule, MemberDiscount } from "@/lib/types";
import { isExternalHref } from "@/lib/utils";

function SmartLink({
  href,
  className,
  children
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function formatPublishedDate(value: Date | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  const wrapperClassName =
    "group flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-panelAlt/75 transition hover:border-accent/40 hover:bg-panelAlt/85";

  const content = (
    <>
      {article.imageUrl ? (
        <div className="aspect-[16/10] overflow-hidden border-b border-line bg-canvas/70">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-6">
        {article.publishedAt ? (
          <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">
            {formatPublishedDate(article.publishedAt)}
          </p>
        ) : null}
        <h3 className="mt-3 font-display text-3xl leading-tight text-ink">
          {article.title}
        </h3>
        <p className="mt-4 flex-1 text-sm leading-7 text-stone-300">
          {article.excerpt || "Read the latest feature from the MKE Black newsroom."}
        </p>
        <span className="mt-6 text-sm font-medium text-accentSoft transition group-hover:text-ink">
          Read story
        </span>
      </div>
    </>
  );

  if (!article.href) {
    return <div className={wrapperClassName}>{content}</div>;
  }

  return (
    <SmartLink href={article.href} className={wrapperClassName}>
      {content}
    </SmartLink>
  );
}

function renderHomepageModule(
  module: HomepageModule,
  articles: ArticleSummary[],
  articlesLoading: boolean,
  articlesError: string | null,
  discounts: MemberDiscount[],
  discountsLoading: boolean,
  discountsError: string | null
) {
  switch (module.type) {
    case "hero":
      return (
        <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(circle_at_top_left,rgba(212,160,23,0.26),transparent_26%),radial-gradient(circle_at_80%_25%,rgba(240,205,115,0.18),transparent_24%),linear-gradient(180deg,rgba(17,17,17,0.96),rgba(10,10,10,1))]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <p className="text-sm uppercase tracking-[0.32em] text-accentSoft">
                {module.title || HOMEPAGE_MODULE_LABELS.hero}
              </p>
              <h1 className="mt-5 font-display text-5xl leading-none text-ink sm:text-6xl lg:text-7xl">
                {module.content.headline || "Shape a live homepage from Firestore."}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-stone-200 sm:text-lg">
                {module.content.subheadline}
              </p>

              {module.content.ctaPrimary.href || module.content.ctaSecondary.href ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {module.content.ctaPrimary.href ? (
                    <SmartLink
                      href={module.content.ctaPrimary.href}
                      className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
                    >
                      {module.content.ctaPrimary.label || "Learn more"}
                    </SmartLink>
                  ) : null}
                  {module.content.ctaSecondary.href ? (
                    <SmartLink
                      href={module.content.ctaSecondary.href}
                      className="rounded-full border border-line bg-panel/30 px-6 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent/10 hover:text-accentSoft"
                    >
                      {module.content.ctaSecondary.label || "Explore"}
                    </SmartLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      );

    case "featured_articles":
      return (
        <section id="stories" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                  {module.title || HOMEPAGE_MODULE_LABELS.featured_articles}
                </p>
                {module.content.description ? (
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
                    {module.content.description}
                  </p>
                ) : null}
              </div>

              {module.content.ctaHref ? (
                <SmartLink
                  href={module.content.ctaHref}
                  className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                >
                  {module.content.ctaLabel || "View all stories"}
                </SmartLink>
              ) : null}
            </div>

            {articlesError ? (
              <div className="mt-6 rounded-3xl border border-danger/35 bg-danger/10 px-5 py-4 text-sm text-stone-100">
                {articlesError}
              </div>
            ) : articlesLoading ? (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[360px] animate-pulse rounded-[2rem] border border-line bg-panelAlt/75"
                  />
                ))}
              </div>
            ) : articles.length ? (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[2rem] border border-dashed border-line bg-canvas/30 p-6 text-sm leading-7 text-stone-300">
                No published articles are available yet.
              </div>
            )}
          </div>
        </section>
      );

    case "membership_cta": {
      const benefits = module.content.benefits.length
        ? module.content.benefits
        : [
            "Stay close to curated member perks.",
            "Back MKE Black programming all year.",
            "Get updates on new community offers."
          ];

      return (
        <section id="membership" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                {module.title || HOMEPAGE_MODULE_LABELS.membership_cta}
              </p>
              {module.content.description ? (
                <p className="mt-5 max-w-2xl text-base leading-8 text-stone-200">
                  {module.content.description}
                </p>
              ) : null}
              {module.content.cta.href ? (
                <div className="mt-8">
                  <SmartLink
                    href={module.content.cta.href}
                    className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
                  >
                    {module.content.cta.label || "Become a member"}
                  </SmartLink>
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-line bg-panelAlt/70 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Membership benefits
              </p>
              <ul className="mt-5 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm leading-7 text-stone-200">
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    }

    case "member_discounts":
      return (
        <section id="discounts" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                {module.title || HOMEPAGE_MODULE_LABELS.member_discounts}
              </p>
              {module.content.description ? (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
                  {module.content.description}
                </p>
              ) : null}
            </div>

            {discountsError ? (
              <div className="mt-6 rounded-3xl border border-danger/35 bg-danger/10 px-5 py-4 text-sm text-stone-100">
                {discountsError}
              </div>
            ) : discountsLoading ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-60 animate-pulse rounded-[2rem] border border-line bg-panelAlt/75"
                  />
                ))}
              </div>
            ) : discounts.length ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {discounts.map((discount) => (
                  <a
                    key={discount.id}
                    href={discount.businessUrl || undefined}
                    target={discount.businessUrl ? "_blank" : undefined}
                    rel={discount.businessUrl ? "noreferrer" : undefined}
                    className="group rounded-[2rem] border border-line bg-panelAlt/75 p-6 transition hover:border-accent/40 hover:bg-panelAlt/85"
                  >
                    <div className="flex items-start gap-4">
                      {discount.logoUrl ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-line bg-canvas/70">
                          <img
                            src={discount.logoUrl}
                            alt={discount.businessName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line bg-canvas/70 text-xs uppercase tracking-[0.24em] text-muted">
                          Deal
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="font-display text-3xl leading-tight text-ink">
                          {discount.businessName}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-stone-300">
                          {discount.discountText}
                        </p>
                      </div>
                    </div>

                    {discount.businessUrl ? (
                      <p className="mt-6 text-sm font-medium text-accentSoft transition group-hover:text-ink">
                        Visit business
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[2rem] border border-dashed border-line bg-canvas/30 p-6 text-sm leading-7 text-stone-300">
                {module.content.emptyState || "Fresh member offers are on the way."}
              </div>
            )}
          </div>
        </section>
      );

    case "editorial":
      return (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            {module.content.imageUrl ? (
              <div className="overflow-hidden rounded-[2rem] border border-line bg-canvas/60">
                <img
                  src={module.content.imageUrl}
                  alt={module.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className={module.content.imageUrl ? "" : "lg:col-span-2"}>
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                {module.title || HOMEPAGE_MODULE_LABELS.editorial}
              </p>
              <div className="mt-5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...properties }) => {
                      void node;
                      return (
                        <h2
                          {...properties}
                          className="font-display text-4xl leading-tight text-ink sm:text-5xl"
                        />
                      );
                    },
                    h2: ({ node, ...properties }) => {
                      void node;
                      return (
                        <h3
                          {...properties}
                          className="mt-8 font-display text-3xl leading-tight text-ink"
                        />
                      );
                    },
                    p: ({ node, ...properties }) => {
                      void node;
                      return (
                        <p
                          {...properties}
                          className="mt-4 text-base leading-8 text-stone-200"
                        />
                      );
                    },
                    ul: ({ node, ...properties }) => {
                      void node;
                      return (
                        <ul
                          {...properties}
                          className="mt-5 space-y-3 text-base leading-8 text-stone-200"
                        />
                      );
                    },
                    li: ({ node, ...properties }) => {
                      void node;
                      return <li {...properties} className="ml-5 list-disc" />;
                    },
                    a: ({ node, href = "", children }) => {
                      void node;
                      return (
                        <a
                          href={href}
                          target={isExternalHref(href) ? "_blank" : undefined}
                          rel={isExternalHref(href) ? "noreferrer" : undefined}
                          className="text-accentSoft underline decoration-accent/40 underline-offset-4"
                        >
                          {children}
                        </a>
                      );
                    },
                    blockquote: ({ node, ...properties }) => {
                      void node;
                      return (
                        <blockquote
                          {...properties}
                          className="mt-6 border-l-2 border-accent/35 pl-5 text-stone-300"
                        />
                      );
                    }
                  }}
                >
                  {module.content.body}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </section>
      );

    case "custom":
      return (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
            {module.title ? (
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                {module.title}
              </p>
            ) : null}
            <div
              className="mt-5 text-stone-200 [&_a]:text-accentSoft [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/35 [&_blockquote]:pl-5 [&_h1]:font-display [&_h1]:text-4xl [&_h1]:text-ink [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-4 [&_p]:leading-8"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(module.content.html)
              }}
            />
          </div>
        </section>
      );
  }
}

export function HomepagePage() {
  const { modules, loading, error } = useHomepageModules(true);
  const {
    articles,
    loading: articlesLoading,
    error: articlesError
  } = useLatestArticles(3);
  const {
    discounts,
    loading: discountsLoading,
    error: discountsError
  } = useMemberDiscounts(true);

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Connect Firebase to publish the homepage"
          description="The homepage module system reads from Firestore. Add your Firebase environment variables in .env.local to see live content."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel title="Unable to load homepage modules" description={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-[2.5rem] border border-line bg-panel/75"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!modules.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="No homepage modules are live"
          description="Publish at least one visible document in the homepage_modules collection to populate the homepage."
        />
      </div>
    );
  }

  return (
    <div className="pb-16">
      {modules.map((module, index) => (
        <motion.div
          key={module.id}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.18 }}
          transition={{ duration: 0.45, delay: index * 0.1 }}
        >
          {renderHomepageModule(
            module,
            articles,
            articlesLoading,
            articlesError,
            discounts,
            discountsLoading,
            discountsError
          )}
        </motion.div>
      ))}
    </div>
  );
}
