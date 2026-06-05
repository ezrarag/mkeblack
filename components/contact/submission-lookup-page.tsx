"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type LookupSubmission = {
  id: string;
  businessName: string;
  status: string;
  submitterUidAttached: boolean;
  submittedAt: string | null;
  approvedBusinessId: string | null;
};

function getStatusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending review";
}

export function SubmissionLookupPage() {
  const [email, setEmail] = useState("");
  const [submissions, setSubmissions] = useState<LookupSubmission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSubmissions(null);

    try {
      const response = await fetch("/api/submissions/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as {
        submissions?: LookupSubmission[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      setSubmissions(data.submissions ?? []);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Unable to find submissions."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Submission lookup
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Find your listing request.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Enter the email used on the business submission to recover the status page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-panel/85 p-8"
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Submission email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {error ? (
            <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 rounded-full border border-accent bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
          >
            {loading ? "Searching..." : "Find submissions"}
          </button>
        </form>

        {submissions ? (
          <div className="mt-6 rounded-2xl border border-line bg-panel/85 p-6">
            {submissions.length ? (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-xl border border-line bg-panelAlt/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-100">
                          {submission.businessName || "Business submission"}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
                          {getStatusLabel(submission.status)}
                          {" · "}
                          Google {submission.submitterUidAttached ? "attached" : "not attached"}
                        </p>
                      </div>
                      <Link
                        href={`/submission/${submission.id}`}
                        className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
                      >
                        Open status
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-stone-400">
                No business submissions found for that email.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
