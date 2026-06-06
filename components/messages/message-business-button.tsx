"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getOrCreateThread } from "@/lib/firebase/messages";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageBusinessButtonProps = {
  business: Business;
  className?: string;
};

/**
 * Lets a signed-in visitor start (or resume) a direct conversation with a
 * Solidarity Circle business — about marketplace prices, events, reviews,
 * or anything else. Hidden for the business's own team and for non-members.
 */
export function MessageBusinessButton({ business, className }: MessageBusinessButtonProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!business.solidarityMember) return null;
  if (profile?.businessId === business.id) return null;

  async function handleClick() {
    if (!user) {
      window.location.href = `/join?next=${encodeURIComponent(`/business/${business.id}`)}`;
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await getOrCreateThread({
        businessId: business.id,
        businessName: business.name,
        businessPhotoUrl: business.photos[0] ?? "",
        visitorUid: user.uid,
        visitorName: user.displayName || user.email || "MKE Black member"
      });
      router.push("/visitor?tab=messages");
    } catch (err) {
      setError(formatFirebaseError(err));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accentSoft transition hover:bg-accent/20 disabled:opacity-60"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        {busy ? "Opening conversation…" : "Message this business"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
