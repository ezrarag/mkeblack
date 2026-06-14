"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { createPendingBusinessClaim } from "@/lib/firebase/businesses";
import { TeamMemberRoleType } from "@/lib/types";

type SearchResult = {
  id: string;
  name: string;
  address: string;
  category: string;
  claimInviteStatus: string;
  ownerUid: string | null;
};

type ClaimSearchProps = {
  onClaimed: () => void;
};

export function BusinessClaimSearch({ onClaimed: _onClaimed }: ClaimSearchProps) {
  void _onClaimed;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [claiming, setClaimingId] = useState<string | null>(null);
  const [requestedRoles, setRequestedRoles] = useState<Record<string, TeamMemberRoleType>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setResults(null);
    setFeedback(null);

    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);

      if (!db) throw new Error("Firestore not available");

      // Search by name — Firestore doesn't support full-text so we
      // use a startAt/endAt range on the name field (case-sensitive).
      // We run two queries: one for the exact casing, one for title case.
      const term = query.trim();
      const termUpper = term.charAt(0).toUpperCase() + term.slice(1);

      const col = firestoreModule.collection(db, "businesses");

      const [snap1, snap2] = await Promise.all([
        firestoreModule.getDocs(
          firestoreModule.query(
            col,
            firestoreModule.where("active", "==", true),
            firestoreModule.orderBy("name"),
            firestoreModule.startAt(term),
            firestoreModule.endAt(term + "\uf8ff"),
            firestoreModule.limit(8)
          )
        ),
        firestoreModule.getDocs(
          firestoreModule.query(
            col,
            firestoreModule.where("active", "==", true),
            firestoreModule.orderBy("name"),
            firestoreModule.startAt(termUpper),
            firestoreModule.endAt(termUpper + "\uf8ff"),
            firestoreModule.limit(8)
          )
        )
      ]);

      // Deduplicate by id
      const seen = new Set<string>();
      const merged: SearchResult[] = [];

      for (const snap of [snap1, snap2]) {
        for (const doc of snap.docs) {
          if (!seen.has(doc.id)) {
            seen.add(doc.id);
            const d = doc.data();
            merged.push({
              id: doc.id,
              name: d.name ?? "",
              address: d.address ?? "",
              category: d.category ?? "",
              claimInviteStatus: d.claimInviteStatus ?? "not_invited",
              ownerUid: d.ownerUid ?? null,
            });
          }
        }
      }

      setResults(merged);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Search failed. Try again."
      });
    } finally {
      setSearching(false);
    }
  }

  function getRequestedRole(business: SearchResult): TeamMemberRoleType {
    if (!business.ownerUid) {
      return "owner";
    }

    return requestedRoles[business.id] ?? "co_owner";
  }

  async function handleClaim(business: SearchResult) {
    if (!user) return;
    setClaimingId(business.id);
    setFeedback(null);
    const requestedRoleType = getRequestedRole(business);

    try {
      const claimStatus = await createPendingBusinessClaim({
        businessId: business.id,
        businessName: business.name,
        claimedByUid: user.uid,
        claimedByEmail: user.email ?? "",
        claimedByName: user.displayName ?? "",
        requestedRoleType
      });

      setFeedback({
        tone: "success",
        text:
          claimStatus === "auto_approved"
            ? `Verified — ${business.name} is yours. You can edit it now.`
            : requestedRoleType === "owner"
              ? `Your claim was sent to MKE Black for verification because your account email doesn't match the one on this listing.`
              : `Your ${requestedRoleType === "co_owner" ? "co-owner" : "team"} access request for ${business.name} was sent to the MKE Black team for review.`
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Claim failed. Try again."
      });
    } finally {
      setClaimingId(null);
    }
  }

  function claimable(b: SearchResult): { can: boolean; reason: string } {
    if (b.ownerUid === user?.uid) {
      return { can: false, reason: "You already own this listing" };
    }
    return { can: true, reason: "" };
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/85 p-6 sm:p-8">
      <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
        Find your business
      </p>
      <h2 className="mt-3 font-display text-2xl font-bold text-ink">
        Search and claim your listing
      </h2>
      <p className="mt-3 text-sm leading-7 text-stone-400">
        Search for your business name in the MKE Black directory. Once you claim
        it, the MKE Black team will verify your ownership — you can edit your
        listing immediately in the meantime.
      </p>

      {/* Search form */}
      <form onSubmit={handleSearch} className="mt-6 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your business name…"
          className="flex-1 rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
          feedback.tone === "success"
            ? "border-success/35 bg-success/10 text-stone-100"
            : "border-danger/35 bg-danger/10 text-stone-100"
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="mt-5 space-y-3">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panelAlt/50 px-5 py-5">
              <p className="text-sm font-medium text-stone-200">
                No businesses found for &quot;{query}&quot;
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Your business may not be in the directory yet.{" "}
                <a
                  href="https://www.mkeblack.org/contact"
                  className="text-accentSoft underline underline-offset-4 hover:text-accent"
                >
                  Contact MKE Black to add it.
                </a>
              </p>
            </div>
          ) : (
            results.map((b) => {
              const { can, reason } = claimable(b);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/60 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-100">
                      {b.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {b.category}{b.address ? ` · ${b.address}` : ""}
                    </p>
                    {b.ownerUid && b.ownerUid !== user?.uid ? (
                      <p className="mt-1 text-xs text-amber-400">
                        Already has an owner. Request co-owner or team access.
                      </p>
                    ) : null}
                    {!can && (
                      <p className="mt-1 text-xs text-amber-400">{reason}</p>
                    )}
                  </div>

                  {can ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {b.ownerUid && b.ownerUid !== user?.uid ? (
                        <select
                          value={getRequestedRole(b)}
                          onChange={(event) =>
                            setRequestedRoles((current) => ({
                              ...current,
                              [b.id]: event.target.value as TeamMemberRoleType
                            }))
                          }
                          className="w-auto rounded-full border border-line bg-panelAlt/70 px-3 py-2 text-xs text-stone-100"
                        >
                          <option value="co_owner">Co-owner</option>
                          <option value="team">Team member</option>
                        </select>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleClaim(b)}
                        disabled={claiming === b.id}
                        className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                      >
                        {claiming === b.id
                          ? "Claiming…"
                          : b.ownerUid
                          ? "Request access"
                          : "Claim this listing"}
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 rounded-full border border-line px-4 py-2 text-xs text-stone-500">
                      Unavailable
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <p className="mt-5 text-xs leading-6 text-stone-600">
        Don&apos;t see your business?{" "}
        <a
          href="https://www.mkeblack.org/contact"
          className="text-stone-400 underline underline-offset-4 hover:text-stone-200"
        >
          Contact MKE Black
        </a>{" "}
        to get it added to the directory first.
      </p>
    </div>
  );
}
