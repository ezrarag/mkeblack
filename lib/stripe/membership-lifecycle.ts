import type Stripe from "stripe";

export type MemberLifecycleStatus = "active" | "pending" | "expired";

export function memberStatusForSubscription(
  status: Stripe.Subscription.Status
): MemberLifecycleStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "incomplete") return "pending";
  return "expired";
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  return periodEnds.length ? Math.max(...periodEnds) : null;
}

export function subscriptionMemberId(subscription: Stripe.Subscription) {
  return subscription.metadata?.memberId?.trim() ?? "";
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id ?? "";
}
