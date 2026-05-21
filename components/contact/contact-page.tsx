"use client";

import { useState } from "react";
import {
  submitContactForm,
  type ContactFormData,
  type ContactReason
} from "@/lib/firebase/contact";
import { isFirebaseConfigured } from "@/lib/firebase/client";

const reasonOptions: { value: ContactReason; label: string }[] = [
  { value: "general", label: "General inquiry" },
  { value: "submit_business", label: "Submit a business listing" },
  { value: "partnership", label: "Partnership or sponsorship" },
  { value: "correction", label: "Directory correction" },
  { value: "other", label: "Other" }
];

const inputClass =
  "mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";
const labelClass = "block text-xs font-semibold uppercase tracking-[0.18em] text-muted";

export function ContactPage() {
  const [reason, setReason] = useState<ContactReason>("general");
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBizSubmission = reason === "submit_business";

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await submitContactForm({ reason, ...form });
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
            Message sent!
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Thank you for reaching out. We&apos;ll get back to you soon.
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
              setReason("general");
            }}
            className="mt-6 rounded-full border border-line px-5 py-3 text-sm text-stone-300 transition hover:border-accent/50 hover:text-ink"
          >
            Send another message
          </button>
        </div>
      </section>
    );
  }

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Contact
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Get in touch.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Questions, directory submissions, partnership inquiries, or corrections —
            send everything through here.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panel/80 p-8">
          <div className="grid gap-6 sm:grid-cols-2">
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

            <div className="sm:col-span-2">
              <label className={labelClass}>
                Message
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="How can we help?"
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
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="mt-8">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full border border-accent bg-accent px-8 py-3 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
