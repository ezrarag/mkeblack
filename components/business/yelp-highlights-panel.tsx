"use client";

import Image from "next/image";
import { Business, YelpHoursPeriod } from "@/lib/types";

const dayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

function formatYelpTime(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return value;
  }

  const hour = Number(value.slice(0, 2));
  const minute = value.slice(2);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatYelpHours(periods: YelpHoursPeriod[]) {
  return periods.reduce<Array<{ day: string; summary: string }>>((rows, period) => {
    const label = dayLabels[period.day] ?? `Day ${period.day + 1}`;
    const summary = `${formatYelpTime(period.start)}-${formatYelpTime(period.end)}${
      period.isOvernight ? " next day" : ""
    }`;
    const existing = rows.find((row) => row.day === label);

    if (existing) {
      existing.summary = `${existing.summary}, ${summary}`;
      return rows;
    }

    return [...rows, { day: label, summary }];
  }, []);
}

export function YelpHighlightsPanel({ business }: { business: Business }) {
  const hasYelpData = Boolean(
    business.yelpUrl ||
      business.yelpRating ||
      business.yelpReviewCount ||
      business.yelpPhotos.length ||
      business.yelpReviews.length ||
      business.yelpHours.length
  );

  if (!hasYelpData) {
    return null;
  }

  const hours = formatYelpHours(business.yelpHours);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Yelp highlights
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink">
            Recent public signals from Yelp
          </h2>
          <p className="mt-2 text-sm leading-7 text-stone-400">
            Yelp data is synced from the official Yelp API. Review text is
            limited to Yelp-provided excerpts.
          </p>
        </div>
        {business.yelpUrl ? (
          <a
            href={business.yelpUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm font-semibold text-accentSoft transition hover:bg-accent/15"
          >
            View on Yelp
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-panelAlt/60 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Rating
          </p>
          <p className="mt-2 font-display text-2xl font-black text-ink">
            {business.yelpRating ? `${business.yelpRating.toFixed(1)} / 5` : "Not listed"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panelAlt/60 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Reviews
          </p>
          <p className="mt-2 font-display text-2xl font-black text-ink">
            {business.yelpReviewCount ?? "Not listed"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panelAlt/60 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Last synced
          </p>
          <p className="mt-2 text-sm font-semibold text-stone-200">
            {business.yelpLastSyncedAt
              ? business.yelpLastSyncedAt.toLocaleDateString()
              : "Not synced"}
          </p>
        </div>
      </div>

      {business.yelpPhotos.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {business.yelpPhotos.slice(0, 3).map((photo) => (
            <div
              key={photo}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-panelAlt/70"
            >
              <Image
                src={photo}
                alt={`${business.name} Yelp photo`}
                fill
                sizes="(min-width: 768px) 24vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      {business.yelpReviews.length ? (
        <div className="mt-5 space-y-3">
          {business.yelpReviews.map((review) => (
            <article
              key={review.id || review.url || review.text}
              className="rounded-2xl border border-line bg-panelAlt/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {review.userName || "Yelp reviewer"}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {review.rating ? `${review.rating}/5 on Yelp` : "Yelp excerpt"}
                    {review.timeCreated ? ` / ${review.timeCreated}` : ""}
                  </p>
                </div>
                {review.url ? (
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
                  >
                    Read on Yelp
                  </a>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                {review.text}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {hours.length ? (
        <div className="mt-5 rounded-2xl border border-line bg-panelAlt/60 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Yelp hours
          </p>
          <div className="mt-3 divide-y divide-line">
            {hours.map((row) => (
              <div
                key={row.day}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="text-stone-200">{row.day}</span>
                <span className="text-right text-stone-400">{row.summary}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {business.yelpLastSyncError ? (
        <p className="mt-4 rounded-xl border border-line bg-canvas/50 px-4 py-3 text-xs leading-6 text-stone-500">
          Sync note: {business.yelpLastSyncError}
        </p>
      ) : null}
    </div>
  );
}
