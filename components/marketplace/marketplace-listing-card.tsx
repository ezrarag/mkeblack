import Image from "next/image";
import Link from "next/link";
import { MarketplaceListing } from "@/lib/types";

function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Contact for price";
  const dollars = priceCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2
  }).format(dollars);
}

type MarketplaceListingCardProps = {
  listing: MarketplaceListing;
};

export function MarketplaceListingCard({ listing }: MarketplaceListingCardProps) {
  const orderHref =
    listing.orderUrl ||
    `/business/${listing.businessId}`;
  const orderIsExternal = listing.orderUrl
    ? !listing.orderUrl.startsWith("/")
    : false;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel/80 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {listing.photoUrl ? (
          <Image
            src={listing.photoUrl}
            alt={listing.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-panelAlt font-display text-3xl font-black text-stone-600">
            {listing.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Category badge */}
        <div className="absolute left-3 top-3 rounded-full border border-black/20 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-200">
          {listing.category}
        </div>

        {/* Featured star */}
        {listing.featured ? (
          <div className="absolute right-3 top-3 rounded-full border border-accent/50 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-accent">
            ★ Featured
          </div>
        ) : null}

        {/* Solidarity badge */}
        {listing.businessSolidarity ? (
          <div className="absolute bottom-3 right-3 rounded-full border border-success/50 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-success">
            ★ Solidarity Circle
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <Link
          href={`/business/${listing.businessId}`}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:text-accentSoft"
        >
          {listing.businessName}
        </Link>

        <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-ink">
          {listing.name}
        </h3>

        {listing.description ? (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-stone-400">
            {listing.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span
            className={`font-display text-lg font-bold ${
              listing.priceCents === 0
                ? "text-stone-400 text-sm font-normal"
                : "text-ink"
            }`}
          >
            {formatPrice(listing.priceCents)}
          </span>

          {orderIsExternal ? (
            <a
              href={orderHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accentSoft"
            >
              Order →
            </a>
          ) : (
            <Link
              href={orderHref}
              className="rounded-full border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accentSoft"
            >
              Order →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
