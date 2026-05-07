"use client";

import Link from "next/link";
import { useState } from "react";
import { submitMembershipInterest } from "@/lib/firebase/members";
import { isFirebaseConfigured } from "@/lib/firebase/client";

const GIVEBUTTER_URL = "https://givebutter.com/PRbf2u";

const benefits = [
  {
    icon: "🎽",
    title: "Free MKE Black T-shirt",
    description:
      "Every Solidarity Circle member receives a free MKE Black T-shirt as a thank-you for supporting the community."
  },
  {
    icon: "🏪",
    title: "Discounts at Black-owned businesses",
    description:
      "Access exclusive offers and discounts from Milwaukee Black-owned businesses — only available to Solidarity Circle members."
  },
  {
    icon: "🎟",
    title: "Exclusive member-only events",
    description:
      "Get first access to private mixers, community dinners, and cultural gatherings reserved for Solidarity Circle members."
  },
  {
    icon: "📣",
    title: "Amplify the community",
    description:
      "Your membership directly funds the directory, social media promotions, and outreach that drives Black community wealth in Milwaukee."
  }
];

type FormStep = "idle" | "form" | "submitting" | "done";

export function MembershipPage() {
  const [formStep, setFormStep] = useState<FormStep>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setFormStep("submitting");
    setError(null);
    try {
      await submitMembershipInterest({
        name: name.trim(),
        email: email.trim(),
        paymentReference: reference.trim() || undefined
      });
      setFormStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setFormStep("form");
    }
  }

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Solidarity Circle
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Join the Solidarity Circle.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Support Milwaukee&apos;s Black business community. Your membership funds the
            directory, events, and connections that build real community wealth.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href={GIVEBUTTER_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-accent bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
            >
              Become a member on Givebutter
            </a>
            <a
              href="#already-joined"
              onClick={(e) => {
                e.preventDefault();
                setFormStep("form");
                setTimeout(() => {
                  document
                    .getElementById("already-joined")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }}
              className="rounded-full border border-line px-7 py-3.5 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
            >
              I already joined
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Member benefits
        </p>
        <h2 className="mt-4 font-display text-3xl font-black leading-tight text-ink">
          What you get as a member.
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-line bg-panel/80 p-7"
            >
              <p className="text-3xl">{benefit.icon}</p>
              <p className="mt-4 font-display text-lg font-bold text-ink">
                {benefit.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-400">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            Ready to join?
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Membership is processed securely through Givebutter. Once you join, come back here
            to link your account.
          </p>
          <a
            href={GIVEBUTTER_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex rounded-full border border-accent bg-accent px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            Join on Givebutter →
          </a>
        </div>

        <div id="already-joined" className="mt-12 scroll-mt-24">
          <div className="rounded-2xl border border-line bg-panel/80 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
              Already a member?
            </p>
            <h2 className="mt-4 font-display text-2xl font-bold text-ink">
              Link your membership to this account.
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              After joining on Givebutter, enter your details below so MKE Black can
              connect your membership with your directory profile and send you member benefits.
            </p>

            {formStep === "idle" ? (
              <button
                type="button"
                onClick={() => setFormStep("form")}
                className="mt-6 rounded-full border border-line px-6 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                I already joined — connect my account
              </button>
            ) : formStep === "done" ? (
              <div className="mt-6 rounded-xl border border-success/35 bg-success/10 p-5">
                <p className="font-semibold text-ink">You&apos;re registered!</p>
                <p className="mt-2 text-sm leading-7 text-stone-300">
                  We&apos;ve received your details. An MKE Black admin will verify your
                  membership and activate your benefits shortly. Questions?{" "}
                  <Link href="/contact" className="text-accent hover:text-accentSoft">
                    Contact us.
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Full name
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Your name"
                      className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Givebutter transaction ID{" "}
                    <span className="normal-case tracking-normal text-stone-500">
                      (optional — helps us verify faster)
                    </span>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. GB-12345"
                      className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
                {!isFirebaseConfigured ? (
                  <p className="text-xs text-stone-500">
                    Account linking is unavailable in this environment.
                  </p>
                ) : null}
                {error ? (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-300">
                    {error}
                  </p>
                ) : null}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={formStep === "submitting" || !isFirebaseConfigured}
                    className="rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {formStep === "submitting" ? "Submitting…" : "Submit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStep("idle")}
                    className="rounded-full border border-line px-5 py-3 text-sm text-stone-400 transition hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-accent/20 bg-panelAlt/50 p-6 text-center">
          <p className="text-sm text-stone-400">
            Prefer a one-time donation instead?{" "}
            <a
              href="https://www.mkeblack.org/donate"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent transition hover:text-accentSoft"
            >
              Donate here →
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
