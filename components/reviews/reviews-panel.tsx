"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { useBusinessReviews } from "@/hooks/use-business-reviews";
import { useMyReview } from "@/hooks/use-my-review";
import { BusinessReview } from "@/lib/types";

export function ReviewsPanel({
  businessId,
  businessName,
  isOwnBusiness
}: {
  businessId: string;
  businessName: string;
  /** True when the signed-in person manages this business — they can't review their own listing */
  isOwnBusiness: boolean;
}) {
  const { user, hasAdminAccess } = useAuth();
  const { reviews, summary, loading, error } = useBusinessReviews(businessId);
  const { review: myReview } = useMyReview(businessId, user?.uid ?? null);
  const [composing, setComposing] = useState(false);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(null);

  const canReview = !!user && !isOwnBusiness;
  const formOpen = composing || !!editingReview;

  function closeForm() {
    setComposing(false);
    setEditingReview(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ReviewSummary average={summary.average} count={summary.count} />
        {canReview && !formOpen ? (
          <button
            type="button"
            onClick={() => (myReview ? setEditingReview(myReview) : setComposing(true))}
            className="inline-flex rounded-full border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            {myReview ? "Edit your review" : "Write a review"}
          </button>
        ) : null}
        {!user ? (
          <p className="text-xs text-stone-500">Sign in to leave a review.</p>
        ) : null}
      </div>

      {formOpen && user ? (
        <ReviewForm
          businessId={businessId}
          businessName={businessName}
          authorUid={user.uid}
          authorName={user.displayName || user.email || "MKE Black member"}
          existingReview={editingReview}
          onSaved={closeForm}
          onCancel={closeForm}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-rose-400">{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-panel/60" />
          ))}
        </div>
      ) : (
        <ReviewsList
          reviews={reviews}
          selfUid={user?.uid ?? null}
          isAdmin={hasAdminAccess}
          onEdit={(review) => {
            setComposing(false);
            setEditingReview(review);
          }}
        />
      )}
    </div>
  );
}
