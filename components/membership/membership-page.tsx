"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

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
      "Access exclusive offers and discounts from Milwaukee Black-owned businesses only available to Solidarity Circle members."
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

const membershipPlans = [
  {
    id: "monthly",
    label: "Monthly",
    price: "$10",
    cadence: "per month",
    description: "A steady way to support the directory and member benefits."
  },
  {
    id: "quarterly",
    label: "Quarterly",
    price: "$30",
    cadence: "every 3 months",
    description: "Support the mission season by season."
  },
  {
    id: "yearly",
    label: "Yearly",
    price: "$100",
    cadence: "per year",
    description: "Best value for annual Solidarity Circle membership."
  }
] as const;

const donationAmounts = [5, 25, 50, 100] as const;

type CheckoutKind = "membership" | "donation";
type MembershipPlanId = (typeof membershipPlans)[number]["id"];

export function MembershipPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutKind, setCheckoutKind] = useState<CheckoutKind>("membership");
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanId>("monthly");
  const [selectedDonation, setSelectedDonation] = useState<number>(25);
  const [customDonation, setCustomDonation] = useState("");
  const [submittingKind, setSubmittingKind] = useState<CheckoutKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const donationAmount =
    customDonation.trim() === "" ? selectedDonation : Number(customDonation);

  useEffect(() => {
    function syncHash() {
      if (window.location.hash === "#donate") {
        setCheckoutKind("donation");
      } else if (window.location.hash === "#join") {
        setCheckoutKind("membership");
      }
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (!user) return;
    setName((currentName) => currentName || user.displayName || "");
    setEmail((currentEmail) => currentEmail || user.email || "");
  }, [user]);

  async function startCheckout(kind: CheckoutKind) {
    if (kind === "membership" && (!name.trim() || !email.trim())) {
      setError("Enter your name and email before continuing to checkout.");
      return;
    }

    if (kind === "donation" && (!Number.isFinite(donationAmount) || donationAmount < 1)) {
      setError("Choose or enter a donation amount of at least $1.");
      return;
    }

    setSubmittingKind(kind);
    setError(null);

    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          email: email.trim(),
          membershipPlan: selectedPlan,
          donationAmountCents: Math.round(donationAmount * 100),
          uid: user?.uid ?? ""
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
      setSubmittingKind(null);
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
            Join or support MKE Black.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Choose a recurring Solidarity Circle membership or make a one-time
            donation. Both support the directory, events, and connections that
            build real community wealth.
          </p>
        </div>
      </section>

      <section id="join" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["membership", "donation"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setCheckoutKind(kind);
                  setError(null);
                }}
                className={`rounded-2xl border p-5 text-left transition ${
                  checkoutKind === kind
                    ? "border-accent bg-accent/10"
                    : "border-line bg-panelAlt/70 hover:border-accent/35"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                  {kind === "membership" ? "Join" : "Donate"}
                </p>
                <p className="mt-3 font-display text-2xl font-black text-ink">
                  {kind === "membership" ? "Solidarity Circle" : "One-time gift"}
                </p>
                <p className="mt-2 text-sm leading-7 text-stone-400">
                  {kind === "membership"
                    ? "Recurring membership with access to member benefits."
                    : "Support the mission without starting a membership."}
                </p>
              </button>
            ))}
          </div>

          {checkoutKind === "membership" ? (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                Choose membership plan
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {membershipPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selectedPlan === plan.id
                        ? "border-accent bg-accent/10"
                        : "border-line bg-panelAlt/70 hover:border-accent/35"
                    }`}
                  >
                    <p className="font-display text-xl font-bold text-ink">{plan.label}</p>
                    <p className="mt-3 font-display text-4xl font-black text-accent">
                      {plan.price}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-300">
                      {plan.cadence}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-stone-400">
                      {plan.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div id="donate" className="mt-8 scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                Choose donation amount
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {donationAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setSelectedDonation(amount);
                      setCustomDonation("");
                    }}
                    className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                      customDonation.trim() === "" && selectedDonation === amount
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-panelAlt/70 text-ink hover:border-accent/35"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
                <label className="flex min-w-40 items-center rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm font-semibold text-ink">
                  $
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customDonation}
                    onChange={(event) => setCustomDonation(event.target.value)}
                    placeholder="Custom"
                    className="ml-2 border-0 bg-transparent p-0 text-sm focus:ring-0"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
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
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void startCheckout(checkoutKind)}
            disabled={submittingKind !== null}
            className="mt-8 rounded-full border border-accent bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
          >
            {submittingKind
              ? "Opening checkout..."
              : checkoutKind === "membership"
                ? "Continue to membership checkout"
                : "Continue to donation checkout"}
          </button>
        </div>
      </section>

      <section id="benefits" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8">
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
      </section>
    </main>
  );
}
