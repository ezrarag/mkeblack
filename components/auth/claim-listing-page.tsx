"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusinessClaimInvite } from "@/hooks/use-business-claim-invite";
import {
  getFirebaseAuth,
  loadFirebaseAuthModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { claimBusinessListing } from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";

type ClaimListingPageProps = {
  businessId: string;
};

export function ClaimListingPage({ businessId }: ClaimListingPageProps) {
  const router = useRouter();
  const { invite, loading, error } = useBusinessClaimInvite(businessId);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (invite?.status === "claimed") {
      setFeedback("This listing has already been claimed. Sign in instead.");
    }
  }, [invite]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invite || invite.status !== "pending") {
      return;
    }

    if (password.length < 8) {
      setFeedback("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);

      if (!auth) {
        throw new Error("Firebase Auth is not available in this environment.");
      }

      const credentials = await authModule.createUserWithEmailAndPassword(
        auth,
        invite.email,
        password
      );

      await claimBusinessListing(invite, credentials.user.uid);
      router.replace("/dashboard");
    } catch (claimError) {
      setFeedback(formatFirebaseError(claimError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Firebase configuration required"
          description="Add your Firebase environment variables before using listing claim invites."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Loading invite"
          description="Checking whether this claim invite is still valid."
        />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Invite unavailable"
          description={error || "This claim invite is invalid or no longer available."}
          action={
            <Link
              href="/login"
              className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
            >
              Go to login
            </Link>
          }
        />
      </div>
    );
  }

  if (invite.status !== "pending") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Invite already used"
          description="This listing has already been claimed. Sign in with the email tied to the account or contact MKE Black if you need access."
          action={
            <Link
              href="/login"
              className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
            >
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.4rem] border border-line bg-panel/80 p-8 shadow-glow sm:p-10">
          <p className="text-sm uppercase tracking-[0.32em] text-accentSoft">
            Claim listing
          </p>
          <h1 className="mt-4 font-display text-5xl leading-none text-ink sm:text-6xl">
            Claim {invite.businessName}.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-stone-300">
            Finish account setup for <span className="text-ink">{invite.email}</span>.
            Once complete, this listing will appear in your dashboard for direct
            updates.
          </p>
        </div>

        <div className="rounded-[2.4rem] border border-line bg-panel/90 p-8 sm:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Create account
          </p>
          <h2 className="mt-3 font-display text-4xl text-ink">Set your password</h2>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Email
              </label>
              <input value={invite.email} readOnly className="cursor-not-allowed opacity-70" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {feedback ? (
              <div className="rounded-3xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
                {feedback}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
            >
              {submitting ? "Claiming..." : "Create account and claim listing"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
