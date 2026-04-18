"use client";

import Link from "next/link";
import { BusinessGallery } from "@/components/business/business-gallery";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { getWeeklyHours } from "@/lib/business-hours";
import { useBusiness } from "@/hooks/use-business";

type BusinessProfilePageProps = {
  businessId: string;
};

export function BusinessProfilePage({ businessId }: BusinessProfilePageProps) {
  const { business, loading, error } = useBusiness(businessId);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[440px] animate-pulse rounded-[2.4rem] border border-line bg-panel/70" />
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
              className="inline-flex rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
            >
              Return to directory
            </Link>
          }
        />
      </div>
    );
  }

  const weeklyHours = getWeeklyHours(business.hours);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="rounded-[2.4rem] border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
            <p className="text-sm uppercase tracking-[0.26em] text-accentSoft">
              {business.category}
            </p>
            <h1 className="mt-4 font-display text-5xl leading-none text-ink sm:text-6xl">
              {business.name}
            </h1>
            <p className="mt-5 text-base leading-8 text-stone-300">
              {business.description}
            </p>
          </div>

          <div className="mt-6">
            <BusinessGallery name={business.name} photos={business.photos} />
          </div>

          <div className="mt-6 rounded-[2.4rem] border border-line bg-panel/80 p-6">
            <p className="text-sm uppercase tracking-[0.26em] text-accentSoft">
              About this business
            </p>
            <p className="mt-4 text-sm leading-8 text-stone-300">
              {business.description}
            </p>
          </div>

          <div className="mt-6 rounded-[2.4rem] border border-line bg-panel/80 p-4 sm:p-5">
            <p className="mb-4 px-2 text-sm uppercase tracking-[0.26em] text-accentSoft">
              Location
            </p>
            <BusinessMap businesses={[business]} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2.4rem] border border-line bg-panel/85 p-6">
            <p className="text-sm uppercase tracking-[0.26em] text-accentSoft">
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
            </div>
          </div>

          <div className="rounded-[2.4rem] border border-line bg-panel/85 p-6">
            <p className="text-sm uppercase tracking-[0.26em] text-accentSoft">
              Weekly hours
            </p>
            <div className="mt-5 divide-y divide-line">
              {weeklyHours.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-stone-200">{day.label}</span>
                  <span className="text-stone-400">{day.summary}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
