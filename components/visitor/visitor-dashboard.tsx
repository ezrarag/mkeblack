"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PendingBusinessSubmissions } from "@/components/dashboard/pending-business-submissions";
import { MessageBusinessButton } from "@/components/messages/message-business-button";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { useBusinesses } from "@/hooks/use-businesses";
import { useFavorites } from "@/hooks/use-favorites";
import { useRecentViews } from "@/hooks/use-recent-views";
import { useSavedMarketplace } from "@/hooks/use-saved-marketplace";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { getFirebaseAuth, loadFirebaseAuthModule } from "@/lib/firebase/client";
import { FavoriteRecord } from "@/lib/firebase/favorites";
import { removeSavedMarketplaceListing } from "@/lib/firebase/saved-marketplace";
import { updateVisitorProfileDetails } from "@/lib/firebase/visitor-profile";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { RecentViewRecord } from "@/lib/recent-views";
import { Business, REFERRAL_SOURCES, SavedMarketplaceListing } from "@/lib/types";

type Tab = "favorites" | "marketplace" | "messages" | "recent" | "account";

function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Contact for price";
  const dollars = priceCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2
  }).format(dollars);
}

function BusinessMiniCard({
  id,
  name,
  category,
  address,
  photoUrl
}: {
  id: string;
  name: string;
  category: string;
  address: string;
  photoUrl: string;
}) {
  return (
    <Link
      href={`/business/${id}`}
      className="group flex items-center gap-3 rounded-xl border border-line bg-panelAlt/60 p-3 transition hover:border-accent/40 hover:bg-accent/10"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-panelAlt font-display text-xl font-black text-stone-500">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink group-hover:text-accent">
          {name}
        </p>
        <p className="text-[11px] text-stone-400">{category}</p>
        <p className="truncate text-[11px] text-stone-500">{address}</p>
      </div>
    </Link>
  );
}

function FavoritesTab({ uid }: { uid: string }) {
  const { favorites, loading } = useFavorites(uid);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-line bg-panel/60"
          />
        ))}
      </div>
    );
  }

  if (!favorites.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">♡</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">
          No favorites yet
        </p>
        <p className="mt-1 text-sm text-stone-400">
          Tap the heart on any business to save it here.
        </p>
        <Link
          href="/directory"
          className="mt-4 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
        >
          Browse the directory
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {favorites.map((fav: FavoriteRecord) => (
        <BusinessMiniCard
          key={fav.businessId}
          id={fav.businessId}
          name={fav.businessName}
          category={fav.businessCategory}
          address={fav.businessAddress}
          photoUrl={fav.businessPhotoUrl}
        />
      ))}
    </div>
  );
}

function RecentTab({ uid }: { uid: string }) {
  const { views, loading } = useRecentViews(uid);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-line bg-panel/60"
          />
        ))}
      </div>
    );
  }

  if (!views.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">👀</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">
          No recent views
        </p>
        <p className="mt-1 text-sm text-stone-400">
          Businesses you visit will appear here automatically.
        </p>
        <Link
          href="/directory"
          className="mt-4 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
        >
          Browse the directory
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {views.map((view: RecentViewRecord) => (
        <BusinessMiniCard
          key={view.businessId}
          id={view.businessId}
          name={view.businessName}
          category={view.businessCategory}
          address={view.businessAddress}
          photoUrl={view.businessPhotoUrl}
        />
      ))}
    </div>
  );
}

function SavedMarketplaceCard({
  uid,
  listing
}: {
  uid: string;
  listing: SavedMarketplaceListing;
}) {
  const [removing, setRemoving] = useState(false);
  const orderHref = listing.orderUrl || `/business/${listing.businessId}`;
  const external = listing.orderUrl ? !listing.orderUrl.startsWith("/") : false;

  async function remove() {
    setRemoving(true);
    try {
      await removeSavedMarketplaceListing(uid, listing.listingId);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panelAlt/60 p-3">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-panel">
          {listing.photoUrl ? (
            <Image
              src={listing.photoUrl}
              alt={listing.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-xl font-black text-stone-500">
              {listing.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/business/${listing.businessId}`}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent transition hover:text-accentSoft"
          >
            {listing.businessName}
          </Link>
          <p className="truncate text-sm font-semibold text-ink">{listing.name}</p>
          <p className="text-[11px] text-stone-400">{listing.category}</p>
          <p className="mt-1 text-xs font-semibold text-stone-200">
            {formatPrice(listing.priceCents)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {external ? (
          <a
            href={orderHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accentSoft"
          >
            Order
          </a>
        ) : (
          <Link
            href={orderHref}
            className="rounded-full border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accentSoft"
          >
            Order
          </Link>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={removing}
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-accent/40 hover:text-ink disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

function SavedMarketplaceTab({ uid }: { uid: string }) {
  const { savedListings, loading } = useSavedMarketplace(uid);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-line bg-panel/60"
          />
        ))}
      </div>
    );
  }

  if (!savedListings.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">$</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">
          No saved marketplace listings
        </p>
        <p className="mt-1 text-sm text-stone-400">
          Save products and services from member businesses to revisit them here.
        </p>
        <Link
          href="/marketplace"
          className="mt-4 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
        >
          Browse marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {savedListings.map((listing) => (
        <SavedMarketplaceCard
          key={listing.listingId}
          uid={uid}
          listing={listing}
        />
      ))}
    </div>
  );
}

function MessageStarterCard({ business }: { business: Business }) {
  return (
    <div className="rounded-xl border border-line bg-panelAlt/60 p-3">
      <div className="flex gap-3">
        <Link
          href={`/business/${business.id}`}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-panel"
        >
          {business.photos[0] ? (
            <Image
              src={business.photos[0]}
              alt={business.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-xl font-black text-stone-500">
              {business.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/business/${business.id}`}
            className="truncate text-sm font-semibold text-ink transition hover:text-accent"
          >
            {business.name}
          </Link>
          <p className="text-[11px] text-stone-400">{business.category}</p>
          <p className="truncate text-[11px] text-stone-500">{business.address}</p>
        </div>
      </div>
      <MessageBusinessButton business={business} className="mt-3" />
    </div>
  );
}

function MessagesTab({
  uid,
  selfName
}: {
  uid: string;
  selfName: string;
}) {
  const { favorites, loading: favoritesLoading } = useFavorites(uid);
  const { views, loading: viewsLoading } = useRecentViews(uid);
  const { businesses, loading: businessesLoading } = useBusinesses();

  const suggestedBusinesses = useMemo(() => {
    const seenIds = [
      ...favorites.map((favorite) => favorite.businessId),
      ...views.map((view) => view.businessId)
    ];
    const orderedIds = Array.from(new Set(seenIds));
    const byId = new Map(businesses.map((business) => [business.id, business]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((business): business is Business => !!business?.solidarityMember)
      .slice(0, 6);
  }, [businesses, favorites, views]);

  const loadingSuggestions = favoritesLoading || viewsLoading || businessesLoading;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-panel/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              Start a conversation
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
              Message a Solidarity Circle business from places you have saved or
              recently viewed.
            </p>
          </div>
          <Link
            href="/directory"
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-stone-300 transition hover:border-accent/40 hover:text-ink"
          >
            Browse directory
          </Link>
        </div>

        {loadingSuggestions ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl border border-line bg-panelAlt/60"
              />
            ))}
          </div>
        ) : suggestedBusinesses.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {suggestedBusinesses.map((business) => (
              <MessageStarterCard key={business.id} business={business} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-panelAlt/40 p-4 text-sm text-stone-400">
            Save or view Solidarity Circle businesses and they will appear here as
            message options.
          </p>
        )}
      </div>

      <MessagesPanel
        side="visitor"
        selfId={uid}
        selfName={selfName}
        threadKey={uid}
      />
    </div>
  );
}

function AboutYouEditor({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? "");
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [referralSource, setReferralSource] = useState(profile?.referralSource ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleInterest(category: string) {
    setInterests((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await updateVisitorProfileDetails(uid, {
        neighborhood: neighborhood.trim() || null,
        interests,
        referralSource: referralSource || null
      });
      setFeedback("Saved — thanks for sharing!");
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panelAlt/60 px-5 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
        About you
      </p>
      <p className="mt-2 text-sm leading-6 text-stone-300">
        Totally optional — sharing this helps MKE Black understand who&rsquo;s
        finding the directory and what to build next. It&rsquo;s never shown
        publicly.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Neighborhood
          </span>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="e.g. Bronzeville, Riverwest…"
            className="mt-2 w-full rounded-xl border border-line bg-panel/70 px-4 py-2.5 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            What are you most interested in?
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {BUSINESS_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => toggleInterest(category)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  interests.includes(category)
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-panel/70 text-stone-300 hover:border-accent/40 hover:text-ink"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            How did you hear about MKE Black?
          </span>
          <select
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-panel/70 px-4 py-2.5 text-sm text-ink transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Prefer not to say</option>
            {REFERRAL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {feedback ? (
            <span className="text-xs text-stone-400">{feedback}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AccountTab({ hasPendingSubmissions }: { hasPendingSubmissions: boolean }) {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);
      if (auth) await authModule.signOut(auth);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panelAlt/60 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Account
        </p>
        <p className="mt-2 font-display text-lg font-bold text-ink">
          {user?.displayName || "MKE Black member"}
        </p>
        {user?.email ? (
          <p className="mt-0.5 text-sm text-stone-400">{user.email}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-panelAlt/60 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Your membership
        </p>
        <p className="mt-2 text-sm text-stone-300">
          {hasPendingSubmissions
            ? "To attach membership to your pending listing, use the Solidarity Circle upgrade action on your business request above."
            : "Support Milwaukee's Black business community by joining the Solidarity Circle."}
        </p>
        {hasPendingSubmissions ? null : (
          <Link
            href="/membership#join"
            className="mt-3 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
          >
            Join Solidarity Circle
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-line bg-panelAlt/60 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Know a business that belongs here?
        </p>
        <p className="mt-2 text-sm text-stone-300">
          If there&rsquo;s a Black-owned business in Milwaukee that isn&rsquo;t in the
          directory yet, send us a quick suggestion — we&rsquo;ll reach out to them.
        </p>
        <Link
          href="/contact?reason=suggest_business"
          className="mt-3 inline-flex rounded-full border border-line bg-panel/70 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-accent/40 hover:text-ink"
        >
          Suggest a business
        </Link>
      </div>

      {user ? <AboutYouEditor uid={user.uid} /> : null}

      <button
        type="button"
        disabled={signingOut}
        onClick={handleSignOut}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent hover:text-white disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

const tabs: { key: Tab; label: string }[] = [
  { key: "favorites", label: "Favorites" },
  { key: "marketplace", label: "Marketplace" },
  { key: "messages", label: "Messages" },
  { key: "recent", label: "Recently viewed" },
  { key: "account", label: "Account" }
];

const TAB_KEYS = tabs.map((tab) => tab.key);

function isValidTab(value: string | null): value is Tab {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

export function VisitorDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    isValidTab(requestedTab) ? requestedTab : "favorites"
  );

  useEffect(() => {
    if (isValidTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);
  const [hasPendingSubmissions, setHasPendingSubmissions] = useState(false);
  const handlePendingSubmissionsChange = useCallback((hasPending: boolean) => {
    setHasPendingSubmissions(hasPending);
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
        My MKE Black
      </p>
      <h1 className="mt-1 font-display text-3xl font-black text-ink">
        {hasPendingSubmissions
          ? "Business request pending"
          : user.displayName
          ? `Hi, ${user.displayName.split(" ")[0]}`
          : "My dashboard"}
      </h1>

      <PendingBusinessSubmissions
        onHasPendingChange={handlePendingSubmissionsChange}
      />

      <div className="mt-6 flex gap-1 rounded-full border border-line bg-panelAlt/60 p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
              activeTab === key
                ? "bg-accent text-white"
                : "text-stone-400 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "favorites" && <FavoritesTab uid={user.uid} />}
        {activeTab === "marketplace" && <SavedMarketplaceTab uid={user.uid} />}
        {activeTab === "messages" && (
          <MessagesTab
            uid={user.uid}
            selfName={user.displayName || user.email || "MKE Black member"}
          />
        )}
        {activeTab === "recent" && <RecentTab uid={user.uid} />}
        {activeTab === "account" && (
          <AccountTab hasPendingSubmissions={hasPendingSubmissions} />
        )}
      </div>
    </div>
  );
}
