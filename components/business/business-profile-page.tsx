"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BusinessGallery } from "@/components/business/business-gallery";
import { BusinessTeamSection } from "@/components/business/business-team-section";
import { YelpHighlightsPanel } from "@/components/business/yelp-highlights-panel";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { MessageBusinessButton } from "@/components/messages/message-business-button";
import { ReviewsPanel } from "@/components/reviews/reviews-panel";
import { BusinessGroupsPanel } from "@/components/groups/business-groups-panel";
import { BusinessRatingBadge } from "@/components/reviews/review-summary";
import { getWeeklyHours } from "@/lib/business-hours";
import { useBusiness } from "@/hooks/use-business";
import { useBusinessTags } from "@/hooks/use-business-tags";
import { useAuth } from "@/components/providers/auth-provider";
import { addLocalRecentView, persistRecentView } from "@/lib/recent-views";
import { BusinessTag, YelpHoursPeriod } from "@/lib/types";

// Yelp day numbers: 0=Mon … 6=Sun
const YELP_DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatYelpTime(time: string): string {
  const h = parseInt(time.slice(0, 2), 10);
  const m = time.slice(2);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m} ${period}`;
}

function buildYelpWeeklyDisplay(periods: YelpHoursPeriod[]) {
  const byDay = new Map<number, YelpHoursPeriod[]>();
  for (const period of periods) {
    if (!byDay.has(period.day)) byDay.set(period.day, []);
    byDay.get(period.day)!.push(period);
  }
  return YELP_DAY_LABELS.map((label, index) => {
    const dayPeriods = byDay.get(index) ?? [];
    if (!dayPeriods.length) return { label, summary: "Closed" };
    const summaries = dayPeriods.map((p) =>
      p.isOvernight
        ? `${formatYelpTime(p.start)} – overnight`
        : `${formatYelpTime(p.start)} – ${formatYelpTime(p.end)}`
    );
    return { label, summary: summaries.join(", ") };
  });
}
import {
  BusinessReportReason,
  submitBusinessReport
} from "@/lib/firebase/business-reports";
import { formatFirebaseError } from "@/lib/firebase-errors";

type BusinessProfilePageProps = {
  businessId: string;
};

export function BusinessProfilePage({ businessId }: BusinessProfilePageProps) {
  const { business, loading, error } = useBusiness(businessId);
  const { tags: businessTags } = useBusinessTags();
  const { user, profile, hasAdminAccess } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<BusinessReportReason>("Business has closed");
  const [reportComment, setReportComment] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagFeedback, setFlagFeedback] = useState<string | null>(null);

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

  const hasYelpHours = business.yelpHours.length > 0;
  const weeklyHours = hasYelpHours
    ? buildYelpWeeklyDisplay(business.yelpHours)
    : getWeeklyHours(business.hours);
  const hasOnlyClosedHours = !hasYelpHours && weeklyHours.every((day) => day.summary === "Closed");
  const profileTags = business.tags
    .map((slug) => businessTags.find((tag) => tag.slug === slug && tag.active))
    .filter((tag): tag is BusinessTag => Boolean(tag));
  const isOwner = !!user && business.ownerUid === user.uid;
  const claimHref = user
    ? "/dashboard"
    : `/login?next=${encodeURIComponent("/dashboard")}`;
  const reportReasons: BusinessReportReason[] = [
    "Business has closed",
    "Wrong hours",
    "Wrong address/phone",
    "Other"
  ];
  const actionLinks = [
    business.website
      ? { href: business.website, label: "Website", external: true }
      : null,
    business.yelpUrl
      ? { href: business.yelpUrl, label: "Yelp", external: true }
      : null,
    business.googleMapsUrl
      ? { href: business.googleMapsUrl, label: "Directions", external: true }
      : null,
    business.instagramReelUrl
      ? { href: business.instagramReelUrl, label: "Instagram", external: true }
      : null,
    business.phone ? { href: `tel:${business.phone}`, label: "Call" } : null,
    business.email ? { href: `mailto:${business.email}`, label: "Email" } : null
  ].filter(
    (item): item is { href: string; label: string; external?: boolean } =>
      Boolean(item)
  );

  async function handleFlagForUpdate() {
    if (!business || flagSubmitting) return;
    setFlagSubmitting(true);
    setFlagFeedback(null);
    try {
      await submitBusinessReport({
        businessId: business.id,
        businessName: business.name,
        reason: "Needs updating",
        comment: "",
        reporterEmail: profile?.email ?? user?.email ?? ""
      });
      setFlagFeedback("Flagged — thanks for keeping the directory accurate.");
    } catch (err) {
      setFlagFeedback(formatFirebaseError(err));
    } finally {
      setFlagSubmitting(false);
    }
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setReportSubmitting(true);
    setReportFeedback(null);

    try {
      await submitBusinessReport({
        businessId: business.id,
        businessName: business.name,
        reason: reportReason,
        comment: reportComment,
        reporterEmail
      });
      setReportComment("");
      setReporterEmail("");
      setReportFeedback("Thanks. MKE Black will review this report.");
    } catch (err) {
      setReportFeedback(formatFirebaseError(err));
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="rounded-2xl border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                  {business.category}
                </p>
                {business.onlineBased ? (
                  <span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accentSoft">
                    Online-based
                  </span>
                ) : null}
              </div>
              <FavoriteButton business={business} className="shrink-0" />
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
              {business.name}
            </h1>
            <BusinessRatingBadge businessId={business.id} className="mt-3" />
            {business.solidarityMember ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-xs font-semibold text-success">
                    Solidarity Circle Member
                  </span>
                </div>
                <MessageBusinessButton business={business} />
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
            <div className="mt-6 flex flex-wrap gap-2">
              {actionLinks.map((link) =>
                link.external ? (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-accent/40 hover:text-ink"
                  >
                    {link.label}
                  </a>
                ) : (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-accent/40 hover:text-ink"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
              {!business.ownerUid ? (
                <Link
                  href={claimHref}
                  className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
                >
                  Own this business? Claim this listing
                </Link>
              ) : null}
              {isOwner ? (
                <Link
                  href="/dashboard"
                  className="rounded-full border border-accent/35 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accentSoft transition hover:bg-accent/15"
                >
                  Edit listing
                </Link>
              ) : null}
              {hasAdminAccess ? (
                <Link
                  href={`/admin/businesses/${business.id}`}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
                >
                  Edit as admin
                </Link>
              ) : null}
            </div>
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

          <BusinessGroupsPanel businessId={business.id} businessName={business.name} />

          <YelpHighlightsPanel business={business} />

          <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Reviews
            </p>
            <div className="mt-5">
              <ReviewsPanel
                businessId={business.id}
                businessName={business.name}
                isOwnBusiness={!!profile?.businessId && profile.businessId === business.id}
              />
            </div>
          </div>

          {!business.onlineBased ? (
            <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-4 sm:p-5">
              <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Location
              </p>
              <BusinessMap businesses={[business]} />
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={flagSubmitting || !!flagFeedback}
                onClick={() => void handleFlagForUpdate()}
                className="rounded-full border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {flagSubmitting ? "Flagging…" : "Flag info as outdated"}
              </button>
              {flagFeedback ? (
                <p className="text-sm text-stone-400">{flagFeedback}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setReportOpen((current) => !current);
                setReportFeedback(null);
              }}
              className="mt-4 text-sm font-semibold text-stone-500 underline underline-offset-4 transition hover:text-accentSoft"
            >
              Report an issue
            </button>
            {reportOpen ? (
              <form className="mt-5 space-y-4" onSubmit={handleReportSubmit}>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(event) =>
                      setReportReason(event.target.value as BusinessReportReason)
                    }
                  >
                    {reportReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Comment
                  </label>
                  <textarea
                    value={reportComment}
                    onChange={(event) => setReportComment(event.target.value)}
                    rows={3}
                    placeholder="Add anything the admin team should know."
                    className="w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder:text-stone-500 focus:border-accent/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Email
                  </label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(event) => setReporterEmail(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                {reportFeedback ? (
                  <p className="rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-200">
                    {reportFeedback}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                >
                  {reportSubmitting ? "Sending..." : "Send report"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-panel/85 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Contact
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-stone-200">
              {business.onlineBased ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Location</p>
                  <p className="mt-1 font-medium text-accentSoft">Online-based business</p>
                  <p className="mt-0.5 text-xs text-stone-500">No physical storefront</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">
                    Address
                  </p>
                  <p className="mt-1">{business.address}</p>
                </div>
              )}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Weekly hours
              </p>
              {hasYelpHours ? (
                <span className="rounded-full border border-[#d32323]/30 bg-[#d32323]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff6347]">
                  Synced from Yelp
                </span>
              ) : null}
            </div>
            {!hasYelpHours && business.hoursText ? (
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
                  key={day.label}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-stone-200">{day.label}</span>
                  <span className="text-stone-400">
                    {!hasYelpHours && hasOnlyClosedHours && business.hoursText
                      ? "See imported hours note"
                      : day.summary}
                  </span>
                </div>
              ))}
            </div>
            {hasYelpHours && business.yelpLastSyncedAt ? (
              <p className="mt-4 text-[11px] text-stone-600">
                Last synced {business.yelpLastSyncedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
