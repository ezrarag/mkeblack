"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinesses } from "@/hooks/use-businesses";
import { createPendingBusinessClaim } from "@/lib/firebase/businesses";
import { Business, TeamMemberRoleType } from "@/lib/types";

function getRequestedRole(
  business: Pick<Business, "id" | "ownerUid">,
  requestedRoles: Record<string, TeamMemberRoleType>
): TeamMemberRoleType {
  if (!business.ownerUid) {
    return "owner";
  }

  return requestedRoles[business.id] ?? "co_owner";
}

export function BusinessEmailClaimSuggestion() {
  const { user } = useAuth();
  const { businesses, loading, error } = useBusinesses();
  const [claiming, setClaimingId] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(() => new Set());
  const [requestedRoles, setRequestedRoles] = useState<Record<string, TeamMemberRoleType>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const userEmail = user?.email?.trim().toLowerCase() ?? "";

  const matches = useMemo(() => {
    if (!userEmail) {
      return [];
    }

    return businesses.filter(
      (business) => business.email.trim().toLowerCase() === userEmail
    );
  }, [businesses, userEmail]);

  async function handleClaim(business: Business) {
    if (!user) return;
    setClaimingId(business.id);
    setFeedback(null);
    const requestedRoleType = getRequestedRole(business, requestedRoles);

    try {
      await createPendingBusinessClaim({
        businessId: business.id,
        businessName: business.name,
        claimedByUid: user.uid,
        claimedByEmail: user.email ?? "",
        claimedByName: user.displayName ?? "",
        requestedRoleType
      });

      setFeedback({
        tone: "success",
        text: requestedRoleType === "owner"
          ? `Your ownership claim for ${business.name} was sent to the MKE Black team for review.`
          : `Your ${requestedRoleType === "co_owner" ? "co-owner" : "team"} access request for ${business.name} was sent to the MKE Black team for review.`
      });
      setSubmittedIds((current) => new Set(current).add(business.id));
    } catch (claimError) {
      setFeedback({
        tone: "error",
        text: claimError instanceof Error
          ? claimError.message
          : "Unable to send this claim. Try again."
      });
    } finally {
      setClaimingId(null);
    }
  }

  if (!userEmail || loading || error || matches.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 p-6 sm:p-8">
      <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
        Possible business match
      </p>
      <h2 className="mt-3 font-display text-2xl font-bold text-ink">
        We found {matches.length === 1 ? "a listing" : "listings"} using your email
      </h2>
      <p className="mt-3 text-sm leading-7 text-stone-300">
        The email on your account matches {matches.length === 1 ? "this business record" : "these business records"}.
        Send a link request and the MKE Black team can verify the connection.
      </p>

      {feedback ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
          feedback.tone === "success"
            ? "border-success/35 bg-success/10 text-stone-100"
            : "border-danger/35 bg-danger/10 text-stone-100"
        }`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {matches.map((business) => {
          const alreadyOwned = business.ownerUid === user?.uid;
          const hasDifferentOwner = Boolean(business.ownerUid && business.ownerUid !== user?.uid);
          const alreadySubmitted = submittedIds.has(business.id);
          const requestedRole = getRequestedRole(business, requestedRoles);

          return (
            <div
              key={business.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/70 px-4 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-100">
                  {business.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {business.category}{business.address ? ` / ${business.address}` : ""}
                </p>
                {hasDifferentOwner ? (
                  <p className="mt-1 text-xs text-amber-400">
                    Already has an owner. Request co-owner or team access.
                  </p>
                ) : null}
                {alreadyOwned ? (
                  <p className="mt-1 text-xs text-amber-400">
                    You already own this listing.
                  </p>
                ) : null}
              </div>

              {alreadyOwned || alreadySubmitted ? (
                <span className="shrink-0 rounded-full border border-line px-4 py-2 text-xs text-stone-500">
                  {alreadyOwned ? "Linked" : "Request sent"}
                </span>
              ) : (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {hasDifferentOwner ? (
                    <select
                      value={requestedRole}
                      onChange={(event) =>
                        setRequestedRoles((current) => ({
                          ...current,
                          [business.id]: event.target.value as TeamMemberRoleType
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
                    onClick={() => handleClaim(business)}
                    disabled={claiming === business.id}
                    className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {claiming === business.id
                      ? "Sending..."
                      : hasDifferentOwner
                      ? "Request access"
                      : "Link this business"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
