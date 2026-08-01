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

export function getBaseUrl(requestOrigin?: string) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/$/, "");

  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      const isPublicMkeBlackHost =
        url.hostname === "mkeblack.org" || url.hostname === "www.mkeblack.org";
      const isLocalHost =
        url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const isPreviewHost =
        process.env.VERCEL_ENV !== "production" &&
        url.hostname.endsWith(".vercel.app");

      if (isPublicMkeBlackHost || isLocalHost || isPreviewHost) {
        return url.origin.replace(/\/$/, "");
      }
    } catch {
      // Continue to a trusted environment fallback for malformed origins.
    }
  }

  // Production Checkout must never redirect customers to a protected,
  // deployment-specific Vercel URL.
  if (process.env.VERCEL_ENV === "production") {
    return "https://www.mkeblack.org";
  }

  return (
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Rick Banks / MKE Black Incorporated Stripe account ID.
 * Memberships and donations are created as direct charges on this connected
 * account. MKE Black owns the payment/customer/subscription records and the
 * platform receives only the configured application fee.
 */
export function getMKEBlackStripeAccountId(): string | undefined {
  return process.env.STRIPE_MKE_BLACK_ACCOUNT_ID || undefined;
}

export function isStripeDestinationAccountReady(
  account: Pick<Stripe.Account, "details_submitted" | "capabilities">
) {
  return (
    account.details_submitted === true &&
    account.capabilities?.transfers === "active" &&
    account.capabilities?.card_payments === "active"
  );
}

export async function getReadyStripeDestinationAccountId() {
  const accountId = getMKEBlackStripeAccountId();
  if (!accountId) return undefined;

  try {
    const account = await getStripe().accounts.retrieve(accountId);
    return isStripeDestinationAccountReady(account) ? accountId : undefined;
  } catch (error) {
    console.error("Unable to verify the Stripe connected account", error);
    return undefined;
  }
}

function parsePlatformFeeRate(rawValue: string, variableName: string) {
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue >= 1) {
    throw new Error(`${variableName} must be a decimal between 0 and 1.`);
  }

  return parsedValue;
}

export function getPlatformFeeRate() {
  return parsePlatformFeeRate(
    process.env.PLATFORM_FEE_RATE ?? "0.05",
    "PLATFORM_FEE_RATE"
  );
}

export function getDonationPlatformFeeRate() {
  return parsePlatformFeeRate(
    process.env.DONATION_PLATFORM_FEE_RATE ?? "0.025",
    "DONATION_PLATFORM_FEE_RATE"
  );
}
