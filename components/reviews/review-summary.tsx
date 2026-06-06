"use client";

import { StarDisplay } from "@/components/reviews/star-rating";
import { useBusinessReviews } from "@/hooks/use-business-reviews";

/**
 * Compact "★ 4.8 (12 reviews)" badge for business headers and cards.
 * Renders nothing while loading or when there are no reviews yet.
 */
export function BusinessRatingBadge({
  businessId,
  className
}: {
  businessId: string;
  className?: string;
}) {
  const { summary, loading } = useBusinessReviews(businessId);

  if (loading || !summary.count) return null;

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panelAlt/70 px-3 py-1.5">
        <StarDisplay rating={summary.average} />
        <span className="text-sm font-semibold text-ink">{summary.average.toFixed(1)}</span>
        <span className="text-xs text-stone-400">
          ({summary.count} review{summary.count === 1 ? "" : "s"})
        </span>
      </div>
    </div>
  );
}

export function ReviewSummary({
  average,
  count,
  className
}: {
  average: number;
  count: number;
  className?: string;
}) {
  if (!count) {
    return (
      <p className={className}>
        <span className="text-sm text-stone-400">No reviews yet — be the first to share one.</span>
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <StarDisplay rating={average} size="md" />
        <span className="font-display text-lg font-bold text-ink">{average.toFixed(1)}</span>
        <span className="text-sm text-stone-400">
          ({count} review{count === 1 ? "" : "s"})
        </span>
      </div>
    </div>
  );
}
