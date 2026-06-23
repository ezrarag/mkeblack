"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinesses } from "@/hooks/use-businesses";
import { findPossibleDuplicates } from "@/lib/businesses";
import {
  attachGoogleAccountToBusinessSubmission,
  submitContactForm,
  type ContactFormData,
  type ContactReason
} from "@/lib/firebase/contact";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  loadFirebaseAuthModule
} from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { recordAuthTracking } from "@/lib/firebase/auth-tracking";

const reasonOptions: { value: ContactReason; label: string }[] = [
  { value: "general", label: "General inquiry" },
  { value: "submit_business", label: "Submit a business listing" },
  { value: "suggest_business", label: "Suggest a business for the directory" },
  { value: "partnership", label: "Partnership or sponsorship" },
  { value: "correction", label: "Directory correction" },
  { value: "other", label: "Other" }
];

const inputClass =
  "mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";
const labelClass = "block text-xs font-semibold uppercase tracking-[0.18em] text-muted";
const businessSteps = ["Contact", "Business", "Details"];

export function ContactPage() {
  const searchParams = useSearchParams();
  const forcedReason = searchParams.get("reason") === "submit_business";
  const prefilledReason = searchParams.get("reason");
  const { user } = useAuth();
  const { businesses } = useBusinesses();
  const [reason, setReason] = useState<ContactReason>(() => {
    if (forcedReason) return "submit_business";
    if (prefilledReason === "suggest_business") return "suggest_business";
    return "general";
  });
  const [form, setForm] = useState<Omit<ContactFormData, "reason">>({
    ownerName: "",
    ownerEmail: "",
    message: "",
    businessName: "",
    businessOwner: "",
    businessEmail: "",
    phone: "",
    address: "",
    website: "",
    logoUrl: "",
    description: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [businessStep, setBusinessStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [postSubmitAttached, setPostSubmitAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateOverrideConfirmed, setDuplicateOverrideConfirmed] = useState(false);

  const isBizSubmission = reason === "submit_business";
  const isSuggestBusiness = reason === "suggest_business";
  // Client-side duplicate matching keeps this lightweight for now.
  // Add a server-side duplicate check later if the listings dataset grows.
  const possibleDuplicates = isBizSubmission
    ? findPossibleDuplicates(
        businesses,
        form.businessName ?? "",
        form.address ?? ""
      )
    : [];
  const showDuplicateWarning =
    isBizSubmission &&
    Boolean(form.businessName?.trim()) &&
    Boolean(form.address?.trim()) &&
    possibleDuplicates.length > 0 &&
    (!forcedReason || businessStep === businessSteps.length - 1);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    setDuplicateOverrideConfirmed(false);
  }, [reason, form.businessName, form.address]);

  function getBusinessStepError() {
    if (businessStep === 0) {
      if (!form.ownerName.trim()) return "Add your name to continue.";
      if (!form.ownerEmail.trim()) return "Add your email to continue.";
    }

    if (businessStep === 1) {
      if (!form.businessName?.trim()) return "Add the business name to continue.";
      if (!form.address?.trim()) return "Add the business address to continue.";
    }

    return null;
  }

  function handleBusinessNext() {
    const stepError = getBusinessStepError();

    if (stepError) {
      setError(stepError);
      return;
    }

    setError(null);
    setBusinessStep((current) => Math.min(current + 1, businessSteps.length - 1));
  }

  async function connectGoogleAccount() {
    setGoogleSubmitting(true);
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
      await recordAuthTracking({
        user: credential.user,
        intent: "google_popup",
        providerId: "google.com"
      });
      return credential.user;
    } catch (submitError) {
      setError(formatFirebaseError(submitError));
      return null;
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    const nextUser = await connectGoogleAccount();

    if (!nextUser) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      ownerName: prev.ownerName || nextUser.displayName || "",
      ownerEmail: prev.ownerEmail || nextUser.email || ""
    }));
  }

  async function handleAttachGoogleAfterSubmit() {
    if (!submittedId) {
      return;
    }

    const nextUser = await connectGoogleAccount();

    if (!nextUser) {
      return;
    }

    try {
      await attachGoogleAccountToBusinessSubmission(submittedId, {
        submitterUid: nextUser.uid,
        submitterDisplayName: nextUser.displayName ?? null,
        submitterPhotoUrl: nextUser.photoURL ?? null,
        ownerName: form.ownerName || nextUser.displayName || "",
        ownerEmail: form.ownerEmail || nextUser.email || ""
      });
      setPostSubmitAttached(true);
    } catch (attachError) {
      setError(formatFirebaseError(attachError));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (showDuplicateWarning && !duplicateOverrideConfirmed) {
      setError(
        "A similar business may already be listed. Review the duplicate warning before continuing."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const nextSubmissionId = await submitContactForm({
        reason,
        ...form,
        submitterUid: isBizSubmission ? user?.uid ?? null : null,
        submitterDisplayName: isBizSubmission ? user?.displayName ?? null : null,
        submitterPhotoUrl: isBizSubmission ? user?.photoURL ?? null : null
      });
      setSubmittedId(nextSubmissionId);
      setPostSubmitAttached(Boolean(isBizSubmission && user?.uid));
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">
            Contact form unavailable
          </p>
          <p className="mt-3 text-sm text-stone-400">
            Firebase is not configured. Please reach out via email or social media.
          </p>
        </div>
      </section>
    );
  }

  if (success) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-success/30 bg-success/5 p-10 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            {forcedReason ? "Business submitted." : "Message sent!"}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            {forcedReason
              ? "Thanks. The MKE Black team will review the listing request."
              : "Thank you for reaching out. We'll get back to you soon."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              setForm({
                ownerName: "",
                ownerEmail: "",
                message: "",
                businessName: "",
                businessOwner: "",
                businessEmail: "",
                phone: "",
                address: "",
                website: "",
                logoUrl: "",
                description: ""
              });
              setReason(forcedReason ? "submit_business" : "general");
              setBusinessStep(0);
              setSubmittedId(null);
              setPostSubmitAttached(false);
              setError(null);
            }}
            className="mt-6 rounded-full border border-line px-5 py-3 text-sm text-stone-300 transition hover:border-accent/50 hover:text-ink"
          >
            {forcedReason ? "Submit another business" : "Send another message"}
          </button>
          {forcedReason && submittedId ? (
            <div className="mt-6 rounded-2xl border border-line bg-panelAlt/50 p-5 text-left">
              <p className="text-sm font-semibold text-ink">
                Save your status link
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Use this page to check review status or attach Google before approval.
              </p>
              <Link
                href={`/submission/${submittedId}`}
                className="mt-4 inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
              >
                Open status page
              </Link>
              <Link
                href="/submission"
                className="ml-3 mt-4 inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-400 transition hover:border-accent/35 hover:text-accentSoft"
              >
                Look up by email
              </Link>
            </div>
          ) : null}
          {forcedReason && !postSubmitAttached ? (
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
              <p className="text-sm font-semibold text-ink">
                Want owner access after approval?
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Connect Google to this request now. After admin approval, this
                same account can manage the listing.
              </p>
              <button
                type="button"
                onClick={() => void handleAttachGoogleAfterSubmit()}
                disabled={googleSubmitting || !submittedId}
                className="mt-4 rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
              >
                {googleSubmitting ? "Opening Google..." : "Connect Google to request"}
              </button>
              {error ? (
                <p className="mt-3 text-sm text-rose-300">{error}</p>
              ) : null}
            </div>
          ) : null}
          {forcedReason && postSubmitAttached ? (
            <div className="mt-6 rounded-2xl border border-success/35 bg-success/10 p-5 text-sm leading-6 text-stone-100">
              Google is attached. Once approved, use that Google account to manage the listing.
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            {forcedReason ? "Directory listing" : isSuggestBusiness ? "Suggest a business" : "Contact"}
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            {forcedReason
              ? "Submit business."
              : isSuggestBusiness
              ? "Know a business that belongs here?"
              : "Get in touch."}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            {forcedReason
              ? "Send the core listing details. Admin approval publishes the business in the directory."
              : isSuggestBusiness
              ? "Tell us about a Black-owned business in Milwaukee that should be in the directory — we'll reach out to them directly."
              : "Questions, directory submissions, partnership inquiries, or corrections — send everything through here."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panel/80 p-8">
          {forcedReason ? (
            <div className="mb-8">
              <div className="flex gap-2">
                {businessSteps.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setBusinessStep(index)}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                      index === businessStep
                        ? "bg-accent text-white"
                        : index < businessStep
                        ? "border border-success/35 bg-success/10 text-success"
                        : "border border-line bg-panelAlt/60 text-stone-400"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            {!forcedReason ? (
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Reason for contact
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ContactReason)}
                  className={inputClass}
                  required
                >
                  {reasonOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            ) : null}

            {forcedReason ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={businessStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="sm:col-span-2 grid gap-6 sm:grid-cols-2"
                >
                  {businessStep === 0 ? (
                    <>
                      <div className="sm:col-span-2 rounded-xl border border-line/60 bg-panelAlt/50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                          Connect owner
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-300">
                          Use Google now or add contact details manually. Google lets the owner manage the listing after approval.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={googleSubmitting || !isFirebaseConfigured}
                            className="rounded-full border border-line bg-panelAlt/70 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {user
                              ? `Google connected: ${user.email ?? "account"}`
                              : googleSubmitting
                              ? "Opening Google..."
                              : "Connect Google"}
                          </button>
                          {user ? (
                            <span className="text-xs uppercase tracking-[0.2em] text-success">
                              Attached
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Your name
                          <input
                            type="text"
                            value={form.ownerName}
                            onChange={(e) => update("ownerName", e.target.value)}
                            placeholder="Full name"
                            required
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Your email
                          <input
                            type="email"
                            value={form.ownerEmail}
                            onChange={(e) => update("ownerEmail", e.target.value)}
                            placeholder="you@example.com"
                            required
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {businessStep === 1 ? (
                    <>
                      <div>
                        <label className={labelClass}>
                          Business name
                          <input
                            type="text"
                            value={form.businessName}
                            onChange={(e) => update("businessName", e.target.value)}
                            placeholder="Business name"
                            required
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Business owner
                          <input
                            type="text"
                            value={form.businessOwner}
                            onChange={(e) => update("businessOwner", e.target.value)}
                            placeholder="Owner name"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Business email
                          <input
                            type="email"
                            value={form.businessEmail}
                            onChange={(e) => update("businessEmail", e.target.value)}
                            placeholder="business@example.com"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Phone
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => update("phone", e.target.value)}
                            placeholder="(414) 555-0100"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Address
                          <input
                            type="text"
                            value={form.address}
                            onChange={(e) => update("address", e.target.value)}
                            placeholder="Street address, Milwaukee, WI"
                            required
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {businessStep === 2 ? (
                    <>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Website
                          <input
                            type="url"
                            value={form.website}
                            onChange={(e) => update("website", e.target.value)}
                            placeholder="https://yourbusiness.com"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Logo or brand image URL
                          <input
                            type="url"
                            value={form.logoUrl}
                            onChange={(e) => update("logoUrl", e.target.value)}
                            placeholder="https://yourbusiness.com/logo.png"
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Business description
                          <textarea
                            value={form.description}
                            onChange={(e) => update("description", e.target.value)}
                            placeholder="Brief description of your business..."
                            rows={4}
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Notes
                          <textarea
                            value={form.message}
                            onChange={(e) => update("message", e.target.value)}
                            placeholder="Anything else admins should know?"
                            rows={3}
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            ) : (
              <>
            <div>
              <label className={labelClass}>
                Your name
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={(e) => update("ownerName", e.target.value)}
                  placeholder="Full name"
                  required
                  className={inputClass}
                />
              </label>
            </div>

            <div>
              <label className={labelClass}>
                Your email
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => update("ownerEmail", e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </label>
            </div>

            {isSuggestBusiness ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Business name
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    placeholder="Name of the business you'd like to see listed"
                    required
                    className={inputClass}
                  />
                </label>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className={labelClass}>
                {isSuggestBusiness ? "Why should they be in the directory?" : "Message"}
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder={
                    isSuggestBusiness
                      ? "Tell us about the business — what they do, where they're located, how to reach them…"
                      : "How can we help?"
                  }
                  rows={4}
                  required
                  className={inputClass}
                />
              </label>
            </div>

            {isBizSubmission ? (
              <>
                <div className="sm:col-span-2">
                  <div className="mb-6 rounded-xl border border-line/60 bg-panelAlt/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                      Business listing details
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-300">
                      Sign in with Google to attach this request to your account.
                      Once an admin approves the listing, you can use that same
                      Google account to manage it.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={googleSubmitting || !isFirebaseConfigured}
                        className="rounded-full border border-line bg-panelAlt/70 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user
                          ? `Google connected: ${user.email ?? "account"}`
                          : googleSubmitting
                          ? "Opening Google..."
                          : "Connect Google account"}
                      </button>
                      {user ? (
                        <span className="text-xs uppercase tracking-[0.2em] text-success">
                          Account attached
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Business name
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      placeholder="Business name"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div>
                  <label className={labelClass}>
                    Business owner
                    <input
                      type="text"
                      value={form.businessOwner}
                      onChange={(e) => update("businessOwner", e.target.value)}
                      placeholder="Owner name"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div>
                  <label className={labelClass}>
                    Business email
                    <input
                      type="email"
                      value={form.businessEmail}
                      onChange={(e) => update("businessEmail", e.target.value)}
                      placeholder="business@example.com"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div>
                  <label className={labelClass}>
                    Phone
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="(414) 555-0100"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Address
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => update("address", e.target.value)}
                      placeholder="Street address, Milwaukee, WI"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Website
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Logo or brand image URL
                    <input
                      type="url"
                      value={form.logoUrl}
                      onChange={(e) => update("logoUrl", e.target.value)}
                      placeholder="https://yourbusiness.com/logo.png"
                      className={inputClass}
                    />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    If you do not have a public logo URL, send the request anyway and
                    MKE Black can follow up for the file.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Business description
                    <textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="Brief description of your business..."
                      rows={4}
                      className={inputClass}
                    />
                  </label>
                </div>
              </>
            ) : null}
              </>
            )}
          </div>

          {showDuplicateWarning ? (
            <div className="mt-6 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-5">
              <p className="text-sm font-semibold text-amber-100">
                A business like this may already be listed:
              </p>
              <div className="mt-4 space-y-3">
                {possibleDuplicates.map((business) => (
                  <div
                    key={business.id}
                    className="rounded-xl border border-amber-300/20 bg-panelAlt/60 px-4 py-3"
                  >
                    <p className="font-medium text-stone-100">{business.name}</p>
                    <p className="mt-1 text-sm text-stone-400">
                      {business.address || "Address not provided"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Link
                        href={`/business/${business.id}`}
                        className="font-semibold text-amber-100 transition hover:text-white"
                      >
                        View Listing
                      </Link>
                      <Link
                        href={`/claim/${business.id}`}
                        className="font-semibold text-accentSoft transition hover:text-accent"
                      >
                        Claim This Listing Instead
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {duplicateOverrideConfirmed ? (
                <p className="mt-4 text-sm text-stone-200">
                  Marked as different. You can continue with this submission.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {forcedReason && businessStep > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setBusinessStep((current) => Math.max(current - 1, 0));
                }}
                className="rounded-full border border-line px-8 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                Back
              </button>
            ) : null}

            {forcedReason && businessStep < businessSteps.length - 1 ? (
              <button
                type="button"
                onClick={handleBusinessNext}
                className="rounded-full border border-accent bg-accent px-8 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
              >
                Continue
              </button>
            ) : (
              <button
                type={showDuplicateWarning && !duplicateOverrideConfirmed ? "button" : "submit"}
                onClick={
                  showDuplicateWarning && !duplicateOverrideConfirmed
                    ? () => {
                        setDuplicateOverrideConfirmed(true);
                        setError(null);
                      }
                    : undefined
                }
                disabled={submitting}
                className="rounded-full border border-accent bg-accent px-8 py-3 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
              >
                {showDuplicateWarning && !duplicateOverrideConfirmed
                  ? "No, This Is Different — Continue"
                  : submitting
                    ? "Sending..."
                    : forcedReason
                      ? "Submit Business"
                      : "Send message"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
