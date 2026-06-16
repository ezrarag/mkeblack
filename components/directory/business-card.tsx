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

type CategoryVisual = { emoji: string; from: string; to: string };

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  "Food & Drink":                       { emoji: "🍽️",  from: "#7c2d12", to: "#431407" },
  "Hair, Beauty & Grooming":            { emoji: "✂️",  from: "#701a75", to: "#3b0764" },
  "Retail & Shopping":                  { emoji: "🛍️", from: "#3730a3", to: "#1e1b4b" },
  "Music, Entertainment & Culture":     { emoji: "🎵",  from: "#6b21a8", to: "#2e1065" },
  "Arts, Media & Creative Services":    { emoji: "🎨",  from: "#0e7490", to: "#083344" },
  "Professional & Business Services":   { emoji: "💼",  from: "#1d4ed8", to: "#1e3a8a" },
  "Health & Wellness":                  { emoji: "🌱",  from: "#15803d", to: "#14532d" },
  "Mental Health":                      { emoji: "🌿",  from: "#5b21b6", to: "#2e1065" },
  "Education, Youth & Family Services": { emoji: "📚",  from: "#0369a1", to: "#0c4a6e" },
  "Home, Cleaning & Maintenance":       { emoji: "🏠",  from: "#92400e", to: "#451a03" },
  "Work & Event Spaces":                { emoji: "🏢",  from: "#374151", to: "#111827" },
  "Legal & Consulting":                 { emoji: "⚖️",  from: "#1e3a8a", to: "#0f172a" },
  "Automotive":                         { emoji: "🔧",  from: "#334155", to: "#0f172a" },
  "Sports & Entertainment":             { emoji: "🏆",  from: "#b91c1c", to: "#7f1d1d" },
  "Catering, Snacks & Drinks":          { emoji: "☕",  from: "#92400e", to: "#3b1a0d" },
  "Online Goods & Products":            { emoji: "📦",  from: "#6d28d9", to: "#3b0764" },
  "Online Clothing & Accessories":      { emoji: "👗",  from: "#be185d", to: "#500724" },
  "Nonprofits":                         { emoji: "🤝",  from: "#065f46", to: "#022c22" },
  "Resources":                          { emoji: "📋",  from: "#1d4ed8", to: "#1e3a8a" },
  "Other":                              { emoji: "⭐",  from: "#44403c", to: "#1c1917" },
};

function getCategoryVisual(category: string): CategoryVisual {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS["Other"] ?? { emoji: "⭐", from: "#44403c", to: "#1c1917" };
}

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
  const categoryVisual = getCategoryVisual(business.category);

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
          <div
            className="relative flex h-full items-center justify-center overflow-hidden"
            style={{
              background: `linear-gradient(150deg, ${categoryVisual.from} 0%, ${categoryVisual.to} 100%)`
            }}
          >
            {/* Large illustrative watermark — cropped bottom-right */}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-4 -right-3 select-none leading-none"
              style={{ fontSize: "8rem", opacity: 0.22, transform: "rotate(12deg)" }}
            >
              {categoryVisual.emoji}
            </span>
            {/* Secondary echo — top-left */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-3 -top-3 select-none leading-none"
              style={{ fontSize: "3.5rem", opacity: 0.1, transform: "rotate(-15deg)" }}
            >
              {categoryVisual.emoji}
            </span>
            {/* Initials */}
            <span className="relative z-10 font-display text-4xl font-black tracking-tight text-white/60">
              {initials}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full border border-black/20 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
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
              {business.onlineBased ? (
                <p className="mt-1 text-xs font-semibold text-accent/80">Online-based</p>
              ) : (
                <p className="mt-1 text-xs text-stone-400">{business.address}</p>
              )}
              {business.neighborhood ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {business.neighborhood}
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                isOpen
                  ? "border border-success/50 bg-success/20 text-success"
                  : "border border-stone-700 bg-transparent text-stone-500"
              }`}
            >
              {isOpen ? "Open" : "Closed"}
            </span>
          </div>

          <p className={`mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 ${business.description ? "text-stone-300" : "italic text-stone-500"}`}>
            {business.description || "No description added yet — view the full profile to learn more."}
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
