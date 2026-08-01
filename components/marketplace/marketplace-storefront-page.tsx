"use client";

import Image from "next/image";
import Link from "next/link";
import { useBusiness } from "@/hooks/use-business";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import { MarketplaceListingCard } from "@/components/marketplace/marketplace-listing-card";
import { StatePanel } from "@/components/ui/state-panel";

type MarketplaceStorefrontPageProps = {
  businessId: string;
};

export function MarketplaceStorefrontPage({ businessId }: MarketplaceStorefrontPageProps) {
  const { business, loading: businessLoading, error: businessError } = useBusiness(businessId);
  const { listings, loading: listingsLoading, error: listingsError } = useMarketplaceListings({ businessId });
  const activeListings = listings.filter((listing) => listing.available);

  if (businessLoading || listingsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-panel/70" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl border border-line bg-panel/60" />
          ))}
        </div>
      </div>
    );
  }

  if (businessError || listingsError || !business || !business.active || !business.solidarityMember) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Storefront unavailable"
          description="This Solidarity Circle storefront could not be loaded or is no longer active."
          action={
            <Link href="/marketplace" className="inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white">
              Browse marketplace
            </Link>
          }
        />
      </div>
    );
  }

  const heroImage = business.photos[0] || activeListings.find((listing) => listing.photoUrl)?.photoUrl;
  const actions = [
    business.website ? { href: business.website, label: "Website", external: true } : null,
    business.phone ? { href: `tel:${business.phone}`, label: "Call", external: false } : null,
    business.email ? { href: `mailto:${business.email}`, label: "Email", external: false } : null
  ].filter((action): action is { href: string; label: string; external: boolean } => Boolean(action));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/marketplace" className="text-sm font-semibold text-stone-400 transition hover:text-accentSoft">
        ← Back to marketplace
      </Link>

      <header className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel/80 shadow-glow">
        {heroImage ? (
          <div className="relative h-52 sm:h-72">
            <Image src={heroImage} alt={`${business.name} storefront`} fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          </div>
        ) : null}
        <div className={`p-6 sm:p-8 ${heroImage ? "relative -mt-24" : ""}`}>
          <span className="inline-flex rounded-full border border-success/50 bg-black/80 px-3 py-1 text-[11px] font-semibold text-success">
            ★ Solidarity Circle Storefront
          </span>
          <h1 className="mt-3 font-display text-4xl font-black text-ink sm:text-5xl">{business.name}</h1>
          {business.description ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300 sm:text-base">{business.description}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noreferrer" : undefined}
                className="rounded-full border border-line bg-black/50 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-accent/50 hover:text-white"
              >
                {action.label}
              </a>
            ))}
            <Link href={`/business/${business.id}`} className="rounded-full border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accentSoft transition hover:bg-accent/20">
              Full business profile →
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Shop this business</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink">Products &amp; services</h2>
          </div>
          <p className="text-sm text-stone-500">{activeListings.length} offering{activeListings.length === 1 ? "" : "s"}</p>
        </div>

        {activeListings.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeListings.map((listing) => <MarketplaceListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-12 text-center">
            <p className="font-display text-xl font-bold text-ink">No active offerings right now</p>
            <p className="mt-2 text-sm text-stone-400">Visit the full business profile to learn more or contact the business.</p>
          </div>
        )}
      </section>
    </div>
  );
}
