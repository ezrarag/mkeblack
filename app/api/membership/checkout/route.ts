import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  getBaseUrl,
  getPlatformFeeRate,
  getReadyStripeDestinationAccountId,
  getStripe
} from "@/lib/stripe/server";
import {
  createSolidarityCheckoutSession,
  StripeDestinationUnavailableError
} from "@/lib/stripe/solidarity-checkout";

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
    pendingSubmissionId?: string;
    pendingBusinessName?: string;
    uid?: string;
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
  const pendingSubmissionId = getString(body.pendingSubmissionId);
  const pendingBusinessName = getString(body.pendingBusinessName);
  const uid = getString(body.uid);

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

    // MKE Black's connected account. Solidarity subscriptions fail closed if
    // this account is not fully ready; they must never become platform-only.
    const mkeBlackAccountId = await getReadyStripeDestinationAccountId();

    const memberRef =
      kind === "membership" ? db.collection("members").doc() : null;

    const plan = membershipPlanConfig[membershipPlan];

    const lineItem =
      kind === "membership"
        ? {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: plan.amount,
              product_data: { name: plan.label },
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
              product_data: { name: "MKE Black community donation" }
            }
          };

    // Build session params — add transfer_data when Rick's account is configured
    // This routes the payment to MKE Black's bank account automatically
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: kind === "membership" ? "subscription" : "payment",
      line_items: [lineItem],
      customer_email: email || undefined,
      client_reference_id: memberRef?.id,
      metadata: {
        kind,
        memberId: memberRef?.id ?? "",
        membershipPlan: kind === "membership" ? membershipPlan : "",
        pendingSubmissionId,
        pendingBusinessName,
        uid,
        donationAmountCents: kind === "donation" ? String(donationAmountCents) : "",
        name,
        email
      },
      success_url: `${baseUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/membership?checkout=cancelled`
    };

    const session =
      kind === "membership"
        ? await createSolidarityCheckoutSession({
            stripe,
            destinationAccountId: mkeBlackAccountId,
            platformFeeRate: getPlatformFeeRate(),
            sessionParams
          })
        : await stripe.checkout.sessions.create({
            ...sessionParams,
            payment_intent_data: mkeBlackAccountId
              ? {
                  on_behalf_of: mkeBlackAccountId,
                  transfer_data: {
                    destination: mkeBlackAccountId
                  }
                }
              : undefined
          });

    if (memberRef) {
      await memberRef.set({
        name,
        email,
        paymentReference: session.id,
        paymentSource: "stripe",
        status: "pending",
        membershipPlan,
        uid: uid || null,
        businessId: null,
        pendingSubmissionId: pendingSubmissionId || null,
        pendingBusinessName: pendingBusinessName || null,
        notes: pendingSubmissionId
          ? `Stripe checkout started for pending business submission ${pendingSubmissionId}.`
          : "Stripe checkout started.",
        benefitIds: [],
        joinedAt: FieldValue.serverTimestamp(),
        expiresAt: null,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: "",
        stripeSubscriptionId: ""
      });

      if (pendingSubmissionId) {
        await db.collection("contactSubmissions").doc(pendingSubmissionId).set(
          {
            solidarityCheckoutStarted: true,
            solidarityMemberId: memberRef.id,
            solidarityMembershipPlan: membershipPlan,
            solidarityCheckoutSessionId: session.id,
            solidarityCheckoutStartedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Unable to create membership checkout", err);
    if (err instanceof StripeDestinationUnavailableError) {
      return NextResponse.json(
        {
          error:
            "Payments are temporarily unavailable while we connect MKE Black's payment account. Please try again shortly."
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Payment checkout is temporarily unavailable. Please try again shortly." },
      { status: 500 }
    );
  }
}
