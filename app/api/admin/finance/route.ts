import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireAdminRequest } from "@/lib/firebase/admin-auth";
import { getMKEBlackStripeAccountId, getStripe } from "@/lib/stripe/server";

const ranges: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? "";
}

function unixDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function balanceFee(charge: Stripe.Charge) {
  const transaction = charge.balance_transaction;
  return typeof transaction === "object" && transaction ? transaction.fee : 0;
}

function productName(item: Stripe.SubscriptionItem) {
  const product = item.price.product;
  return typeof product === "object" && product && !product.deleted
    ? product.name
    : "Solidarity Circle";
}

async function loadFinance(range: string) {
  const accountId = getMKEBlackStripeAccountId();
  if (!accountId) throw new Error("MKE Black Stripe account is not configured.");

  const stripe = getStripe();
  const options = { stripeAccount: accountId };
  const days = ranges[range] ?? ranges["30d"];
  const created = { gte: Math.floor(Date.now() / 1000) - days * 86400 };

  const [balance, charges, subscriptions, payouts, products, prices] = await Promise.all([
    stripe.balance.retrieve({}, options),
    stripe.charges.list(
      { created, limit: 100, expand: ["data.balance_transaction"] },
      options
    ).autoPagingToArray({ limit: 1000 }),
    stripe.subscriptions.list(
      { status: "all", limit: 100, expand: ["data.items.data.price.product"] },
      options
    ).autoPagingToArray({ limit: 1000 }),
    stripe.payouts.list({ limit: 25 }, options),
    stripe.products.list({ limit: 100 }, options),
    stripe.prices.list({ limit: 100, active: true }, options)
  ]);

  const succeeded = charges.filter((charge) => charge.paid && charge.status === "succeeded");
  const grossCents = succeeded.reduce((sum, charge) => sum + charge.amount, 0);
  const refundedCents = succeeded.reduce((sum, charge) => sum + charge.amount_refunded, 0);
  const stripeFeesCents = succeeded.reduce((sum, charge) => sum + balanceFee(charge), 0);
  const platformFeesCents = succeeded.reduce(
    (sum, charge) => sum + (charge.application_fee_amount ?? 0),
    0
  );
  const activeSubscriptions = subscriptions.filter((subscription) =>
    subscription.status === "active" || subscription.status === "trialing"
  );
  const monthlyRecurringCents = activeSubscriptions.reduce((sum, subscription) => {
    return sum + subscription.items.data.reduce((itemSum, item) => {
      const amount = item.price.unit_amount ?? 0;
      const interval = item.price.recurring?.interval;
      const count = item.price.recurring?.interval_count ?? 1;
      if (interval === "year") return itemSum + Math.round(amount / (12 * count));
      if (interval === "month") return itemSum + Math.round(amount / count);
      if (interval === "week") return itemSum + Math.round((amount * 52) / (12 * count));
      return itemSum;
    }, 0);
  }, 0);

  const availableCents = balance.available
    .filter((entry) => entry.currency === "usd")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingCents = balance.pending
    .filter((entry) => entry.currency === "usd")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    accountId,
    range: Object.hasOwn(ranges, range) ? range : "30d",
    generatedAt: new Date().toISOString(),
    summary: {
      grossCents,
      refundedCents,
      stripeFeesCents,
      platformFeesCents,
      netCents: grossCents - refundedCents - stripeFeesCents - platformFeesCents,
      availableCents,
      pendingCents,
      activeSubscriptions: activeSubscriptions.length,
      monthlyRecurringCents,
      failedPayments: charges.filter((charge) => charge.status === "failed").length,
      disputes: charges.filter((charge) => charge.disputed).length
    },
    transactions: charges.slice(0, 100).map((charge) => ({
      id: charge.id,
      createdAt: unixDate(charge.created),
      amountCents: charge.amount,
      refundedCents: charge.amount_refunded,
      currency: charge.currency,
      status: charge.status,
      disputed: charge.disputed,
      customerEmail: charge.billing_details.email ?? "",
      description: charge.description ?? charge.metadata?.kind ?? "Payment",
      kind: charge.metadata?.kind ?? "payment",
      stripeFeeCents: balanceFee(charge),
      platformFeeCents: charge.application_fee_amount ?? 0
    })),
    subscriptions: subscriptions.slice(0, 100).map((subscription) => {
      const item = subscription.items.data[0];
      const periodEnd = subscription.items.data.reduce(
        (latest, current) => Math.max(latest, current.current_period_end),
        0
      );
      return {
        id: subscription.id,
        customerId: idOf(subscription.customer),
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: unixDate(periodEnd),
        productName: item ? productName(item) : "Solidarity Circle",
        amountCents: item?.price.unit_amount ?? 0,
        interval: item?.price.recurring?.interval ?? ""
      };
    }),
    payouts: payouts.data.map((payout) => ({
      id: payout.id,
      amountCents: payout.amount,
      status: payout.status,
      arrivalDate: unixDate(payout.arrival_date),
      createdAt: unixDate(payout.created)
    })),
    products: products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      active: product.active,
      prices: prices.data
        .filter((price) => idOf(price.product) === product.id)
        .map((price) => ({
          id: price.id,
          amountCents: price.unit_amount ?? 0,
          currency: price.currency,
          recurring: price.recurring?.interval ?? null
        }))
    })),
    alerts: [
      ...subscriptions
        .filter((subscription) => ["past_due", "unpaid", "incomplete"].includes(subscription.status))
        .map((subscription) => ({
          id: `subscription:${subscription.id}`,
          severity: "warning",
          message: `Subscription ${subscription.id} is ${subscription.status.replace("_", " ")}.`
        })),
      ...charges
        .filter((charge) => charge.disputed)
        .map((charge) => ({
          id: `dispute:${charge.id}`,
          severity: "urgent",
          message: `Payment ${charge.id} has an active dispute.`
        }))
    ]
  };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadFinance(req.nextUrl.searchParams.get("range") ?? "30d"));
  } catch (error) {
    console.error("Unable to load MKE financial dashboard", error);
    return NextResponse.json({ error: "Unable to load financial information." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await requireAdminRequest(req);
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = getMKEBlackStripeAccountId();
  if (!accountId) return NextResponse.json({ error: "Stripe account is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  const options = { stripeAccount: accountId };
  const stripe = getStripe();

  try {
    let result: Record<string, unknown> = {};
    if (action === "cancel_subscription_at_period_end" && resourceId) {
      const subscription = await stripe.subscriptions.update(
        resourceId,
        { cancel_at_period_end: true },
        options
      );
      result = { subscriptionId: subscription.id, cancelAtPeriodEnd: true };
    } else if (action === "refund_payment" && resourceId) {
      const refund = await stripe.refunds.create({ charge: resourceId }, options);
      result = { refundId: refund.id, status: refund.status };
    } else if (action === "archive_product" && resourceId) {
      const product = await stripe.products.update(resourceId, { active: false }, options);
      result = { productId: product.id, active: product.active };
    } else if (action === "create_product") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const amountCents = Number(body.amountCents);
      const recurring = body.recurring === "month" || body.recurring === "year" ? body.recurring : null;
      if (!name || !Number.isInteger(amountCents) || amountCents < 50) {
        return NextResponse.json({ error: "A name and valid amount are required." }, { status: 400 });
      }
      const product = await stripe.products.create(
        { name, description: typeof body.description === "string" ? body.description.trim() : undefined },
        options
      );
      const price = await stripe.prices.create(
        {
          product: product.id,
          currency: "usd",
          unit_amount: amountCents,
          recurring: recurring ? { interval: recurring } : undefined
        },
        options
      );
      result = { productId: product.id, priceId: price.id };
    } else {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    await context.db.collection("financial_audit_log").add({
      action,
      resourceId,
      result,
      adminUid: context.decoded.uid,
      adminEmail: context.decoded.email ?? "",
      createdAt: FieldValue.serverTimestamp()
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`Unable to perform financial action ${action}`, error);
    return NextResponse.json({ error: "The financial action could not be completed." }, { status: 500 });
  }
}
