import Image from "next/image";
import Link from "next/link";
import { Business, MarketplaceListing } from "@/lib/types";

type MarketplaceStorefrontCardProps = {
  business: Business;
  listings: MarketplaceListing[];
};

export function MarketplaceStorefrontCard({
  business,
  listings
}: MarketplaceStorefrontCardProps) {
  const image = business.photos[0] || listings.find((listing) => listing.photoUrl)?.photoUrl;
  const categories = Array.from(new Set(listings.map((listing) => listing.category))).slice(0, 3);

  return (
    <Link
      href={`/marketplace/storefront/${business.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel/80 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-panelAlt">
        {image ? (
          <Image
            src={image}
            alt={`${business.name} storefront`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl font-black text-stone-600">
            {business.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded-full border border-success/50 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-success">
          ★ Solidarity Circle
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Storefront
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold text-ink">
          {business.name}
        </h2>
        {business.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-400">
            {business.description}
          </p>
        ) : null}
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <span key={category} className="rounded-full border border-line px-2.5 py-1 text-[10px] text-stone-400">
                {category}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-stone-500">
              {listings.length} offering{listings.length === 1 ? "" : "s"}
            </span>
            <span className="text-sm font-semibold text-accentSoft">Shop storefront →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
