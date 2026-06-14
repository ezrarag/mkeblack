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
import { createOrUpdateVisitorProfile } from "@/lib/firebase/visitor-profile";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { StatePanel } from "@/components/ui/state-panel";
import {
  recordAuthTracking,
  recordPasswordResetRequest
} from "@/lib/firebase/auth-tracking";

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }
  return nextPath;
}

function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    ua.includes("FBAN") ||
    ua.includes("FBAV") ||
    ua.includes("Instagram") ||
    ua.includes("Twitter") ||
    ua.includes("LinkedInApp") ||
    (ua.includes("wv") && ua.includes("Android")) ||
    ua.includes("FB_IAB")
  );
}

export function JoinForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const isSubmitting = submitting || googleSubmitting;

  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(nextPath ?? "/visitor");
  }, [loading, nextPath, router, user]);

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

      let firebaseUser;
      if (mode === "signup") {
        const credential = await authModule.createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        firebaseUser = credential.user;
        if (displayName.trim()) {
          await authModule.updateProfile(firebaseUser, {
            displayName: displayName.trim()
          });
        }
      } else {
        const credential = await authModule.signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        firebaseUser = credential.user;
      }

      await createOrUpdateVisitorProfile(
        firebaseUser.uid,
        firebaseUser.displayName ?? displayName.trim(),
        firebaseUser.email ?? email.trim()
      );
      await recordAuthTracking({
        user: firebaseUser,
        intent: mode === "signup" ? "email_password_signup" : "email_password_signin",
        providerId: "password"
      });
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
      const credential = await authModule.signInWithPopup(auth, provider);
      const firebaseUser = credential.user;
      await createOrUpdateVisitorProfile(
        firebaseUser.uid,
        firebaseUser.displayName ?? "",
        firebaseUser.email ?? ""
      );
      await recordAuthTracking({
        user: firebaseUser,
        intent: "google_popup",
        providerId: "google.com"
      });
    } catch (googleError) {
      setError(formatFirebaseError(googleError));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter your email address first, then request a reset link.");
      return;
    }

    setError(null);
    setResetFeedback(null);
    try {
      const [authModule, auth] = await Promise.all([
        loadFirebaseAuthModule(),
        getFirebaseAuth()
      ]);
      if (!auth) throw new Error("Firebase Auth is not available.");
      await authModule.sendPasswordResetEmail(auth, targetEmail);
      await recordPasswordResetRequest(targetEmail);
      setResetFeedback("Password reset email sent. Check your inbox.");
    } catch (resetError) {
      setError(formatFirebaseError(resetError));
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <StatePanel
        title="Firebase not configured"
        description="Add your Firebase environment variables in .env.local."
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
          MKE Black
        </p>
        <h1 className="mt-2 font-display text-2xl font-black text-ink">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          {mode === "signup"
            ? "Save your favorites and track the businesses you visit."
            : "Sign in to access your saved favorites and recent views."}
        </p>

        {!inAppBrowser && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleSignIn}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-accent/40 hover:bg-accent/10 hover:text-ink disabled:opacity-60"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {googleSubmitting ? "Connecting…" : "Continue with Google"}
          </button>
        )}

        {inAppBrowser && (
          <div className="mt-6 rounded-xl border border-line bg-panelAlt/60 px-4 py-3 text-sm text-stone-400">
            Google sign-in is unavailable in this browser. Use email below or open in Safari/Chrome.
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-stone-500">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-stone-400" htmlFor="join-display-name">
                Your name <span className="text-stone-600">(optional)</span>
              </label>
              <input
                id="join-display-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="First Last"
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-400" htmlFor="join-email">
              Email address
            </label>
            <input
              id="join-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400" htmlFor="join-password">
              Password
            </label>
            <input
              id="join-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink placeholder:text-stone-600 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {resetFeedback ? (
            <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-stone-200">
              {resetFeedback}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-accent bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
          >
            {submitting
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => void handlePasswordReset()}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft disabled:opacity-60"
            >
              Forgot password?
            </button>
          ) : null}
        </form>

        <p className="mt-5 text-center text-sm text-stone-500">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="font-medium text-accent hover:text-accentSoft"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="font-medium text-accent hover:text-accentSoft"
              >
                Create account
              </button>
            </>
          )}
        </p>

        <p className="mt-3 text-center text-xs text-stone-600">
          Business owner?{" "}
          <Link href="/login" className="text-stone-400 hover:text-accent">
            Business login →
          </Link>
        </p>
      </div>
    </div>
  );
}
