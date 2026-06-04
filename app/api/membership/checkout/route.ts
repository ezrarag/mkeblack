import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { getBaseUrl, getStripe } from "@/lib/stripe/server";

type CheckoutKind = "membership" | "donation";
type MembershipPlan = "monthly" | "quarterly" | "yearly";

const membershipPlanConfig: Record<
  MembershipPlan,
  {
    label: string;
    amount: number;
    interval: "month" | "year";
    intervalCount: number;
  }
> = {
  monthly: {
    label: "Monthly Solidarity Circle membership",
    amount: 1000,
    interval: "month",
    intervalCount: 1
  },
  quarterly: {
    label: "Quarterly Solidarity Circle membership",
    amount: 3000,
    interval: "month",
    intervalCount: 3
  },
  yearly: {
    label: "Yearly Solidarity Circle membership",
    amount: 10000,
    interval: "year",
    intervalCount: 1
  }
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getMembershipPlan(value: unknown): MembershipPlan {
  return value === "quarterly" || value === "yearly" ? value : "monthly";
}

function getDonationAmountCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : 2500;
}

export async function POST(req: NextRequest) {
  let body: {
    kind?: CheckoutKind;
    name?: string;
    email?: string;
    membershipPlan?: MembershipPlan;
    donationAmountCents?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind = body.kind === "donation" ? "donation" : "membership";
  const name = getString(body.name);
  const email = getString(body.email).toLowerCase();
  const membershipPlan = getMembershipPlan(body.membershipPlan);
  const donationAmountCents = getDonationAmountCents(body.donationAmountCents);

  if (kind === "membership" && (!name || !email)) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 }
    );
  }

  if (kind === "donation" && donationAmountCents < 100) {
    return NextResponse.json(
      { error: "Donation amount must be at least $1." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const db = getFirebaseAdminDb();
    const baseUrl = getBaseUrl();
    const memberRef =
      kind === "membership" ? db.collection("members").doc() : null;

    if (memberRef) {
      await memberRef.set({
        name,
        email,
        paymentReference: "",
        paymentSource: "stripe",
        status: "pending",
        membershipPlan,
        uid: null,
        businessId: null,
        notes: "Stripe checkout started.",
        benefitIds: [],
        joinedAt: FieldValue.serverTimestamp(),
        expiresAt: null,
        stripeCheckoutSessionId: "",
        stripeCustomerId: "",
        stripeSubscriptionId: ""
      });
    }

    const plan = membershipPlanConfig[membershipPlan];
    const lineItem =
      kind === "membership"
        ? {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: plan.amount,
              product_data: {
                name: plan.label
              },
              recurring: {
                interval: plan.interval,
                interval_count: plan.intervalCount
              }
            }
          }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: donationAmountCents,
              product_data: {
                name: "MKE Black community donation"
              }
            }
          };

    const session = await stripe.checkout.sessions.create({
      mode: kind === "membership" ? "subscription" : "payment",
      line_items: [lineItem],
      customer_email: email || undefined,
      client_reference_id: memberRef?.id,
      metadata: {
        kind,
        memberId: memberRef?.id ?? "",
        membershipPlan: kind === "membership" ? membershipPlan : "",
        donationAmountCents: kind === "donation" ? String(donationAmountCents) : "",
        name,
        email
      },
      success_url: `${baseUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/membership?checkout=cancelled`
    });

    if (memberRef) {
      await memberRef.update({
        stripeCheckoutSessionId: session.id,
        paymentReference: session.id
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
