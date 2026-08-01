"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  approveBusinessListingSubmission,
  getPendingBusinessListingSubmissions,
  requestBusinessSubmissionClarification,
  rejectBusinessListingSubmission,
  resolveSubmissionWithExistingBusiness,
  type BusinessListingSubmission
} from "@/lib/firebase/contact";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { createBusinessNameFingerprint, findPossibleDuplicates } from "@/lib/businesses";
import { useAllBusinesses } from "@/hooks/use-all-businesses";

function formatSubmittedAt(value: Date | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export function BusinessSubmissionsPanel() {
  const { businesses, loading: businessesLoading } = useAllBusinesses();
  const [submissions, setSubmissions] = useState<BusinessListingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const existingDuplicatePairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<{ left: (typeof businesses)[number]; right: (typeof businesses)[number] }> = [];

    for (const business of businesses) {
      for (const candidate of findPossibleDuplicates(
        businesses,
        business.name,
        business.address,
        { excludeBusinessId: business.id }
      )) {
        if (
          createBusinessNameFingerprint(business.name) !==
          createBusinessNameFingerprint(candidate.name)
        ) continue;
        const key = [business.id, candidate.id].sort().join("::");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ left: business, right: candidate });
      }
    }

    return pairs.slice(0, 25);
  }, [businesses]);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);

    try {
      setSubmissions(await getPendingBusinessListingSubmissions());
    } catch (loadError) {
      setError(formatFirebaseError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  async function handleApprove(
    submission: BusinessListingSubmission,
    duplicateReviewed = false
  ) {
    setBusyId(submission.id);
    setFeedback(null);
    setError(null);

    try {
      const businessId = await approveBusinessListingSubmission(submission, {
        duplicateReviewed
      });
      setSubmissions((current) =>
        current.filter((candidate) => candidate.id !== submission.id)
      );
      setFeedback(`Approved ${submission.businessName}. Listing ID: ${businessId}`);
    } catch (approveError) {
      setError(formatFirebaseError(approveError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUseExisting(
    submission: BusinessListingSubmission,
    businessId: string
  ) {
    const confirmed = window.confirm(
      "Resolve this request using the existing listing? The submitter will be linked to it when their account is attached."
    );
    if (!confirmed) return;

    setBusyId(submission.id);
    setFeedback(null);
    setError(null);
    try {
      await resolveSubmissionWithExistingBusiness(submission, businessId);
      setSubmissions((current) => current.filter((item) => item.id !== submission.id));
      setFeedback(`Resolved ${submission.businessName} using the existing listing.`);
    } catch (resolveError) {
      setError(formatFirebaseError(resolveError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleClarification(submission: BusinessListingSubmission) {
    const message = window.prompt(
      `What should MKE Black ask about ${submission.businessName || "this request"}?`,
      "We found a similar business in the directory. Is this request for that existing listing, or is this a separate business?"
    );
    if (!message?.trim()) return;

    setBusyId(submission.id);
    setFeedback(null);
    setError(null);
    try {
      await requestBusinessSubmissionClarification(submission, message);
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? { ...item, status: "waiting_clarification" }
            : item
        )
      );
      setFeedback(`Clarification requested from ${submission.ownerEmail || submission.businessEmail}.`);
    } catch (clarificationError) {
      setError(formatFirebaseError(clarificationError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(submission: BusinessListingSubmission) {
    setBusyId(submission.id);
    setFeedback(null);
    setError(null);

    try {
      await rejectBusinessListingSubmission(submission.id);
      setSubmissions((current) =>
        current.filter((candidate) => candidate.id !== submission.id)
      );
      setFeedback(`Rejected ${submission.businessName || "submission"}.`);
    } catch (rejectError) {
      setError(formatFirebaseError(rejectError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-panel/85 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-accentSoft">
            Pending business submissions
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">
            Approve directory listing requests.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
            Approved requests become active directory listings. If the submitter
            connected Google, that account is linked as the business owner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSubmissions()}
          disabled={loading}
          className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm text-stone-100">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
          {error}
        </div>
      ) : null}

      {!businessesLoading && existingDuplicatePairs.length ? (
        <details className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
          <summary className="cursor-pointer text-sm font-semibold text-amber-200">
            Existing listings to review ({existingDuplicatePairs.length})
          </summary>
          <p className="mt-2 text-xs leading-5 text-stone-400">
            These pairs have similar names or addresses. Review both before deciding whether they represent a move, separate locations, or records that should eventually be merged.
          </p>
          <div className="mt-4 space-y-3">
            {existingDuplicatePairs.map(({ left, right }) => (
              <div key={`${left.id}-${right.id}`} className="grid gap-3 rounded-xl border border-line bg-canvas/35 p-4 sm:grid-cols-2">
                {[left, right].map((business) => (
                  <div key={business.id}>
                    <p className="text-sm font-semibold text-stone-100">{business.name}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{business.address || "No address"}</p>
                    <Link href={`/admin/businesses/${business.id}`} className="mt-2 inline-block text-xs text-accentSoft underline underline-offset-4">
                      Review this listing
                    </Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {loading ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl border border-line bg-panelAlt/70"
            />
          ))}
        </div>
      ) : submissions.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {submissions.map((submission) => {
            const duplicateCandidates = findPossibleDuplicates(
              businesses,
              submission.businessName ?? "",
              submission.address ?? ""
            );
            const hasDuplicates = duplicateCandidates.length > 0;

            return (
            <article
              key={submission.id}
              className={`rounded-2xl border bg-panelAlt/70 p-5 ${
                hasDuplicates ? "border-amber-400/45" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    {submission.businessName || "Unnamed business"}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
                    {formatSubmittedAt(submission.submittedAt)}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                  hasDuplicates
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    : "border-accent/35 bg-accent/10 text-accentSoft"
                }`}>
                  {submission.status === "waiting_clarification"
                    ? "Waiting on submitter"
                    : hasDuplicates
                      ? "Possible duplicate"
                      : "Pending"}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm leading-6 text-stone-300">
                <p>
                  <span className="text-stone-500">Owner:</span>{" "}
                  {submission.businessOwner ||
                    submission.ownerName ||
                    "Not provided"}
                </p>
                <p>
                  <span className="text-stone-500">Email:</span>{" "}
                  {submission.businessEmail ||
                    submission.ownerEmail ||
                    "Not provided"}
                </p>
                <p>
                  <span className="text-stone-500">Address:</span>{" "}
                  {submission.address || "Not provided"}
                </p>
                <p>
                  <span className="text-stone-500">Google account:</span>{" "}
                  {submission.submitterUid ? "Attached" : "Not attached"}
                </p>
                <p>
                  <span className="text-stone-500">Solidarity Circle:</span>{" "}
                  {submission.solidarityPaymentStatus === "active"
                    ? "Paid / active"
                    : submission.solidarityCheckoutStarted
                    ? `Checkout started${
                        submission.solidarityMembershipPlan
                          ? ` (${submission.solidarityMembershipPlan})`
                          : ""
                      }`
                    : "Not started"}
                </p>
                {submission.solidarityMemberId ? (
                  <p className="text-xs font-mono text-stone-500">
                    Member ID: {submission.solidarityMemberId}
                  </p>
                ) : null}
                {submission.website ? (
                  <p>
                    <span className="text-stone-500">Website:</span>{" "}
                    <Link
                      href={submission.website}
                      target="_blank"
                      className="text-accentSoft underline-offset-4 hover:underline"
                    >
                      {submission.website}
                    </Link>
                  </p>
                ) : null}
                {submission.description ? (
                  <p className="pt-2 text-stone-400">
                    {submission.description}
                  </p>
                ) : null}
                {submission.message ? (
                  <p className="rounded-xl border border-line/70 bg-canvas/30 px-3 py-2 text-stone-400">
                    {submission.message}
                  </p>
                ) : null}
              </div>

              {hasDuplicates ? (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                    Similar listing{duplicateCandidates.length === 1 ? "" : "s"} found
                  </p>
                  <div className="mt-3 space-y-3">
                    {duplicateCandidates.map((business) => (
                      <div key={business.id} className="rounded-xl border border-line bg-canvas/40 p-3">
                        <p className="text-sm font-semibold text-stone-100">{business.name}</p>
                        <p className="mt-1 text-xs leading-5 text-stone-400">
                          {business.address || "No address"}
                          {business.email ? ` · ${business.email}` : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={`/admin/businesses/${business.id}`}
                            className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-300 hover:border-accent/40"
                          >
                            Review listing
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleUseExisting(submission, business.id)}
                            disabled={busyId === submission.id}
                            className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-semibold text-stone-950 disabled:opacity-50"
                          >
                            Use existing listing
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleApprove(submission, hasDuplicates)}
                  disabled={busyId === submission.id}
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                >
                  {busyId === submission.id
                    ? "Working..."
                    : hasDuplicates
                      ? "Not a duplicate — approve"
                      : "Approve listing"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleClarification(submission)}
                  disabled={busyId === submission.id || businessesLoading}
                  className="rounded-full border border-amber-400/35 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50"
                >
                  Request clarification
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(submission)}
                  disabled={busyId === submission.id}
                  className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-300 transition hover:border-danger/40 hover:text-rose-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-canvas/30 p-6 text-sm text-stone-400">
          No pending business listing submissions.
        </div>
      )}
    </section>
  );
}
