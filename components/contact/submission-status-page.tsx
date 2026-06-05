"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  loadFirebaseAuthModule
} from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase-errors";

type SubmissionStatus = {
  id: string;
  status: string;
  businessName: string;
  submitterUidAttached: boolean;
  submittedAt: string | null;
  approvedBusinessId: string | null;
};

type SubmissionStatusPageProps = {
  submissionId: string;
};

function getStatusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending review";
}

export function SubmissionStatusPage({ submissionId }: SubmissionStatusPageProps) {
  const [submission, setSubmission] = useState<SubmissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as SubmissionStatus & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load submission.");
      }

      setSubmission(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load submission."
      );
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void loadSubmission();
  }, [loadSubmission]);

  async function handleAttachGoogle() {
    setAttaching(true);
    setError(null);

    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);

      if (!auth) {
        throw new Error("Firebase Auth is not available.");
      }

      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await authModule.signInWithPopup(auth, provider);
      const token = await credential.user.getIdToken();
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to attach Google.");
      }

      await loadSubmission();
    } catch (attachError) {
      setError(formatFirebaseError(attachError));
    } finally {
      setAttaching(false);
    }
  }

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Submission status
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Check your listing request.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Track review status and attach Google while the request is pending.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/85 p-8">
          {loading ? (
            <div className="h-48 animate-pulse rounded-2xl border border-line bg-panelAlt/70" />
          ) : error && !submission ? (
            <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
              {error}
            </div>
          ) : submission ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">
                    Business
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-bold text-ink">
                    {submission.businessName || "Business submission"}
                  </h2>
                </div>
                <span className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accentSoft">
                  {getStatusLabel(submission.status)}
                </span>
              </div>

              <div className="mt-6 rounded-xl border border-line bg-panelAlt/60 p-5 text-sm leading-7 text-stone-300">
                <p>
                  Google account:{" "}
                  <span className={submission.submitterUidAttached ? "text-success" : "text-amber-300"}>
                    {submission.submitterUidAttached ? "Attached" : "Not attached"}
                  </span>
                </p>
                {submission.approvedBusinessId ? (
                  <p>
                    Approved listing:{" "}
                    <Link
                      href={`/business/${submission.approvedBusinessId}`}
                      className="text-accentSoft underline-offset-4 hover:underline"
                    >
                      View business profile
                    </Link>
                  </p>
                ) : null}
              </div>

              {submission.status === "pending" && !submission.submitterUidAttached ? (
                <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
                  <p className="text-sm font-semibold text-ink">
                    Attach Google before approval
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-300">
                    Once an admin approves the listing, this Google account can
                    manage the business profile.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleAttachGoogle()}
                    disabled={attaching || !isFirebaseConfigured}
                    className="mt-4 rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {attaching ? "Opening Google..." : "Attach Google account"}
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
                  {error}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
