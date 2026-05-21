"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import {
  deleteMarketplaceListing,
  saveMarketplaceListing,
  uploadMarketplaceListingPhoto
} from "@/lib/firebase/marketplace";
import { formatFirebaseError } from "@/lib/firebase-errors";
import {
  MARKETPLACE_LISTING_CATEGORIES,
  MarketplaceListing,
  MarketplaceListingFormValues
} from "@/lib/types";

type BusinessMarketplaceManagerProps = {
  businessId: string;
  businessName: string;
  isSolidarityMember: boolean;
};

const EMPTY_FORM: MarketplaceListingFormValues = {
  name: "",
  description: "",
  priceCents: 0,
  photoUrl: "",
  category: "Other",
  available: true,
  orderUrl: ""
};

function priceDisplay(cents: number) {
  if (cents === 0) return "Free / Contact";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function ListingRow({
  listing,
  onEdit,
  onDelete
}: {
  listing: MarketplaceListing;
  onEdit: (l: MarketplaceListing) => void;
  onDelete: (l: MarketplaceListing) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line bg-panelAlt/60 p-4">
      {listing.photoUrl ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
          <Image
            src={listing.photoUrl}
            alt={listing.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas/50 font-display text-xl font-black text-stone-600">
          {listing.name.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-stone-100">{listing.name}</p>
            <p className="text-xs text-stone-500">{listing.category}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                listing.available
                  ? "border border-success/40 bg-success/10 text-success"
                  : "border border-line bg-panelAlt text-stone-500"
              }`}
            >
              {listing.available ? "Live" : "Hidden"}
            </span>
            {listing.featured ? (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">
                ★ Featured
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm font-semibold text-accentSoft">
          {priceDisplay(listing.priceCents)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(listing)}
          className="rounded-lg border border-line bg-panelAlt/60 px-3 py-1.5 text-xs text-stone-200 transition hover:border-accent/40 hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(listing)}
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-danger/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function BusinessMarketplaceManager({
  businessId,
  businessName,
  isSolidarityMember
}: BusinessMarketplaceManagerProps) {
  const { listings, loading } = useMarketplaceListings({ businessId });

  const [editing, setEditing] = useState<string | null>(null); // null = new, id = edit
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MarketplaceListingFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    msg: string;
    tone: "success" | "error";
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MarketplaceListing | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Upgrade CTA if not a Solidarity Member ──────────────────────────────
  if (!isSolidarityMember) {
    return (
      <div className="rounded-2xl border border-line bg-panel/80 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Marketplace
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink">
          Solidarity Circle members only
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-300">
          The marketplace is available exclusively to MKE Black Solidarity Circle
          members. Join to list your products and services directly in front of
          people looking to support Black-owned businesses.
        </p>
        <Link
          href="/membership"
          className="mt-5 inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
        >
          Upgrade to Solidarity Circle
        </Link>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  }

  function openEdit(listing: MarketplaceListing) {
    setEditing(listing.id);
    setForm({
      name: listing.name,
      description: listing.description,
      priceCents: listing.priceCents,
      photoUrl: listing.photoUrl,
      category: listing.category,
      available: listing.available,
      orderUrl: listing.orderUrl
    });
    setFeedback(null);
    setFormOpen(true);
  }

  function updateField<K extends keyof MarketplaceListingFormValues>(
    key: K,
    value: MarketplaceListingFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const url = await uploadMarketplaceListingPhoto(businessId, file);
      updateField("photoUrl", url);
    } catch (err) {
      setFeedback({
        msg: formatFirebaseError(err),
        tone: "error"
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveMarketplaceListing(
        businessId,
        businessName,
        isSolidarityMember,
        editing,
        form
      );
      setFeedback({
        msg: editing ? "Listing updated." : "Listing created!",
        tone: "success"
      });
      setFormOpen(false);
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(listing: MarketplaceListing) {
    try {
      await deleteMarketplaceListing(listing.id, listing.photoUrl);
      setConfirmDelete(null);
      setFeedback({ msg: "Listing deleted.", tone: "success" });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel/80 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Marketplace
          </p>
          <p className="mt-1 text-sm text-stone-400">
            List products or services visitors can order directly.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft"
        >
          + Add listing
        </button>
      </div>

      {/* Feedback banner */}
      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border border-success/35 bg-success/10 text-stone-100"
              : "border border-danger/35 bg-danger/10 text-rose-300"
          }`}
        >
          {feedback.msg}
        </div>
      ) : null}

      {/* Inline form */}
      {formOpen ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-accent/30 bg-panel/80 p-5"
        >
          <p className="font-display text-lg font-bold text-ink">
            {editing ? "Edit listing" : "New listing"}
          </p>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-stone-400">
              Name <span className="text-accent">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Natural hair consultation"
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-stone-400">
              Description{" "}
              <span className="text-stone-600">
                ({form.description.length}/600)
              </span>
            </label>
            <textarea
              rows={3}
              maxLength={600}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What are you offering?"
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
            />
          </div>

          {/* Price + Category */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Price (USD) — enter 0 for free / contact
              </label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceCents === 0 ? "" : (form.priceCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const dollars = parseFloat(e.target.value) || 0;
                    updateField("priceCents", Math.round(dollars * 100));
                  }}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-line bg-canvas/60 py-2.5 pl-7 pr-4 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-400">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              >
                {MARKETPLACE_LISTING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Order URL */}
          <div>
            <label className="block text-xs font-medium text-stone-400">
              Order / purchase URL{" "}
              <span className="text-stone-600">
                (leave blank to link to your business profile)
              </span>
            </label>
            <input
              type="url"
              value={form.orderUrl}
              onChange={(e) => updateField("orderUrl", e.target.value)}
              placeholder="https://shop.yourbusiness.com/product"
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-stone-400">
              Photo
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {form.photoUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
                  <Image
                    src={form.photoUrl}
                    alt="Listing photo"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-line bg-panelAlt/60 px-4 py-2 text-sm text-stone-300 transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
              >
                {uploading ? "Uploading…" : form.photoUrl ? "Replace photo" : "Upload photo"}
              </button>
              {form.photoUrl ? (
                <button
                  type="button"
                  onClick={() => updateField("photoUrl", "")}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Remove
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Available toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => updateField("available", e.target.checked)}
              className="accent-accent"
            />
            <span className="text-sm text-stone-300">
              Visible in marketplace (uncheck to hide temporarily)
            </span>
          </label>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Create listing"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-stone-300 transition hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* Delete confirmation */}
      {confirmDelete ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
          <p className="font-medium text-stone-100">
            Delete &ldquo;{confirmDelete.name}&rdquo;?
          </p>
          <p className="mt-1 text-sm text-stone-400">
            This will permanently remove the listing and its photo.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleDelete(confirmDelete)}
              className="rounded-full border border-danger bg-danger/20 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-danger/30"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-full border border-line px-4 py-2 text-sm text-stone-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Listings */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-line bg-panel/60"
            />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold text-ink">
            No listings yet
          </p>
          <p className="mt-1 text-sm text-stone-400">
            Add your first product or service to appear in the marketplace.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
