import Image from "next/image";
import Link from "next/link";
import {
  formatHoursRange,
  getDayKeyFromDate,
  isBusinessOpenNow
} from "@/lib/business-hours";
import { Business, DayKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import { FavoriteButton } from "@/components/ui/favorite-button";

type BusinessCardProps = {
  business: Business;
  layout: "grid" | "list";
  selectedDay: DayKey | "all";
  distanceMiles?: number;
  directionsUrl?: string;
  isHighlighted?: boolean;
  onSelect?: (business: Business) => void;
};

export function BusinessCard({
  business,
  layout,
  selectedDay,
  distanceMiles,
  directionsUrl,
  isHighlighted = false,
  onSelect
}: BusinessCardProps) {
  const previewPhoto = business.photos[0];
  const isOpen = isBusinessOpenNow(business.hours);
  const summaryDay = selectedDay === "all" ? getDayKeyFromDate() : selectedDay;
  const hoursLabel = `${titleCase(summaryDay)}: ${formatHoursRange(
    business.hours,
    summaryDay
  )}`;
  const initials = business.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <article
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => {
        if (onSelect) {
          onSelect(business);
        }
      }}
      onKeyDown={(event) => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(business);
        }
      }}
      className={`group overflow-hidden rounded-2xl border bg-panel/80 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow ${
        isHighlighted ? "border-accent shadow-glow" : "border-line"
      } ${
        layout === "list" ? "grid gap-0 md:grid-cols-[260px_minmax(0,1fr)]" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          layout === "list" ? "h-full min-h-[200px]" : "aspect-[4/3]"
        }`}
      >
        {previewPhoto ? (
          <Image
            src={previewPhoto}
            alt={business.name}
            fill
            sizes={layout === "list" ? "(min-width: 768px) 260px, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-panelAlt font-display text-3xl font-black text-stone-500">
            {initials}
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full border border-black/20 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-200">
          {business.category}
        </div>
        {typeof distanceMiles === "number" ? (
          <div className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">
            {distanceMiles.toFixed(1)} mi
          </div>
        ) : null}
        {business.solidarityMember ? (
          <div className="absolute bottom-3 right-3 rounded-full border border-success/50 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-success">
            ★ Solidarity Circle
          </div>
        ) : null}
        <div className="absolute right-3 top-3">
          <FavoriteButton business={business} />
        </div>
      </div>

      <div className="flex flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-bold leading-snug text-ink">{business.name}</h3>
              <p className="mt-1 text-xs text-stone-400">{business.address}</p>
              {business.neighborhood ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {business.neighborhood}
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                isOpen
                  ? "border border-success/40 bg-success/10 text-success"
                  : "border border-danger/40 bg-danger/10 text-rose-300"
              }`}
            >
              {isOpen ? "Open" : "Closed"}
            </span>
          </div>

          <p className="mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-stone-300">
            {business.description || "Community-rooted Milwaukee business listing."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-xs text-stone-300">{hoursLabel}</p>
          <div className="flex flex-wrap items-center gap-3">
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
              >
                Directions
              </a>
            ) : null}
            <Link
              href={`/business/${business.id}`}
              onClick={(event) => event.stopPropagation()}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:text-accentSoft"
            >
              View profile
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
