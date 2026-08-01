import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  getMKEBlackStripeAccountId,
  getStripe
} from "@/lib/stripe/server";
import {
  invoiceSubscriptionId,
  memberStatusForSubscription,
  subscriptionMemberId,
  subscriptionPeriodEnd
} from "@/lib/stripe/membership-lifecycle";

function getId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? "";
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind === "marketplace_order") {
    const orderId = session.metadata.orderId || session.client_reference_id;

    if (!orderId) {
      throw new Error("Stripe checkout session is missing marketplace orderId metadata.");
    }

    const saleAmountCents = Number(session.metadata.saleAmountCents ?? "0");
    const platformFeeCents = Number(session.metadata.platformFeeCents ?? "0");
    const netToBusinessCents = Number(session.metadata.netToBusinessCents ?? "0");
    const db = getFirebaseAdminDb();

    await db.collection("marketplace_orders").doc(orderId).set(
      {
        status: "paid",
        paymentSource: "stripe",
        paymentReference: session.id,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: getId(session.customer),
        stripePaymentStatus: session.payment_status,
        customerEmail:
          session.customer_details?.email ??
          session.customer_email ??
          "",
        paidAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await db.collection("revenue_share_ledger").doc(orderId).set(
      {
        id: orderId,
        orderId,
        businessId: session.metadata.businessId ?? "",
        businessName: session.metadata.businessName ?? "",
        saleAmountCents: Number.isFinite(saleAmountCents) ? saleAmountCents : 0,
        platformFeeCents: Number.isFinite(platformFeeCents) ? platformFeeCents : 0,
        netToBusinessCents: Number.isFinite(netToBusinessCents)
          ? netToBusinessCents
          : 0,
        status: "pending_payout",
        createdAt: FieldValue.serverTimestamp(),
        paidOutAt: null
      },
      { merge: true }
    );
    return;
  }

  if (session.metadata?.kind === "event_ticket") {
    const orderId = session.metadata.orderId || session.client_reference_id;

    if (!orderId) {
      throw new Error("Stripe checkout session is missing orderId metadata.");
    }

    const db = getFirebaseAdminDb();
    await db.collection("event_ticket_orders").doc(orderId).set(
      {
        status: "paid",
        paymentSource: "stripe",
        paymentReference: session.id,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: getId(session.customer),
        stripePaymentStatus: session.payment_status,
        paidAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return;
  }

  if (session.metadata?.kind !== "membership") {
    return;
  }

  const memberId = session.metadata.memberId || session.client_reference_id;

  if (!memberId) {
    throw new Error("Stripe checkout session is missing memberId metadata.");
  }

  const db = getFirebaseAdminDb();
  const pendingSubmissionId = session.metadata?.pendingSubmissionId ?? "";
  await db.collection("members").doc(memberId).set(
    {
      status: "active",
      paymentSource: "stripe",
      paymentReference: session.id,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: getId(session.customer),
      stripeSubscriptionId: getId(session.subscription),
      stripeAccountId: getMKEBlackStripeAccountId() ?? "",
      stripePaymentStatus: session.payment_status,
      activatedAt: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
      notes: "Activated by Stripe checkout."
    },
    { merge: true }
  );

  if (pendingSubmissionId) {
    await db.collection("contactSubmissions").doc(pendingSubmissionId).set(
      {
        solidarityPaymentStatus: "active",
        solidarityMemberId: memberId,
        solidarityCheckoutSessionId: session.id,
        solidarityActivatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }
}

async function findMemberRef({
  memberId,
  subscriptionId,
  customerId
}: {
  memberId?: string;
  subscriptionId?: string;
  customerId?: string;
}) {
  const db = getFirebaseAdminDb();
  if (memberId) return db.collection("members").doc(memberId);

  for (const [field, value] of [
    ["stripeSubscriptionId", subscriptionId],
    ["stripeCustomerId", customerId]
  ] as const) {
    if (!value) continue;
    const snapshot = await db
      .collection("members")
      .where(field, "==", value)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshot.docs[0].ref;
  }

  return null;
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  const customerId = getId(subscription.customer);
  const memberRef = await findMemberRef({
    memberId: subscriptionMemberId(subscription),
    subscriptionId: subscription.id,
    customerId
  });

  if (!memberRef) {
    console.warn(`[stripe] No member found for subscription ${subscription.id}.`);
    return;
  }

  const periodEnd = subscriptionPeriodEnd(subscription);
  const status = memberStatusForSubscription(subscription.status);
  await memberRef.set(
    {
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripeSubscriptionStatus: subscription.status,
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCanceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      expiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      stripeLifecycleUpdatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function handleInvoiceStatus(invoice: Stripe.Invoice, paid: boolean) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const customerId = getId(invoice.customer);
  const memberRef = await findMemberRef({ subscriptionId, customerId });
  if (!memberRef) {
    console.warn(`[stripe] No member found for invoice ${invoice.id}.`);
    return;
  }

  await memberRef.set(
    {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeLatestInvoiceId: invoice.id,
      stripePaymentStatus: paid ? "paid" : "payment_failed",
      stripeLastPaymentAt: paid ? FieldValue.serverTimestamp() : null,
      stripeLastPaymentFailureAt: paid ? null : FieldValue.serverTimestamp(),
      stripeLifecycleUpdatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function POST(req: NextRequest) {
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  ].filter((value): value is string => Boolean(value));

  if (!webhookSecrets.length) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event | null = null;

  try {
    const rawBody = await req.text();
    for (const webhookSecret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
        break;
      } catch {
        // The platform and connected-account endpoints have separate secrets.
      }
    }

    if (!event) {
      throw new Error("Webhook signature did not match a configured endpoint.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Stripe webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      event.account &&
      event.account !== getMKEBlackStripeAccountId()
    ) {
      return NextResponse.json({ received: true, ignored: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoiceStatus(event.data.object, true);
        break;
      case "invoice.payment_failed":
        await handleInvoiceStatus(event.data.object, false);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
