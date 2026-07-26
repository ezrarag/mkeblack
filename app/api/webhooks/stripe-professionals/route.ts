import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import {
  findProfessionalDocByStripeCustomerId,
  routeReferralCommission
} from "@/lib/stripe/professionals";

/**
 * Stripe Billing webhook for the Professional Business Directory.
 *
 * Deliberately a SEPARATE endpoint from app/api/webhooks/stripe/route.ts
 * (which handles marketplace orders, event tickets, and Solidarity Circle
 * membership checkout). Business Directory subscriptions are a distinct
 * product/revenue line with their own lifecycle events, so keeping this on
 * its own route/signing secret means a regression here can't take down the
 * existing membership/marketplace/event webhook flow, and vice versa.
 *
 * You'll need to (this is on you, per the scope guard — not done here):
 *   1. Create this endpoint in Stripe Dashboard → Developers → Webhooks,
 *      pointing at https://<domain>/api/webhooks/stripe-professionals
 *   2. Subscribe it to: customer.subscription.updated,
 *      invoice.payment_succeeded, invoice.payment_failed
 *   3. Set STRIPE_PROFESSIONALS_WEBHOOK_SECRET in Vercel to that endpoint's
 *      signing secret (distinct from STRIPE_WEBHOOK_SECRET, which belongs
 *      to the other endpoint)
 *   4. Set STRIPE_REFERRAL_WALLET_ACCOUNT_ID if/when the referral transfer
 *      leg (see lib/stripe/professionals.ts) should actually run
 *
 * No credentials are read from anywhere but process.env.
 */

async function setSubscriptionActive(
  customerId: string,
  active: boolean,
  reason: string
) {
  const professionalDoc = await findProfessionalDocByStripeCustomerId(customerId);

  if (!professionalDoc) {
    console.warn(
      `[stripe-professionals] No professionals doc found for stripeCustomerId=${customerId} (${reason})`
    );
    return null;
  }

  await professionalDoc.ref.set(
    {
      subscriptionActive: active,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return professionalDoc;
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Mirror Stripe's own notion of "active" rather than re-deriving it —
  // trialing counts as active for access purposes; anything else does not.
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  await setSubscriptionActive(
    customerId,
    isActive,
    `subscription.status=${subscription.status}`
  );
}

async function handleInvoicePaymentSucceeded(
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  if (!customerId) {
    console.warn("[stripe-professionals] invoice.payment_succeeded missing customer id");
    return;
  }

  const professionalDoc = await setSubscriptionActive(
    customerId,
    true,
    "invoice.payment_succeeded"
  );

  if (!professionalDoc) return;

  const referralPercentage = Number(professionalDoc.data()?.referralPercentage ?? 0);

  // See lib/stripe/professionals.ts for the full split-payment structure —
  // this call performs only the referral-commission leg of that split.
  await routeReferralCommission({ stripe, invoice, referralPercentage });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  if (!customerId) {
    console.warn("[stripe-professionals] invoice.payment_failed missing customer id");
    return;
  }

  await setSubscriptionActive(customerId, false, "invoice.payment_failed");
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_PROFESSIONALS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Professionals Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Stripe webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        await handleInvoicePaymentSucceeded(stripe, event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        // Ignore anything else — this endpoint intentionally only
        // subscribes to the three event types above in the Dashboard.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error("[stripe-professionals] Webhook handler error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
