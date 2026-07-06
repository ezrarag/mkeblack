import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";

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

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
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

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Stripe webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
