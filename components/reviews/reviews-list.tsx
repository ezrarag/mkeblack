"use client";

import Image from "next/image";
import { useState } from "react";
import { StarDisplay } from "@/components/reviews/star-rating";
import { deleteReview, setReviewStatus } from "@/lib/firebase/reviews";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessReview } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtDate(date: Date | null) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ReviewCard({
  review,
  isOwner,
  isAdmin,
  onEdit
}: {
  review: BusinessReview;
  isOwner: boolean;
  isAdmin: boolean;
  onEdit?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReview(review.id);
    } catch (err) {
      setError(formatFirebaseError(err));
      setBusy(false);
    }
  }

  async function handleModerate(status: "flagged" | "published") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setReviewStatus(review.id, status);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  const tag = review.relatedListingName
    ? { label: `Marketplace: ${review.relatedListingName}` }
    : review.relatedEventName
    ? { label: `Event: ${review.relatedEventName}` }
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-panelAlt/45 p-5",
        review.status === "flagged" ? "border-amber-500/40" : "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{review.authorName}</p>
          <div className="mt-1 flex items-center gap-2">
            <StarDisplay rating={review.rating} />
            <span className="text-xs text-stone-500">{fmtDate(review.createdAt)}</span>
            {review.updatedAt && review.createdAt && review.updatedAt.getTime() !== review.createdAt.getTime() ? (
              <span className="text-xs text-stone-600">(edited)</span>
            ) : null}
          </div>
        </div>
        {review.status === "flagged" ? (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">
            Flagged
          </span>
        ) : null}
      </div>

      {tag ? (
        <span className="mt-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accentSoft">
          {tag.label}
        </span>
      ) : null}

      <p className="mt-3 text-sm leading-7 text-stone-300">{review.text}</p>

      {review.photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((photo) => (
            <a
              key={photo}
              href={photo}
              target="_blank"
              rel="noreferrer"
              className="relative block h-20 w-20 overflow-hidden rounded-xl border border-line transition hover:border-accent/40"
            >
              <Image src={photo} alt="Review photo" fill sizes="80px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}

      {(isOwner || isAdmin) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {isOwner ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
            >
              Edit
            </button>
          ) : null}
          {isOwner || isAdmin ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-rose-400/40 hover:text-rose-400 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleModerate(review.status === "flagged" ? "published" : "flagged")}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-50"
            >
              {review.status === "flagged" ? "Unflag" : "Flag"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewsList({
  reviews,
  selfUid,
  isAdmin,
  onEdit
}: {
  reviews: BusinessReview[];
  selfUid: string | null;
  isAdmin: boolean;
  onEdit?: (review: BusinessReview) => void;
}) {
  const visible = reviews.filter((review) => isAdmin || review.status !== "flagged" || review.authorUid === selfUid);

  if (!visible.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">⭐</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">No reviews yet</p>
        <p className="mt-1 text-sm text-stone-400">
          Be the first to share what you ordered, attended, or experienced here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          isOwner={!!selfUid && review.authorUid === selfUid}
          isAdmin={isAdmin}
          onEdit={onEdit ? () => onEdit(review) : undefined}
        />
      ))}
    </div>
  );
}
