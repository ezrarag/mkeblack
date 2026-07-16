import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured.");
  }

  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia"
    });
  }

  return stripe;
}

export function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Rick Banks / MKE Black Incorporated Stripe account ID.
 * Payments are collected on RAG's platform account and transferred
 * to MKE Black via Stripe Connect (destination charges).
 * Once Rick's account review is complete, all membership payments
 * settle directly into MKE Black's bank account.
 */
export function getMKEBlackStripeAccountId(): string | undefined {
  return process.env.STRIPE_MKE_BLACK_ACCOUNT_ID || undefined;
}

export async function getReadyStripeDestinationAccountId() {
  const accountId = getMKEBlackStripeAccountId();
  if (!accountId) return undefined;

  try {
    const account = await getStripe().accounts.retrieve(accountId);
    const transfersReady = account.capabilities?.transfers === "active";

    return account.details_submitted && transfersReady ? accountId : undefined;
  } catch (error) {
    console.error("Unable to verify the Stripe connected account", error);
    return undefined;
  }
}

export function getPlatformFeeRate() {
  const rawValue = process.env.PLATFORM_FEE_RATE ?? "0.05";
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue >= 1) {
    throw new Error("PLATFORM_FEE_RATE must be a decimal between 0 and 1.");
  }

  return parsedValue;
}
