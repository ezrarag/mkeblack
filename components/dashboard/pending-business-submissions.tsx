"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

type PendingSubmission = {
  id: string;
  businessName: string;
  status: string;
  ownerName: string;
  submitterUidAttached: boolean;
  submittedAt: string | null;
  approvedBusinessId: string | null;
  solidarityCheckoutStarted: boolean;
  solidarityMemberId: string | null;
};

function getStatusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending review";
}

type PendingBusinessSubmissionsProps = {
  onHasPendingChange?: (hasPending: boolean) => void;
};

export function PendingBusinessSubmissions({
  onHasPendingChange
}: PendingBusinessSubmissionsProps) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      if (!user) {
        setSubmissions([]);
        setLoading(false);
        onHasPendingChange?.(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/submissions/mine", {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        });
        const data = (await response.json()) as {
          submissions?: PendingSubmission[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Unable to load pending submissions.");
        }

        if (!cancelled) {
          const nextSubmissions = data.submissions ?? [];
          setSubmissions(nextSubmissions);
          onHasPendingChange?.(
            nextSubmissions.some((submission) => submission.status === "pending")
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load pending submissions."
          );
          onHasPendingChange?.(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, [onHasPendingChange, user]);

  async function handleUpgrade(submission: PendingSubmission) {
    if (!user?.email) {
      setError("Your account needs an email before checkout.");
      return;
    }

    setUpgradingId(submission.id);
    setError(null);

    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "membership",
          name: user.displayName || submission.ownerName || user.email,
          email: user.email,
          membershipPlan: "monthly",
          pendingSubmissionId: submission.id,
          pendingBusinessName: submission.businessName,
          uid: user.uid
        })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (upgradeError) {
      setError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "Unable to start checkout."
      );
      setUpgradingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 h-40 animate-pulse rounded-2xl border border-line bg-panel/70" />
    );
  }

  if (!submissions.length && !error) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/85 p-6 sm:p-8">
      <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
        Business submissions
      </p>
      <h2 className="mt-3 font-display text-2xl font-bold text-ink">
        Pending business review
      </h2>
      <p className="mt-3 text-sm leading-7 text-stone-400">
        Your request is waiting for admin approval. You can attach Google from
        the status page or start Solidarity Circle membership now.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="rounded-xl border border-line bg-panelAlt/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-stone-100">
                  {submission.businessName || "Business submission"}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
                  {getStatusLabel(submission.status)}
                  {" · "}
                  Google {submission.submitterUidAttached ? "attached" : "not attached"}
                  {submission.solidarityCheckoutStarted ? " · Membership checkout started" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/submission/${submission.id}`}
                  className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
                >
                  View status
                </Link>
                {submission.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => void handleUpgrade(submission)}
                    disabled={upgradingId === submission.id}
                    className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {upgradingId === submission.id
                      ? "Opening checkout..."
                      : "Upgrade to Solidarity Circle"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
