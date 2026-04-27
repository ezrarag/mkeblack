"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getFirebaseAuth,
  loadFirebaseAuthModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { formatFirebaseError } from "@/lib/firebase-errors";

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }
  return nextPath;
}

/** Detect in-app browsers that block Google OAuth (Messenger, Instagram, etc.) */
function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    ua.includes("FBAN") ||      // Facebook app
    ua.includes("FBAV") ||      // Facebook app variant
    ua.includes("Instagram") || // Instagram
    ua.includes("Twitter") ||   // Twitter/X
    ua.includes("LinkedInApp") || // LinkedIn
    // Generic WebView signals
    (ua.includes("wv") && ua.includes("Android")) ||
    ua.includes("FB_IAB")
  );
}

export function LoginForm() {
  const { user, hasAdminAccess, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const isSubmitting = submitting || googleSubmitting;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const destination = nextPath ?? (hasAdminAccess ? "/admin" : "/dashboard");
    router.replace(destination);
  }, [hasAdminAccess, loading, nextPath, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);
      if (!auth) throw new Error("Firebase Auth is not available.");
      await authModule.signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (submitError) {
      setError(formatFirebaseError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleSubmitting(true);
    setError(null);
    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);
      if (!auth) throw new Error("Firebase Auth is not available.");
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await authModule.signInWithPopup(auth, provider);
    } catch (submitError) {
      setError(formatFirebaseError(submitError));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">

        {/* Left — value prop */}
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
            {[
              { label: "Realtime edits", body: "Hours, descriptions, contact details, and photos sync back to the public directory immediately." },
              { label: "Day-first discovery", body: "Accurate weekly hours feed the directory's day-open filters, the most important browsing feature." },
              { label: "Admin oversight", body: "Admin accounts can add listings, manage owners, and deactivate records when needed." },
            ].map(({ label, body }) => (
              <div key={label} className="rounded-3xl border border-line bg-panelAlt/70 p-5">
                <p className="text-xs uppercase tracking-[0.26em] text-muted">{label}</p>
                <p className="mt-2 text-sm leading-7 text-stone-200">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — sign in form */}
        <div className="rounded-[2.4rem] border border-line bg-panel/90 p-8 sm:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">Sign in</p>
          <h2 className="mt-3 font-display text-4xl text-ink">Business login</h2>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Use your email and password, or sign in with Google. Contact the
            directory team if you need admin access or a linked business profile.
          </p>

          {/* ── In-app browser warning ── */}
          {inAppBrowser && (
            <div className="mt-6 rounded-[1.6rem] border border-amber-500/40 bg-amber-500/10 px-5 py-5">
              <p className="text-sm font-semibold text-amber-300">
                Open in your browser to sign in
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                You&apos;re viewing this inside an app (like Messenger or Instagram).
                Google sign-in is blocked in these browsers.
              </p>
              <p className="mt-3 text-sm font-medium text-stone-200">
                To continue:
              </p>
              <ol className="mt-2 space-y-1 text-sm leading-7 text-stone-300 list-decimal list-inside">
                <li>Tap the <strong>⋯</strong> or <strong>⋮</strong> menu in the corner</li>
                <li>
                  Choose <strong>&quot;Open in Safari&quot;</strong> or{" "}
                  <strong>&quot;Open in Chrome&quot;</strong>
                </li>
                <li>Sign in from there</li>
              </ol>
              {currentUrl && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted mb-2">
                    Or copy this link and paste it in your browser:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl bg-canvas/40 px-3 py-2 text-xs text-stone-300 break-all">
                      {currentUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(currentUrl)}
                      className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-stone-400 transition hover:border-accent/40 hover:text-accentSoft"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isFirebaseConfigured && (
            <div className="mt-8 rounded-3xl border border-danger/35 bg-danger/10 p-5 text-sm leading-7 text-stone-200">
              Add your Firebase variables to <code>.env.local</code> before using sign-in.
            </div>
          )}

          {/* Google sign-in */}
          {!inAppBrowser && (
            <div className="mt-8">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || !isFirebaseConfigured}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-panelAlt/70 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-accent/35 hover:bg-accent/10 hover:text-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line/80 bg-canvas/70 text-xs uppercase tracking-[0.2em] text-accentSoft">
                  G
                </span>
                <span>{googleSubmitting ? "Opening Google…" : "Continue with Google"}</span>
              </button>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted">
                Invited admins should use the exact Google address tied to their invite.
              </p>
            </div>
          )}

          {/* Divider */}
          {!inAppBrowser && (
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-line/80" />
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Or use email</p>
              <div className="h-px flex-1 bg-line/80" />
            </div>
          )}

          {/* Email / password form — always shown, works in any browser */}
          <form
            className={inAppBrowser ? "mt-6 space-y-4" : "mt-6 space-y-4"}
            onSubmit={handleSubmit}
          >
            {inAppBrowser && (
              <p className="text-xs uppercase tracking-[0.22em] text-muted mb-2">
                Email sign-in works in any browser ↓
              </p>
            )}
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-3xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isFirebaseConfigured}
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in with email"}
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
