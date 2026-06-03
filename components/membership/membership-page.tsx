"use client";

import { useState } from "react";

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

type CheckoutKind = "membership" | "donation";

export function MembershipPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutKind, setCheckoutKind] = useState<CheckoutKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(kind: CheckoutKind) {
    if (kind === "membership" && (!name.trim() || !email.trim())) {
      setError("Enter your name and email before continuing to checkout.");
      return;
    }

    setCheckoutKind(kind);
    setError(null);

    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          email: email.trim()
        })
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to start checkout.");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setCheckoutKind(null);
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
          <div className="mt-8 grid max-w-xl gap-4 rounded-2xl border border-line bg-panel/80 p-5 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Full name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm normal-case tracking-normal text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm normal-case tracking-normal text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="button"
                onClick={() => void startCheckout("membership")}
                disabled={checkoutKind !== null}
                className="rounded-full border border-accent bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
              >
                {checkoutKind === "membership"
                  ? "Opening checkout..."
                  : "Continue to checkout"}
              </button>
              <button
                type="button"
                onClick={() => void startCheckout("donation")}
                disabled={checkoutKind !== null}
                className="rounded-full border border-line px-7 py-3.5 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink disabled:opacity-50"
              >
                {checkoutKind === "donation" ? "Opening checkout..." : "Donate"}
              </button>
            </div>
            {error ? (
              <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-300 sm:col-span-2">
                {error}
              </p>
            ) : null}
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
            Membership is processed securely through Stripe Checkout. After payment,
            your member record is activated automatically.
          </p>
          <button
            type="button"
            onClick={() => void startCheckout("membership")}
            disabled={checkoutKind !== null}
            className="mt-6 inline-flex rounded-full border border-accent bg-accent px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
          >
            {checkoutKind === "membership" ? "Opening checkout..." : "Join now"}
          </button>
        </div>
      </section>
    </main>
  );
}
