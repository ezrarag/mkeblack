import Stripe from "stripe";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

const PROFESSIONALS_COLLECTION = "professionals";

/**
 * MKE Black's core platform/referral wallet — a Stripe Connect account (or
 * the platform account itself, if commissions settle there directly) that
 * receives the referral commission split described in
 * `Professional.referralPercentage`.
 *
 * Intentionally read from an env var only; never hardcode an account ID.
 * Unset in local/dev is fine — split-transfer logic below no-ops with a
 * warning instead of throwing, so webhook processing (toggling
 * subscriptionActive) still succeeds even if the wallet isn't configured
 * yet in a given environment.
 */
export function getReferralWalletAccountId(): string | undefined {
  return process.env.STRIPE_REFERRAL_WALLET_ACCOUNT_ID || undefined;
}

export async function findProfessionalDocByStripeCustomerId(
  stripeCustomerId: string
) {
  const db = getFirebaseAdminDb();
  const snapshot = await db
    .collection(PROFESSIONALS_COLLECTION)
    .where("stripeCustomerId", "==", stripeCustomerId)
    .limit(1)
    .get();

  return snapshot.docs[0] ?? null;
}

/**
 * Stripe Connect split-payment routing (structural outline).
 *
 * MKE Black is the PLATFORM account. Each professional has their own
 * CONNECTED account (`stripeConnectAccountId`) that their subscription
 * revenue should ultimately reach, minus:
 *   1. Stripe's own processing fees (handled automatically by Stripe).
 *   2. The platform's take (if any) — via `application_fee_amount` on a
 *      destination charge, OR by not using destination charges at all if
 *      100% should reach the professional before referral commission.
 *   3. The referral commission (`referralPercentage`) — this is the
 *      "nonprofit referral wallet" split, and it is NOT something Stripe
 *      Billing's subscription/invoice objects route automatically. It has
 *      to be moved explicitly, after the invoice is paid, via a separate
 *      `stripe.transfers.create(...)` call FROM the platform balance TO
 *      the referral wallet account.
 *
 * Recommended shape once the professional's Price/Product is set up as a
 * destination charge on their connected account:
 *   - Stripe collects the full subscription amount on the PLATFORM balance
 *     (do not set `transfer_data.destination` on the subscription/invoice
 *     itself if the referral cut needs to be computed and split before the
 *     professional's net amount moves).
 *   - On `invoice.payment_succeeded`, compute:
 *       referralCents = round(invoice.amount_paid * referralPercentage)
 *       professionalNetCents = invoice.amount_paid - referralCents
 *   - Create TWO transfers with a shared `transfer_group` (e.g. the invoice
 *     id) so they're auditable as one logical split:
 *       stripe.transfers.create({ amount: professionalNetCents, currency, destination: stripeConnectAccountId, transfer_group })
 *       stripe.transfers.create({ amount: referralCents, currency, destination: referralWalletAccountId, transfer_group })
 *   - Both transfers pull from the platform's available balance, so timing
 *     (available balance vs. pending) matters in production — Stripe will
 *     reject a transfer that exceeds currently available funds.
 *
 * This function performs the REFERRAL leg only (the platform-to-professional
 * leg is a product/pricing decision to finalize in the Stripe Dashboard, per
 * the scope guard — not something to hardcode here). It is deliberately
 * conservative: any missing config or Stripe error is logged and swallowed
 * so a referral-transfer hiccup never blocks the core
 * subscriptionActive toggle, which is the higher-priority side effect of
 * these webhook events.
 */
export async function routeReferralCommission({
  stripe,
  invoice,
  referralPercentage
}: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
  referralPercentage: number;
}) {
  const walletAccountId = getReferralWalletAccountId();

  if (!walletAccountId) {
    console.warn(
      "[stripe-professionals] STRIPE_REFERRAL_WALLET_ACCOUNT_ID not set — skipping referral commission transfer."
    );
    return;
  }

  if (!Number.isFinite(referralPercentage) || referralPercentage <= 0) {
    return;
  }

  const amountPaid = invoice.amount_paid ?? 0;
  const referralCents = Math.round(amountPaid * referralPercentage);

  if (referralCents <= 0) {
    return;
  }

  try {
    await stripe.transfers.create({
      amount: referralCents,
      currency: invoice.currency,
      destination: walletAccountId,
      transfer_group: invoice.id,
      description: `MKE Black referral commission for invoice ${invoice.id}`
    });
  } catch (error) {
    // Never let a referral-transfer failure block subscriptionActive
    // updates — surface it for manual follow-up instead.
    console.error(
      `[stripe-professionals] Referral transfer failed for invoice ${invoice.id}`,
      error
    );
  }
}
