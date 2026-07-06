"use client";

import Link from "next/link";
import { useState } from "react";

type EditState = {
  category: string;
  checkoutMode: "external" | "native";
  orderUrl: string;
};
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import { adminUpdateListing } from "@/lib/firebase/marketplace";
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
  onSaveEdits
}: {
  listing: MarketplaceListing;
  onToggleFeatured: (id: string, val: boolean) => void;
  onToggleAvailable: (id: string, val: boolean) => void;
  onSaveEdits: (id: string, edits: EditState) => void;
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Available toggle */}
          <button
            type="button"
            onClick={() =>
              onToggleAvailable(listing.id, !listing.available)
            }
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              listing.available
                ? "border border-success/40 bg-success/10 text-success hover:bg-success/20"
                : "border border-line bg-panelAlt text-stone-500 hover:border-success/30 hover:text-success"
            }`}
          >
            {listing.available ? "● Live" : "○ Hidden"}
          </button>

          {/* Featured toggle */}
          <button
            type="button"
            onClick={() => onToggleFeatured(listing.id, !listing.featured)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
            className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-400 transition hover:border-accent/30 hover:text-ink"
          >
            View ↗
          </Link>
        </div>
      </div>

      {/* Editable fields */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Category
          </label>
          <select
            value={edit.category}
            onChange={(e) => updateEdit("category", e.target.value)}
            className="mt-1 rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5 text-xs text-ink focus:border-accent/60 focus:outline-none"
          >
            {MARKETPLACE_LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Checkout
          </label>
          <select
            value={edit.checkoutMode}
            onChange={(e) =>
              updateEdit("checkoutMode", e.target.value as EditState["checkoutMode"])
            }
            className="mt-1 rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5 text-xs text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="external">External</option>
            <option value="native">Native</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Order URL
          </label>
          <input
            value={edit.orderUrl}
            onChange={(e) => updateEdit("orderUrl", e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5 text-xs text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>

        {dirty ? (
          <button
            type="button"
            onClick={() => {
              onSaveEdits(listing.id, edit);
              setDirty(false);
            }}
            className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
          >
            Save
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
    try {
      await adminUpdateListing(id, { featured });
      setFeedback({
        msg: featured ? "Listing featured." : "Feature removed.",
        tone: "success"
      });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    }
  }

  async function handleToggleAvailable(id: string, available: boolean) {
    try {
      await adminUpdateListing(id, { available });
      setFeedback({
        msg: available ? "Listing set to live." : "Listing hidden.",
        tone: "success"
      });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    }
  }

  async function handleSaveEdits(id: string, edits: EditState) {
    try {
      await adminUpdateListing(id, {
        category: edits.category,
        checkoutMode: edits.checkoutMode,
        orderUrl: edits.orderUrl
      });
      setFeedback({ msg: "Changes saved.", tone: "success" });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    }
  }

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
              { label: "Live", value: liveCount },
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
        {feedback ? (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border border-success/35 bg-success/10 text-stone-100"
                : "border border-danger/35 bg-danger/10 text-rose-300"
            }`}
          >
            {feedback.msg}
          </div>
        ) : null}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-4">
          <input
            type="search"
            placeholder="Search name or business…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
          />

          <select
            value={filterAvailable}
            onChange={(e) =>
              setFilterAvailable(e.target.value as "all" | "live" | "hidden")
            }
            className="rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="all">All status</option>
            <option value="live">Live only</option>
            <option value="hidden">Hidden only</option>
          </select>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={filterFeatured}
              onChange={(e) => setFilterFeatured(e.target.checked)}
              className="accent-accent"
            />
            Featured
          </label>

          <p className="ml-auto text-xs text-stone-500">
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
              />
            ))
          )}
        </div>
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
