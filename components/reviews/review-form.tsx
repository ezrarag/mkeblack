"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { StarPicker } from "@/components/reviews/star-rating";
import { useBusinessEvents } from "@/hooks/use-business-events";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import { submitReview, uploadReviewPhotos } from "@/lib/firebase/reviews";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessReview } from "@/lib/types";
import { cn } from "@/lib/utils";

type TagOption = {
  key: string;
  label: string;
  kind: "listing" | "event";
  id: string;
  name: string;
};

export function ReviewForm({
  businessId,
  businessName,
  authorUid,
  authorName,
  existingReview,
  onSaved,
  onCancel
}: {
  businessId: string;
  businessName: string;
  authorUid: string;
  authorName: string;
  existingReview: BusinessReview | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { listings } = useMarketplaceListings({ businessId, availableOnly: true });
  const { events } = useBusinessEvents({ businessId, publishedOnly: true });

  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [text, setText] = useState(existingReview?.text ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [tagKey, setTagKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingReview) return;
    setRating(existingReview.rating);
    setText(existingReview.text);
    if (existingReview.relatedListingId) {
      setTagKey(`listing:${existingReview.relatedListingId}`);
    } else if (existingReview.relatedEventId) {
      setTagKey(`event:${existingReview.relatedEventId}`);
    }
  }, [existingReview]);

  const tagOptions: TagOption[] = [
    ...listings.map((listing) => ({
      key: `listing:${listing.id}`,
      label: `Marketplace — ${listing.name}`,
      kind: "listing" as const,
      id: listing.id,
      name: listing.name
    })),
    ...events.map((event) => ({
      key: `event:${event.id}`,
      label: `Event — ${event.title}`,
      kind: "event" as const,
      id: event.id,
      name: event.title
    }))
  ];

  const selectedTag = tagOptions.find((option) => option.key === tagKey) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!text.trim()) {
      setError("Add a few words about your experience.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const uploaded = files.length
        ? await uploadReviewPhotos(businessId, authorUid, files)
        : [];
      const photos = [...(existingReview?.photos ?? []), ...uploaded];

      await submitReview({
        businessId,
        businessName,
        authorUid,
        authorName,
        rating,
        text,
        photos,
        relatedListingId: selectedTag?.kind === "listing" ? selectedTag.id : null,
        relatedListingName: selectedTag?.kind === "listing" ? selectedTag.name : null,
        relatedEventId: selectedTag?.kind === "event" ? selectedTag.id : null,
        relatedEventName: selectedTag?.kind === "event" ? selectedTag.name : null
      });

      setFiles([]);
      onSaved?.();
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panelAlt/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        {existingReview ? "Edit your review" : "Write a review"}
      </p>

      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          Your rating
        </label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          Your review
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What did you order, attend, or experience? Would you recommend it to others?"
          className="w-full resize-none rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {tagOptions.length ? (
        <div className="mt-4">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
            Tag a product or event (optional)
          </label>
          <select
            value={tagKey}
            onChange={(e) => setTagKey(e.target.value)}
            className="w-full rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm text-ink transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Just a general review</option>
            {tagOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          Add photos (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-stone-300 file:mr-4 file:rounded-full file:border file:border-accent/40 file:bg-accent/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-accentSoft file:transition hover:file:bg-accent/15"
        />
        {existingReview?.photos.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {existingReview.photos.map((photo) => (
              <div key={photo} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
                <Image src={photo} alt="Review photo" fill sizes="64px" className="object-cover" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
          )}
        >
          {saving ? "Saving…" : existingReview ? "Save changes" : "Post review"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
