"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  approveBusinessListingSubmission,
  getPendingBusinessListingSubmissions,
  rejectBusinessListingSubmission,
  type BusinessListingSubmission
} from "@/lib/firebase/contact";
import { formatFirebaseError } from "@/lib/firebase-errors";

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
  const [submissions, setSubmissions] = useState<BusinessListingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleApprove(submission: BusinessListingSubmission) {
    setBusyId(submission.id);
    setFeedback(null);
    setError(null);

    try {
      const businessId = await approveBusinessListingSubmission(submission);
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
          {submissions.map((submission) => (
            <article
              key={submission.id}
              className="rounded-2xl border border-line bg-panelAlt/70 p-5"
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
                <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accentSoft">
                  Pending
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

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleApprove(submission)}
                  disabled={busyId === submission.id}
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                >
                  {busyId === submission.id ? "Working..." : "Approve listing"}
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
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-canvas/30 p-6 text-sm text-stone-400">
          No pending business listing submissions.
        </div>
      )}
    </section>
  );
}
