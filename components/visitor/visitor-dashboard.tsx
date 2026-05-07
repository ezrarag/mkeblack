"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useFavorites } from "@/hooks/use-favorites";
import { useRecentViews } from "@/hooks/use-recent-views";
import { getFirebaseAuth, loadFirebaseAuthModule } from "@/lib/firebase/client";
import { FavoriteRecord } from "@/lib/firebase/favorites";
import { RecentViewRecord } from "@/lib/recent-views";

type Tab = "favorites" | "recent" | "account";

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

function AccountTab() {
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
        <p className="mt-3 text-xs text-stone-500">
          UID: <span className="font-mono">{user?.uid}</span>
        </p>
      </div>

      <div className="rounded-xl border border-line bg-panelAlt/60 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Your membership
        </p>
        <p className="mt-2 text-sm text-stone-300">
          Support Milwaukee&apos;s Black business community by joining the Solidarity Circle.
        </p>
        <Link
          href="/membership"
          className="mt-3 inline-flex rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
        >
          Learn about membership
        </Link>
      </div>

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
  { key: "recent", label: "Recently viewed" },
  { key: "account", label: "Account" }
];

export function VisitorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("favorites");

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
        My MKE Black
      </p>
      <h1 className="mt-1 font-display text-3xl font-black text-ink">
        {user.displayName ? `Hi, ${user.displayName.split(" ")[0]}` : "My dashboard"}
      </h1>

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
        {activeTab === "recent" && <RecentTab uid={user.uid} />}
        {activeTab === "account" && <AccountTab />}
      </div>
    </div>
  );
}
