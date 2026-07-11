"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminConfirmDialog, AdminFeedback } from "@/components/admin/admin-action-ui";

type EditState = {
  category: string;
  checkoutMode: "external" | "native";
  orderUrl: string;
};
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import {
  adminUpdateListing,
  deleteMarketplaceListing
} from "@/lib/firebase/marketplace";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { MARKETPLACE_LISTING_CATEGORIES, MarketplaceListing } from "@/lib/types";

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function ListingAdminRow({
  listing,
  onToggleFeatured,
  onToggleAvailable,
  onSaveEdits,
  onDelete,
  deleting,
  updating
}: {
  listing: MarketplaceListing;
  onToggleFeatured: (id: string, val: boolean) => void;
  onToggleAvailable: (id: string, val: boolean) => void;
  onSaveEdits: (id: string, edits: EditState) => void;
  onDelete: (listing: MarketplaceListing) => void;
  deleting: boolean;
  updating: boolean;
}) {
  const [edit, setEdit] = useState<EditState>({
    category: listing.category,
    checkoutMode: listing.checkoutMode,
    orderUrl: listing.orderUrl
  });
  const [dirty, setDirty] = useState(false);

  function updateEdit<K extends keyof EditState>(key: K, val: EditState[K]) {
    setEdit((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  return (
    <div className="rounded-xl border border-line bg-panelAlt/60 p-4">
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-100">{listing.name}</p>
          <Link
            href={`/business/${listing.businessId}`}
            className="text-xs text-accent hover:text-accentSoft"
          >
            {listing.businessName}
          </Link>
          <p className="mt-0.5 text-xs text-stone-500">
            {formatPrice(listing.priceCents)}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {/* Available toggle */}
          <button
            type="button"
            disabled={updating || deleting}
            onClick={() =>
              onToggleAvailable(listing.id, !listing.available)
            }
            className={`min-h-11 rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              listing.available
                ? "border border-success/40 bg-success/10 text-success hover:bg-success/20"
                : "border border-line bg-panelAlt text-stone-500 hover:border-success/30 hover:text-success"
            }`}
          >
            {updating ? "Updating…" : listing.available ? "● Live" : "○ Hidden"}
          </button>

          {/* Featured toggle */}
          <button
            type="button"
            disabled={updating || deleting}
            onClick={() => onToggleFeatured(listing.id, !listing.featured)}
            className={`min-h-11 rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              listing.featured
                ? "border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
                : "border border-line bg-panelAlt text-stone-500 hover:border-accent/30 hover:text-accentSoft"
            }`}
          >
            {listing.featured ? "★ Featured" : "☆ Feature"}
          </button>

          {/* View */}
          <Link
            href={`/marketplace`}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2 text-xs text-stone-400 transition hover:border-accent/30 hover:text-ink"
          >
            View ↗
          </Link>
          <button
            type="button"
            onClick={() => onDelete(listing)}
            disabled={deleting || updating}
            className="min-h-11 rounded-full border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-danger/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Editable fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(12rem,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Category
          </label>
          <select
            disabled={updating || deleting}
            value={edit.category}
            onChange={(e) => updateEdit("category", e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            {MARKETPLACE_LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Checkout
          </label>
          <select
            disabled={updating || deleting}
            value={edit.checkoutMode}
            onChange={(e) =>
              updateEdit("checkoutMode", e.target.value as EditState["checkoutMode"])
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="external">External</option>
            <option value="native">Native</option>
          </select>
        </div>

        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Order URL
          </label>
          <input
            disabled={updating || deleting}
            value={edit.orderUrl}
            onChange={(e) => updateEdit("orderUrl", e.target.value)}
            placeholder="https://…"
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>

        {dirty ? (
          <button
            type="button"
            disabled={updating || deleting}
            onClick={() => {
              onSaveEdits(listing.id, edit);
              setDirty(false);
            }}
            className="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white sm:justify-self-start lg:justify-self-auto"
          >
            {updating ? "Saving…" : "Save"}
          </button>
        ) : null}
      </div>

      {listing.businessSolidarity ? (
        <p className="mt-2 text-[10px] font-semibold text-success">
          ★ Solidarity Circle business
        </p>
      ) : null}
    </div>
  );
}

function AdminMarketplaceContent() {
  const { hasAdminAccess } = useAuth();
  const { listings, loading, error } = useMarketplaceListings({
    adminAll: true,
    availableOnly: false,
    enabled: hasAdminAccess
  });

  const [feedback, setFeedback] = useState<{
    msg: string;
    tone: "success" | "error";
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filterAvailable, setFilterAvailable] = useState<
    "all" | "live" | "hidden"
  >("all");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MarketplaceListing | null>(null);

  const visible = listings.filter((l) => {
    if (
      search.trim() &&
      !l.name.toLowerCase().includes(search.toLowerCase()) &&
      !l.businessName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (filterAvailable === "live" && !l.available) return false;
    if (filterAvailable === "hidden" && l.available) return false;
    if (filterFeatured && !l.featured) return false;
    return true;
  });

  async function handleToggleFeatured(id: string, featured: boolean) {
    setUpdatingId(id);
    try {
      await adminUpdateListing(id, { featured });
      setFeedback({
        msg: featured ? "Listing featured." : "Feature removed.",
        tone: "success"
      });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleAvailable(id: string, available: boolean) {
    setUpdatingId(id);
    try {
      await adminUpdateListing(id, { available });
      setFeedback({
        msg: available ? "Listing set to live." : "Listing hidden.",
        tone: "success"
      });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveEdits(id: string, edits: EditState) {
    setUpdatingId(id);
    try {
      await adminUpdateListing(id, {
        category: edits.category,
        checkoutMode: edits.checkoutMode,
        orderUrl: edits.orderUrl
      });
      setFeedback({ msg: "Changes saved.", tone: "success" });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function confirmDelete() {
    const listing = pendingDelete;
    if (!listing) return;
    setDeletingId(listing.id);
    setFeedback(null);
    try {
      await deleteMarketplaceListing(listing.id, listing.photoUrl);
      setFeedback({ msg: `“${listing.name}” was deleted.`, tone: "success" });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  const cancelDelete = useCallback(() => {
    if (!deletingId) setPendingDelete(null);
  }, [deletingId]);

  const liveCount = listings.filter((l) => l.available).length;
  const featuredCount = listings.filter((l) => l.featured).length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Admin
          </p>
          <h1 className="mt-1 font-display text-4xl font-black text-ink">
            Marketplace
          </h1>

          <div className="mt-5 flex flex-wrap gap-3">
            {[
              { label: "Total listings", value: listings.length },
              { label: "Active listings", value: liveCount },
              { label: "Featured", value: featuredCount }
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-line bg-panelAlt/70 px-5 py-3"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                  {label}
                </p>
                <p className="mt-1.5 font-display text-2xl font-black text-ink">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {feedback ? <AdminFeedback message={feedback.msg} tone={feedback.tone} /> : null}

        {/* Filters */}
        <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto] lg:items-center">
          <input
            type="search"
            placeholder="Search name or business…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
          />

          <select
            value={filterAvailable}
            onChange={(e) =>
              setFilterAvailable(e.target.value as "all" | "live" | "hidden")
            }
            className="min-h-11 w-full rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="all">All status</option>
            <option value="live">Live only</option>
            <option value="hidden">Hidden only</option>
          </select>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={filterFeatured}
              onChange={(e) => setFilterFeatured(e.target.checked)}
              className="accent-accent"
            />
            Featured
          </label>

          <p className="text-xs text-stone-500 lg:ml-auto">
            {visible.length} / {listings.length}
          </p>
        </div>

        {/* Listings */}
        <div className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-line bg-panel/60"
              />
            ))
          ) : error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-10 text-center text-sm text-stone-400">
              No listings match your filters.
            </div>
          ) : (
            visible.map((listing) => (
              <ListingAdminRow
                key={listing.id}
                listing={listing}
                onToggleFeatured={handleToggleFeatured}
                onToggleAvailable={handleToggleAvailable}
                onSaveEdits={handleSaveEdits}
                onDelete={setPendingDelete}
                deleting={deletingId === listing.id}
                updating={updatingId === listing.id}
              />
            ))
          )}
        </div>
        <AdminConfirmDialog
          open={Boolean(pendingDelete)}
          title={`Delete “${pendingDelete?.name ?? "listing"}”?`}
          description="This permanently removes the marketplace listing and its image. This action cannot be undone."
          busy={Boolean(deletingId)}
          onCancel={cancelDelete}
          onConfirm={() => void confirmDelete()}
        />
    </section>
  );
}

export function AdminMarketplacePage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminMarketplaceContent />
    </ProtectedRoute>
  );
}
