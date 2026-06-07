"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import DOMPurify from "dompurify";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarketplaceListingCard } from "@/components/marketplace/marketplace-listing-card";
import { StatePanel } from "@/components/ui/state-panel";
import { useHomepageModules } from "@/hooks/use-homepage-modules";
import { useLatestArticles } from "@/hooks/use-latest-articles";
import { useMemberDiscounts } from "@/hooks/use-member-discounts";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import { HOMEPAGE_MODULE_LABELS } from "@/lib/homepage";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  ArticleSummary,
  HomepageModule,
  MarketplaceListing,
  MemberDiscount
} from "@/lib/types";
import { isExternalHref } from "@/lib/utils";

type LiveSiteFeature = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

type LiveGuideFeature = LiveSiteFeature & {
  imageUrl: string;
  imageAlt: string;
  caption: string;
  body: string[];
};

const submitBusinessHref = "/contact?reason=submit_business";

function normalizeSubmitBusinessHref(link: { label: string; href: string }) {
  const label = link.label.trim().toLowerCase();
  const href = link.href.trim();

  if (
    href === "/contact" &&
    (label.includes("submit") || label.includes("business"))
  ) {
    return submitBusinessHref;
  }

  return href;
}

const liveStoryLinks: LiveSiteFeature[] = [
  {
    title: "Gift Cards from Milwaukee Black Owned Businesses",
    description:
      "A quick path to local gifts for birthdays, holidays, thank-yous, and other moments when a Milwaukee business should be part of the celebration.",
    href: "/news-articles",
    cta: "Read gift guide"
  },
  {
    title: "10 Black Owned Vegan Eats in Milwaukee",
    description:
      "A food guide for plant-based meals, snacks, and desserts from Black-owned restaurants and makers across the Milwaukee area.",
    href: "/directory?tag=vegan-options",
    cta: "Find vegan options"
  },
  {
    title: "Discover the Near West Side",
    description:
      "A neighborhood spotlight connecting visitors to businesses, food, culture, and community stops west of downtown Milwaukee.",
    href: "/directory?neighborhood=Near%20West%20Side",
    cta: "Explore the area"
  }
];

const liveGuideSections: LiveGuideFeature[] = [
  {
    title: "In the Mood for Food?",
    description:
      "Milwaukee has a deep Black-owned food and drink scene, from vegan burgers and soul food to desserts, popcorn, coffee, catering, and ice cream.",
    href: "/directory?category=Food%20%26%20Drink",
    cta: "Browse food and drink",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_c01b9066909449e0acb26d5bd8ab27f1~mv2.png/v1/fill/w_1000,h_627,al_c,q_90,enc_avif,quality_auto/82231f_c01b9066909449e0acb26d5bd8ab27f1~mv2.png",
    imageAlt: "Burgers and fries from a Black-owned Milwaukee restaurant",
    caption: "Twisted Plants offers delicious vegan food.",
    body: [
      "With nearly 80 Black-owned food and drink establishments, the Milwaukee area is no stranger to southern inspired cuisine. Morning favorites of scrambled eggs, bacon, and hash browns are a must try at Rise and Grind Cafe.",
      "In the mood for soul? Head over to Daddy's Soul Food & Grille, one of the city's best southern style restaurants. For vegan diners, Twisted Plants is the area's go-to place for plant-based burgers.",
      "Still have room for dessert? Confectionately Yours, Bougie Berries, Goody Gourmets, and Tastee Twist keep the sweet options close by."
    ]
  },
  {
    title: "Shop 'Til You Drop",
    description:
      "Find local retail, handcrafted goods, apparel, beauty products, makers markets, and multi-vendor spaces supporting Black businesses.",
    href: "/directory?category=Retail%20%26%20Shopping",
    cta: "Browse shopping",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_aeb53ddaa7ae47dbba543a9c3380f423~mv2.png/v1/fill/w_1000,h_628,al_c,q_90,enc_avif,quality_auto/82231f_aeb53ddaa7ae47dbba543a9c3380f423~mv2.png",
    imageAlt: "Sherman Phoenix building mural",
    caption: "Sherman Phoenix is home to several Black-owned restaurants, shops, and services.",
    body: [
      "With over 25 local brands in one space, The Bronzeville Collective offers something for everyone. Discover handcrafted jewelry, one-of-a-kind apparel, bath products, and more.",
      "Born out of the ashes of unrest, Sherman Phoenix offers a variety of restaurants, shops, and services. Visit The Underground Makers Market, Queens' Closet, and None Above for the latest fashion and handcrafted items."
    ]
  },
  {
    title: "Hitting The Bar",
    description:
      "Plan a night out with Black-owned bars, lounges, sports bars, live music, Caribbean food, jazz, and social spaces around the city.",
    href: "/directory?category=Food%20%26%20Drink",
    cta: "Find nightlife",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_c27dbfe0f8ac494b8e4fe5497b9564b8~mv2.png/v1/fill/w_1000,h_628,al_c,q_90,enc_avif,quality_auto/82231f_c27dbfe0f8ac494b8e4fe5497b9564b8~mv2.png",
    imageAlt: "Two drinks on a dark bar",
    caption: "Milwaukee is home to several Black-owned bars and clubs.",
    body: [
      "Milwaukee is known as Brew City for a reason, with ample places to drink, dance, and socialize. For an upscale experience, visit KISS Ultra Lounge for cocktails, food, partying, and entertainment.",
      "If you are into reggae and hip-hop, Club Timbuktu is a can't-miss stop with live music, DJs, and Caribbean food. Jazz fans can find an eclectic menu, drinks, and company at Garfield's 502.",
      "Catch Milwaukee Bucks, Brewers, and Green Bay Packers games at 4th Quarter Sports Bar and Grill and Skybox Sports Bar."
    ]
  },
  {
    title: "Dive Into Local History",
    description:
      "Connect with museums and historical institutions preserving African American history, culture, and community memory in Milwaukee.",
    href: "/directory?category=Education%2C%20Youth%20%26%20Family%20Services",
    cta: "Explore history",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_0e932acb2d3944ca9fd983d3475c7f74~mv2.png/v1/fill/w_999,h_628,al_c,q_90,enc_avif,quality_auto/82231f_0e932acb2d3944ca9fd983d3475c7f74~mv2.png",
    imageAlt: "America's Black Holocaust Museum",
    caption: "America's Black Holocaust Museum",
    body: [
      "Milwaukee is home to museums that dive into African American history. America's Black Holocaust Museum offers vast knowledge of the harmful effects of slavery and the road to reconciliation.",
      "The Wisconsin Black Historical Society documents and preserves African American history and culture in Wisconsin. Located in a former library and fire station, the museum provides a look into past times."
    ]
  },
  {
    title: "Discover the Arts",
    description:
      "Explore galleries, paint-and-sip studios, creative venues, print lounges, festivals, and arts businesses rooted in Black Milwaukee.",
    href: "/directory?category=Arts%2C%20Media%20%26%20Creative%20Services",
    cta: "Browse arts",
    imageUrl:
      "https://static.wixstatic.com/media/82231f_71e4919c24ef45dbb9931c8f60055ebf~mv2.png/v1/fill/w_1000,h_628,al_c,q_90,enc_avif,quality_auto/82231f_71e4919c24ef45dbb9931c8f60055ebf~mv2.png",
    imageAlt: "Painting at Vibez Creative Arts Space",
    caption: "Painting at Vibez Creative Arts Space",
    body: [
      "Milwaukee has a thriving Black arts scene and is home to many galleries, events, and art-based businesses. Vibez Creative Arts Space is the city's premiere urban paint-and-sip space.",
      "Cream City Print Lounge offers a similar concept with print, paint, and sip classes and parties. Art lovers can also explore 5 Points Art Gallery & Studios and Greenwood Park Gallery and Framing.",
      "Founded by Oscar winner and Milwaukee native John Ridley, No Studios offers an environment for artists and art lovers to come together. Black Arts Fest MKE honors African American heritage through performances, activities, and local vendors."
    ]
  }
];

const legacyMemberDiscountImages = [
  "https://static.wixstatic.com/media/9f0f22_c512893b3b994d6cb5fb3c9e4db759e8~mv2.jpg/v1/crop/x_0,y_931,w_1170,h_743/fill/w_456,h_286,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/unnamed%20(4).jpg",
  "https://static.wixstatic.com/media/9f0f22_8157bc84ea1740d7a7210909ac5af8bd~mv2.png/v1/fill/w_576,h_250,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/PNG-02.png",
  "https://static.wixstatic.com/media/9f0f22_d857e05640e6491a92efac81d3f5381d~mv2.jpg/v1/crop/x_0,y_1678,w_320,h_322/fill/w_428,h_286,al_c,lg_1,q_80,enc_avif,quality_auto/9f0f22_d857e05640e6491a92efac81d3f5381d~mv2.jpg",
  "https://static.wixstatic.com/media/9f0f22_24565f8d914b4c4f99c455c56b2ad89a~mv2.jpg/v1/crop/x_311,y_0,w_729,h_608/fill/w_520,h_286,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/431473182_1115458509593685_4701702819671945082_n.jpg",
  "https://static.wixstatic.com/media/9f0f22_19791aff28fc47e0b6b5f9450e221daa~mv2.jpg/v1/fill/w_520,h_250,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/9f0f22_19791aff28fc47e0b6b5f9450e221daa~mv2.jpg",
  "https://static.wixstatic.com/media/9f0f22_e55c07e544534adc8024c7e521805887~mv2.png/v1/fill/w_442,h_368,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/SP-LogoSP.png"
];

function SmartLink({
  href,
  className,
  children
}: {
  href: string;
  className: string;
  children: ReactNode;
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

function GuideModal({
  guide,
  onClose
}: {
  guide: LiveGuideFeature;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        className="relative grid max-h-[82vh] w-full max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#1f1f1f] shadow-glow lg:grid-cols-[0.92fr_1.08fr]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg leading-none text-white transition hover:border-accent/60 hover:bg-accent"
        >
          ×
        </button>

        <div className="max-h-[82vh] overflow-y-auto px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/45">
            Explore Milwaukee
          </p>
          <h3 className="mt-5 font-display text-4xl font-black leading-tight text-accent sm:text-5xl">
            {guide.title}
          </h3>
          <div className="mt-6 space-y-4 text-base leading-8 text-white/85">
            {guide.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-8 text-sm leading-7 text-white/55">{guide.caption}</p>
          <SmartLink
            href={guide.href}
            className="mt-8 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            {guide.cta}
          </SmartLink>
        </div>

        <div className="relative min-h-[280px] overflow-hidden lg:min-h-[520px]">
          <img
            src={guide.imageUrl}
            alt={guide.imageAlt}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1f1f1f]/25 via-transparent to-transparent" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function LiveSiteContentParitySection() {
  const [activeGuide, setActiveGuide] = useState<LiveGuideFeature | null>(null);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
              From the current MKE Black site
            </p>
            <h2 className="mt-4 font-display text-3xl font-black leading-tight text-ink sm:text-4xl">
              Business, events, culture, and advancement in Milwaukee.
            </h2>
            <p className="mt-5 text-sm leading-7 text-stone-300">
              These legacy homepage pathways keep the current MKE Black content
              model available while the new directory, marketplace, memberships,
              and owner tools continue to grow.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/directory"
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
              >
                Search business directory
              </Link>
              <Link
                href={submitBusinessHref}
                className="rounded-full border border-line bg-white/5 px-5 py-3 text-sm font-semibold text-stone-200 transition hover:border-accent/40 hover:text-ink"
              >
                Submit your business
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {liveStoryLinks.map((story) => (
              <Link
                key={story.title}
                href={story.href}
                className="group rounded-2xl border border-line bg-panelAlt/70 p-5 transition hover:border-accent/40 hover:bg-panelAlt"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success">
                  Featured guide
                </p>
                <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink">
                  {story.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-400">
                  {story.description}
                </p>
                <p className="mt-4 text-sm font-semibold text-accent transition group-hover:text-accentSoft">
                  {story.cta} →
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {liveGuideSections.map((section) => (
            <button
              type="button"
              key={section.title}
              onClick={() => setActiveGuide(section)}
              className="group flex min-h-64 flex-col rounded-2xl border border-line bg-canvas/35 p-5 text-left transition hover:border-success/40 hover:bg-success/5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Explore
              </p>
              <h3 className="mt-3 font-display text-xl font-bold leading-snug text-ink">
                {section.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-stone-400">
                {section.description}
              </p>
              <p className="mt-4 text-sm font-semibold text-success transition group-hover:text-ink">
                {section.cta} →
              </p>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeGuide ? (
          <GuideModal guide={activeGuide} onClose={() => setActiveGuide(null)} />
        ) : null}
      </AnimatePresence>
    </section>
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
    "group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panelAlt/75 transition hover:border-accent/40 hover:bg-panelAlt/85";

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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {formatPublishedDate(article.publishedAt)}
          </p>
        ) : null}
        <h3 className="mt-3 font-display text-xl font-bold leading-snug text-ink">
          {article.title}
        </h3>
        <p className="mt-4 flex-1 text-sm leading-7 text-stone-300">
          {article.excerpt || "Read the latest feature from the MKE Black newsroom."}
        </p>
        <span className="mt-6 text-sm font-semibold text-accent transition group-hover:text-accent">
          Read story →
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

function MemberDiscountCard({
  discount,
  fallbackImageUrl
}: {
  discount: MemberDiscount;
  fallbackImageUrl?: string;
}) {
  const imageUrl = discount.logoUrl || fallbackImageUrl;
  const content = (
    <>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={discount.businessName || "Member discount"}
          onError={(event) => {
            if (fallbackImageUrl && event.currentTarget.src !== fallbackImageUrl) {
              event.currentTarget.src = fallbackImageUrl;
              return;
            }

            event.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background: "var(--homepage-card-image-overlay)"
        }}
      />
      {!imageUrl ? (
        <div className="absolute inset-0 flex items-center justify-end pr-8">
          <span className="font-display text-5xl font-black uppercase tracking-[0.12em] text-accent/20">
            Deal
          </span>
        </div>
      ) : null}
      <div className="relative flex h-full max-w-[72%] flex-col p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
          Member discount
        </p>
        <h3 className="mt-3 font-display text-2xl font-black leading-tight text-ink">
          {discount.businessName || "MKE Black partner"}
        </h3>
        <p className="mt-4 line-clamp-3 text-base font-medium leading-7 text-stone-300">
          {discount.discountText || "Member offer details coming soon."}
        </p>
        {discount.businessUrl ? (
          <p className="mt-auto pt-4 text-sm font-semibold text-accent transition group-hover:text-ink">
            Visit business →
          </p>
        ) : null}
      </div>
    </>
  );

  const className =
    "group relative block h-60 overflow-hidden rounded-2xl border border-line bg-panelAlt/75 text-left transition hover:border-accent/50";

  if (discount.businessUrl) {
    return (
      <a
        href={discount.businessUrl}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

function renderHomepageModule(
  module: HomepageModule,
  articles: ArticleSummary[],
  articlesLoading: boolean,
  articlesError: string | null,
  discounts: MemberDiscount[],
  discountsLoading: boolean,
  discountsError: string | null,
  featuredListings: MarketplaceListing[],
  listingsLoading: boolean
) {
  switch (module.type) {
    case "hero": {
      const heroImageUrl = module.content.heroImages[0]?.trim();

      return (
        <section className="relative overflow-hidden border-b border-line bg-mesh-dark">
          {heroImageUrl ? (
            <>
              <img
                src={heroImageUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "var(--homepage-hero-image-overlay)"
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-canvas/35 via-transparent to-canvas/80" />
            </>
          ) : null}

          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                {module.title || HOMEPAGE_MODULE_LABELS.hero}
              </p>
              <h1 className="mt-5 font-display text-5xl font-black leading-tight text-ink sm:text-6xl lg:text-7xl">
                {module.content.headline || "Shape a live homepage from Firestore."}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-stone-200 sm:text-lg">
                {module.content.subheadline}
              </p>

              {module.content.ctaPrimary.href || module.content.ctaSecondary.href ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {module.content.ctaPrimary.href ? (
                    <SmartLink
                      href={normalizeSubmitBusinessHref(module.content.ctaPrimary)}
                      className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
                    >
                      {module.content.ctaPrimary.label || "Learn more"}
                    </SmartLink>
                  ) : null}
                  {module.content.ctaSecondary.href ? (
                    <SmartLink
                      href={normalizeSubmitBusinessHref(module.content.ctaSecondary)}
                      className="rounded-full border border-line bg-canvas/70 px-6 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent/10"
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
    }

    case "featured_articles":
      return (
        <section id="stories" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
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
                  className="rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15"
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
                    className="h-[360px] animate-pulse rounded-2xl border border-line bg-panelAlt/75"
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
              <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas/30 p-6 text-sm leading-7 text-stone-300">
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
          <div className="grid gap-8 rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
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
                    className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
                  >
                    {module.content.cta.label || "Become a member"}
                  </SmartLink>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line bg-panelAlt/70 p-6">
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
          <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
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
                    className="h-60 animate-pulse rounded-2xl border border-line bg-panelAlt/75"
                  />
                ))}
              </div>
            ) : discounts.length ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {discounts.map((discount, index) => (
                  <MemberDiscountCard
                    key={discount.id}
                    discount={discount}
                    fallbackImageUrl={legacyMemberDiscountImages[index]}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas/30 p-6 text-sm leading-7 text-stone-300">
                {module.content.emptyState || "Fresh member offers are on the way."}
              </div>
            )}
          </div>
        </section>
      );

    case "editorial":
      return (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            {module.content.imageUrl ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-canvas/60">
                <img
                  src={module.content.imageUrl}
                  alt={module.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className={module.content.imageUrl ? "" : "lg:col-span-2"}>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
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
                          className="font-display text-3xl font-black leading-tight text-ink sm:text-4xl"
                        />
                      );
                    },
                    h2: ({ node, ...properties }) => {
                      void node;
                      return (
                        <h3
                          {...properties}
                          className="mt-8 font-display text-2xl font-bold leading-tight text-ink"
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
                          className="text-accent underline decoration-accent/40 underline-offset-4"
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
          <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
            {module.title ? (
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
                {module.title}
              </p>
            ) : null}
            <div
              className="mt-5 text-stone-200 [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/35 [&_blockquote]:pl-5 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-black [&_h1]:text-ink [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-4 [&_p]:leading-8"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(module.content.html)
              }}
            />
          </div>
        </section>
      );

    case "marketplace": {
      const maxItems = module.content.maxItems ?? 6;
      const slice = featuredListings.slice(0, maxItems);
      return (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
                  {module.title || HOMEPAGE_MODULE_LABELS.marketplace}
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
                  className="rounded-full border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15"
                >
                  {module.content.ctaLabel || "Browse marketplace"}
                </SmartLink>
              ) : null}
            </div>

            {listingsLoading ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-2xl border border-line bg-panelAlt/75"
                  />
                ))}
              </div>
            ) : slice.length ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {slice.map((listing) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas/30 p-6 text-sm leading-7 text-stone-300">
                No featured marketplace listings yet.
              </div>
            )}
          </div>
        </section>
      );
    }
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
  const {
    listings: allFeaturedListings,
    loading: listingsLoading
  } = useMarketplaceListings({ availableOnly: true });

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
              className="h-64 animate-pulse rounded-2xl border border-line bg-panel/75"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!modules.length) {
    return (
      <div className="pb-16">
        <LiveSiteContentParitySection />
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
            discountsError,
            allFeaturedListings.filter((l) => l.featured),
            listingsLoading
          )}
        </motion.div>
      ))}
      <LiveSiteContentParitySection />
    </div>
  );
}
