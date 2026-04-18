import Image from "next/image";
import Link from "next/link";
import {
  formatHoursRange,
  getDayKeyFromDate,
  isBusinessOpenNow
} from "@/lib/business-hours";
import { Business, DayKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";

type BusinessCardProps = {
  business: Business;
  layout: "grid" | "list";
  selectedDay: DayKey | "all";
};

export function BusinessCard({
  business,
  layout,
  selectedDay
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
    <Link
      href={`/business/${business.id}`}
      className={`group overflow-hidden rounded-[2rem] border border-line bg-panel/80 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-glow ${
        layout === "list" ? "grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          layout === "list" ? "h-full min-h-[220px]" : "aspect-[4/3]"
        }`}
      >
        {previewPhoto ? (
          <Image
            src={previewPhoto}
            alt={business.name}
            fill
            sizes={layout === "list" ? "(min-width: 768px) 280px, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center bg-gradient-to-br from-accent/30 via-accent/10 to-transparent font-display text-4xl text-accentSoft"
          >
            {initials}
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full border border-black/10 bg-black/65 px-3 py-1 text-xs uppercase tracking-[0.22em] text-accentSoft">
          {business.category}
        </div>
      </div>

      <div className="flex flex-col justify-between p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-3xl text-ink">{business.name}</h3>
              <p className="mt-2 text-sm text-stone-400">{business.address}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${
                isOpen
                  ? "border border-success/35 bg-success/10 text-success"
                  : "border border-danger/35 bg-danger/10 text-rose-200"
              }`}
            >
              {isOpen ? "Open now" : "Closed"}
            </span>
          </div>

          <p className="mt-4 max-h-[5.25rem] overflow-hidden text-sm leading-7 text-stone-300">
            {business.description || "Community-rooted Milwaukee business listing."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-stone-200">{hoursLabel}</p>
          <span className="text-xs uppercase tracking-[0.24em] text-accentSoft">
            View profile
          </span>
        </div>
      </div>
    </Link>
  );
}
