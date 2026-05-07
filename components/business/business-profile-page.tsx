"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BusinessGallery } from "@/components/business/business-gallery";
import { BusinessTeamSection } from "@/components/business/business-team-section";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { getWeeklyHours } from "@/lib/business-hours";
import { useBusiness } from "@/hooks/use-business";
import { useBusinessTags } from "@/hooks/use-business-tags";
import { useAuth } from "@/components/providers/auth-provider";
import { addLocalRecentView, persistRecentView } from "@/lib/recent-views";
import { BusinessTag } from "@/lib/types";

type BusinessProfilePageProps = {
  businessId: string;
};

export function BusinessProfilePage({ businessId }: BusinessProfilePageProps) {
  const { business, loading, error } = useBusiness(businessId);
  const { tags: businessTags } = useBusinessTags();
  const { user } = useAuth();

  // Track this view: localStorage always, Firebase if signed in
  useEffect(() => {
    if (!business) return;
    addLocalRecentView(business);
    if (user) {
      void persistRecentView(user.uid, business);
    }
  }, [business, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[440px] animate-pulse rounded-2xl border border-line bg-panel/70" />
      </div>
    );
  }

  if (error || !business || !business.active) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <StatePanel
          title="Listing unavailable"
          description="This business profile could not be loaded. It may be inactive, missing, or blocked by your current Firebase rules."
          action={
            <Link
              href="/"
              className="inline-flex rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Return to directory
            </Link>
          }
        />
      </div>
    );
  }

  const weeklyHours = getWeeklyHours(business.hours);
  const hasOnlyClosedHours = weeklyHours.every((day) => day.summary === "Closed");
  const profileTags = business.tags
    .map((slug) => businessTags.find((tag) => tag.slug === slug && tag.active))
    .filter((tag): tag is BusinessTag => Boolean(tag));

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="rounded-2xl border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                {business.category}
              </p>
              <FavoriteButton business={business} className="shrink-0" />
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
              {business.name}
            </h1>
            {business.solidarityMember ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-xs font-semibold text-success">
                  Solidarity Circle Member
                </span>
              </div>
            ) : null}
            {profileTags.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {profileTags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/directory?tag=${encodeURIComponent(tag.slug)}`}
                    className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    {tag.label}
                  </Link>
                ))}
              </div>
            ) : null}
            <p className="mt-5 text-base leading-8 text-stone-300">
              {business.description}
            </p>
          </div>

          <div className="mt-6">
            <BusinessGallery name={business.name} photos={business.photos} />
          </div>

          {business.instagramReelUrl ? (
            <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Featured reel
              </p>
              <p className="mt-4 text-sm leading-8 text-stone-300">
                Open this business&apos;s featured Instagram reel in Instagram for
                full playback, audio, comments, and sharing.
              </p>
              <a
                href={business.instagramReelUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
              >
                Watch on Instagram
              </a>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              About this business
            </p>
            <p className="mt-4 text-sm leading-8 text-stone-300">
              {business.description}
            </p>
          </div>

          <BusinessTeamSection business={business} />

          <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-4 sm:p-5">
            <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Location
            </p>
            <BusinessMap businesses={[business]} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-panel/85 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Contact
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-stone-200">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Address
                </p>
                <p className="mt-1">{business.address}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Phone
                </p>
                <a href={`tel:${business.phone}`} className="mt-1 inline-block hover:text-accentSoft">
                  {business.phone || "Not listed"}
                </a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Website
                </p>
                {business.website ? (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block break-all hover:text-accentSoft"
                  >
                    {business.website}
                  </a>
                ) : (
                  <p className="mt-1">Not listed</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Email
                </p>
                {business.email ? (
                  <a
                    href={`mailto:${business.email}`}
                    className="mt-1 inline-block break-all hover:text-accentSoft"
                  >
                    {business.email}
                  </a>
                ) : (
                  <p className="mt-1">Not listed</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel/85 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Weekly hours
            </p>
            {business.hoursText ? (
              <div className="mt-5 rounded-xl border border-line bg-panelAlt/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Imported hours note
                </p>
                <p className="mt-2 text-sm leading-7 text-stone-300">
                  {business.hoursText}
                </p>
              </div>
            ) : null}
            <div className="mt-5 divide-y divide-line">
              {weeklyHours.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-stone-200">{day.label}</span>
                  <span className="text-stone-400">
                    {hasOnlyClosedHours && business.hoursText
                      ? "See imported hours note"
                      : day.summary}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
