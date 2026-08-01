"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminConfirmDialog,
  AdminFeedback
} from "@/components/admin/admin-action-ui";
import { useMarketplaceListings } from "@/hooks/use-marketplace-listings";
import { MarketplaceListingCard } from "@/components/marketplace/marketplace-listing-card";
import { MarketplaceStorefrontCard } from "@/components/marketplace/marketplace-storefront-card";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinesses } from "@/hooks/use-businesses";
import { StatePanel } from "@/components/ui/state-panel";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { deleteMarketplaceListing } from "@/lib/firebase/marketplace";
import {
  MARKETPLACE_LISTING_CATEGORIES,
  MarketplaceListing
} from "@/lib/types";

type PriceRange = "any" | "free" | "under25" | "25to100" | "over100";
type MarketplaceView = "products" | "businesses";

const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  any: "Any price",
  free: "Free / Contact",
  under25: "Under $25",
  "25to100": "$25 – $100",
  over100: "Over $100"
};

function matchesPriceRange(priceCents: number, range: PriceRange): boolean {
  if (range === "any") return true;
  if (range === "free") return priceCents === 0;
  if (range === "under25") return priceCents > 0 && priceCents < 2500;
  if (range === "25to100")
    return priceCents >= 2500 && priceCents <= 10000;
  if (range === "over100") return priceCents > 10000;
  return true;
}

export function MarketplacePage() {
  const { hasAdminAccess } = useAuth();
  const { listings, loading, error } = useMarketplaceListings({
    availableOnly: true
  });
  const {
    businesses,
    loading: businessesLoading,
    error: businessesError
  } = useBusinesses();

  const [view, setView] = useState<MarketplaceView>("products");
  const [category, setCategory] = useState("all");
  const [priceRange, setPriceRange] = useState<PriceRange>("any");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [businessSearch, setBusinessSearch] = useState("");
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<
    Set<string>
  >(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<MarketplaceListing | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (optimisticallyRemovedIds.has(l.id)) return false;
      if (category !== "all" && l.category !== category) return false;
      if (!matchesPriceRange(l.priceCents, priceRange)) return false;
      if (featuredOnly && !l.featured) return false;
      if (
        businessSearch.trim() &&
        !l.businessName
          .toLowerCase()
          .includes(businessSearch.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [
    listings,
    category,
    priceRange,
    featuredOnly,
    businessSearch,
    optimisticallyRemovedIds
  ]);

  const storefronts = useMemo(() => {
    const listingsByBusiness = new Map<string, MarketplaceListing[]>();
    for (const listing of filtered) {
      const current = listingsByBusiness.get(listing.businessId) ?? [];
      current.push(listing);
      listingsByBusiness.set(listing.businessId, current);
    }

    return businesses
      .filter((business) => business.solidarityMember && listingsByBusiness.has(business.id))
      .map((business) => ({
        business,
        listings: listingsByBusiness.get(business.id) ?? []
      }));
  }, [businesses, filtered]);

  const cancelDelete = useCallback(() => {
    if (!deletingId) setPendingDelete(null);
  }, [deletingId]);

  async function confirmDelete() {
    const listing = pendingDelete;
    if (!listing || !hasAdminAccess) return;

    setDeletingId(listing.id);
    setPendingDelete(null);
    setDeleteFeedback(null);
    setOptimisticallyRemovedIds((current) => {
      const next = new Set(current);
      next.add(listing.id);
      return next;
    });

    try {
      await deleteMarketplaceListing(listing.id, listing.photoUrl);
      setDeleteFeedback({
        message: `“${listing.name}” was deleted.`,
        tone: "success"
      });
    } catch (deleteError) {
      // Roll the optimistic removal back so the admin can retry.
      setOptimisticallyRemovedIds((current) => {
        const next = new Set(current);
        next.delete(listing.id);
        return next;
      });
      setDeleteFeedback({
        message: formatFirebaseError(deleteError),
        tone: "error"
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Firebase not configured"
          description="Add your Firebase environment variables in .env.local to load marketplace listings."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          MKE Black
        </p>
        <h1 className="mt-2 font-display text-4xl font-black text-ink sm:text-5xl">
          Marketplace
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
          Products and services from Milwaukee&apos;s Black-owned businesses.
          Click &ldquo;Order&rdquo; to purchase directly from the business.
        </p>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-line bg-panel/80 p-1" aria-label="Marketplace view">
        {(["products", "businesses"] as MarketplaceView[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${
              view === option
                ? "bg-accent text-white"
                : "text-stone-400 hover:text-ink"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {deleteFeedback ? (
        <AdminFeedback
          message={deleteFeedback.message}
          tone={deleteFeedback.tone}
        />
      ) : null}

      {/* ── Filters ── */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-4">
        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="all">All categories</option>
            {MARKETPLACE_LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Price range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Price
          </label>
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value as PriceRange)}
            className="rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            {(Object.keys(PRICE_RANGE_LABELS) as PriceRange[]).map((k) => (
              <option key={k} value={k}>
                {PRICE_RANGE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {/* Business search */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Business
          </label>
          <input
            type="search"
            placeholder="Search by business…"
            value={businessSearch}
            onChange={(e) => setBusinessSearch(e.target.value)}
            className="w-48 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>

        {/* Featured only */}
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-stone-300 transition hover:border-accent/40">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
            className="accent-accent"
          />
          Featured only
        </label>

        {/* Result count */}
        {!loading && !businessesLoading && (
          <p className="ml-auto text-xs text-stone-500">
            {view === "products"
              ? `${filtered.length} listing${filtered.length !== 1 ? "s" : ""}`
              : `${storefronts.length} storefront${storefronts.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* ── Content ── */}
      {error || (view === "businesses" && businessesError) ? (
        <div className="mt-6">
          <StatePanel
            title="Unable to load marketplace"
            description={error ?? businessesError ?? "Please try again."}
          />
        </div>
      ) : loading || (view === "businesses" && businessesLoading) ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-2xl border border-line bg-panel/60"
            />
          ))}
        </div>
      ) : !filtered.length || (view === "businesses" && !storefronts.length) ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-12 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {listings.length === 0
              ? "No listings yet"
              : "No listings match your filters"}
          </p>
          <p className="mt-2 text-sm text-stone-400">
            {listings.length === 0
              ? "Member businesses haven't added marketplace listings yet. Check back soon."
              : "Try adjusting your filters to find what you're looking for."}
          </p>
          {listings.length === 0 ? (
            <Link
              href="/dashboard?tab=marketplace"
              className="mt-4 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Add a listing
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setPriceRange("any");
                setFeaturedOnly(false);
                setBusinessSearch("");
              }}
              className="mt-4 rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : view === "products" ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((listing) => (
            <MarketplaceListingCard
              key={listing.id}
              listing={listing}
              showAdminDelete={hasAdminAccess}
              deleting={deletingId === listing.id}
              onRequestDelete={setPendingDelete}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map(({ business, listings: businessListings }) => (
            <MarketplaceStorefrontCard
              key={business.id}
              business={business}
              listings={businessListings}
            />
          ))}
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.name ?? "listing"}”?`}
        description="This permanently removes the marketplace listing. Its image will also be removed when storage permissions allow it. This action cannot be undone."
        busy={Boolean(deletingId)}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
