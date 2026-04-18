"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirebaseAuth,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { formatFirebaseError } from "@/lib/firebase-errors";

export function LoginForm() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = searchParams.get("next");

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const destination =
      nextPath ??
      (isAdmin || profile?.role === "admin" ? "/admin" : "/dashboard");

    router.replace(destination);
  }, [isAdmin, loading, nextPath, profile?.role, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const auth = getFirebaseAuth();

      if (!auth) {
        throw new Error("Firebase Auth is not available in this environment.");
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (submitError) {
      setError(formatFirebaseError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.4rem] border border-line bg-panel/80 p-8 shadow-glow sm:p-10">
          <p className="text-sm uppercase tracking-[0.32em] text-accentSoft">
            Business access
          </p>
          <h1 className="mt-4 font-display text-5xl leading-none text-ink sm:text-6xl">
            Update your MKE Black listing in real time.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-stone-300">
            Business owners land in a private dashboard for their listing only.
            Admins are routed to the management workspace after sign-in.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">
                Realtime edits
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-200">
                Hours, descriptions, contact details, and photos sync back to the
                public directory immediately.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">
                Day-first discovery
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-200">
                Accurate weekly hours feed the directory&apos;s day-open filters,
                the most important browsing feature.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">
                Admin oversight
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-200">
                Admin accounts can add listings, manage owners, and deactivate
                records when needed.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2.4rem] border border-line bg-panel/90 p-8 sm:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Sign in
          </p>
          <h2 className="mt-3 font-display text-4xl text-ink">Business login</h2>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Use the email and password connected to your Firebase Auth account.
            If you need access or an admin claim, contact the directory team.
          </p>

          {!isFirebaseConfigured ? (
            <div className="mt-8 rounded-3xl border border-danger/35 bg-danger/10 p-5 text-sm leading-7 text-stone-200">
              Add your Firebase variables to <code>.env.local</code> before using
              sign-in.
            </div>
          ) : null}

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@business.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error ? (
              <div className="rounded-3xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !isFirebaseConfigured}
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-stone-400">
            Looking for businesses instead?{" "}
            <Link href="/" className="text-accentSoft transition hover:text-accent">
              Browse the public directory
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
