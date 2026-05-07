"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useIsFavorite } from "@/hooks/use-is-favorite";
import { addFavorite, removeFavorite } from "@/lib/firebase/favorites";
import { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

type FavoriteButtonProps = {
  business: Business;
  className?: string;
};

export function FavoriteButton({ business, className }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, loading } = useIsFavorite(user?.uid ?? null, business.id);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      if (!user) {
        // Redirect to /join so they can create an account
        window.location.href = `/join?next=${encodeURIComponent(
          `/business/${business.id}`
        )}`;
        return;
      }

      if (busy) return;
      setBusy(true);
      try {
        if (isFavorite) {
          await removeFavorite(user.uid, business.id);
        } else {
          await addFavorite(user.uid, business);
        }
      } catch {
        // Silently ignore — UI will revert via subscription
      } finally {
        setBusy(false);
      }
    },
    [user, business, isFavorite, busy]
  );

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={isFavorite}
      disabled={loading || busy}
      onClick={toggle}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border transition",
        isFavorite
          ? "border-accent bg-accent text-white hover:bg-accentSoft"
          : "border-white/30 bg-black/60 text-white/80 hover:border-accent/60 hover:bg-accent/20 hover:text-white",
        (loading || busy) && "opacity-60 cursor-wait",
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
