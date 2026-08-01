import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  createDonationCheckoutSession,
  createSolidarityCheckoutSession,
  StripeDestinationUnavailableError
} from "../lib/stripe/solidarity-checkout";
import {
  getBaseUrl,
  isStripeDestinationAccountReady
} from "../lib/stripe/server";
import {
  invoiceSubscriptionId,
  memberStatusForSubscription,
  subscriptionMemberId,
  subscriptionPeriodEnd
} from "../lib/stripe/membership-lifecycle";

const destinationAccountId = "acct_mke_black_test";

function baseSessionParams(): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 1000,
          product_data: { name: "Monthly Solidarity Circle membership" },
          recurring: { interval: "month" }
        }
      }
    ],
    success_url: "https://example.test/membership/success",
    cancel_url: "https://example.test/membership",
    metadata: { kind: "membership", memberId: "member_test" }
  };
}

test("Solidarity checkout creates a direct subscription on MKE Black with the configured split", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const options: Stripe.RequestOptions[] = [];
  const stripe = {
    checkout: {
      sessions: {
        async create(
          params: Stripe.Checkout.SessionCreateParams,
          requestOptions?: Stripe.RequestOptions
        ) {
          calls.push(params);
          options.push(requestOptions ?? {});
          return {
            id: "cs_test_solidarity",
            object: "checkout.session",
            url: "https://checkout.stripe.test/session"
          } as Stripe.Checkout.Session;
        }
      }
    }
  };

  await createSolidarityCheckoutSession({
    stripe,
    destinationAccountId,
    platformFeeRate: 0.05,
    sessionParams: baseSessionParams()
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "subscription");
  assert.equal(calls[0].subscription_data?.on_behalf_of, undefined);
  assert.equal(calls[0].subscription_data?.transfer_data, undefined);
  assert.equal(calls[0].subscription_data?.application_fee_percent, 5);
  assert.deepEqual(calls[0].subscription_data?.metadata, {
    kind: "membership",
    memberId: "member_test"
  });
  assert.equal(options[0].stripeAccount, destinationAccountId);
});

test("membership lifecycle maps Stripe states and identifiers", () => {
  assert.equal(memberStatusForSubscription("active"), "active");
  assert.equal(memberStatusForSubscription("trialing"), "active");
  assert.equal(memberStatusForSubscription("past_due"), "pending");
  assert.equal(memberStatusForSubscription("canceled"), "expired");

  const subscription = {
    id: "sub_test",
    metadata: { memberId: "member_test" },
    items: {
      data: [{ current_period_end: 100 }, { current_period_end: 200 }]
    }
  } as unknown as Stripe.Subscription;
  assert.equal(subscriptionMemberId(subscription), "member_test");
  assert.equal(subscriptionPeriodEnd(subscription), 200);

  const invoice = {
    parent: { subscription_details: { subscription: "sub_test" } }
  } as unknown as Stripe.Invoice;
  assert.equal(invoiceSubscriptionId(invoice), "sub_test");
});

test("Solidarity checkout fails closed without creating a Stripe session", async () => {
  let createCalls = 0;
  const stripe = {
    checkout: {
      sessions: {
        async create() {
          createCalls += 1;
          throw new Error("sessions.create must not be called");
        }
      }
    }
  };

  await assert.rejects(
    createSolidarityCheckoutSession({
      stripe,
      destinationAccountId: undefined,
      platformFeeRate: 0.05,
      sessionParams: baseSessionParams()
    }),
    StripeDestinationUnavailableError
  );
  assert.equal(createCalls, 0);
});

test("donation checkout creates a direct payment on MKE Black with the configured platform fee", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const options: Stripe.RequestOptions[] = [];
  const stripe = {
    checkout: {
      sessions: {
        async create(
          params: Stripe.Checkout.SessionCreateParams,
          requestOptions?: Stripe.RequestOptions
        ) {
          calls.push(params);
          options.push(requestOptions ?? {});
          return {
            id: "cs_test_donation",
            object: "checkout.session",
            url: "https://checkout.stripe.test/donation"
          } as Stripe.Checkout.Session;
        }
      }
    }
  };

  await createDonationCheckoutSession({
    stripe,
    destinationAccountId,
    platformFeeRate: 0.025,
    donationAmountCents: 2500,
    sessionParams: {
      ...baseSessionParams(),
      mode: "payment"
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "payment");
  assert.equal(calls[0].payment_intent_data?.on_behalf_of, undefined);
  assert.equal(calls[0].payment_intent_data?.application_fee_amount, 63);
  assert.deepEqual(calls[0].payment_intent_data?.metadata, {
    kind: "membership",
    memberId: "member_test"
  });
  assert.equal(calls[0].payment_intent_data?.transfer_data, undefined);
  assert.equal(options[0].stripeAccount, destinationAccountId);
});

test("donation checkout fails closed without creating a Stripe session", async () => {
  let createCalls = 0;
  const stripe = {
    checkout: {
      sessions: {
        async create() {
          createCalls += 1;
          throw new Error("sessions.create must not be called");
        }
      }
    }
  };

  await assert.rejects(
    createDonationCheckoutSession({
      stripe,
      destinationAccountId: undefined,
      platformFeeRate: 0.025,
      donationAmountCents: 2500,
      sessionParams: {
        ...baseSessionParams(),
        mode: "payment"
      }
    }),
    StripeDestinationUnavailableError
  );
  assert.equal(createCalls, 0);
});

test("destination readiness requires details, transfers, and card payments", () => {
  assert.equal(
    isStripeDestinationAccountReady({
      details_submitted: true,
      capabilities: { transfers: "active", card_payments: "active" }
    }),
    true
  );

  for (const account of [
    {
      details_submitted: false,
      capabilities: { transfers: "active", card_payments: "active" }
    },
    {
      details_submitted: true,
      capabilities: { transfers: "inactive", card_payments: "active" }
    },
    {
      details_submitted: true,
      capabilities: { transfers: "active", card_payments: "inactive" }
    }
  ] as Array<Pick<Stripe.Account, "details_submitted" | "capabilities">>) {
    assert.equal(isStripeDestinationAccountReady(account), false);
  }
});

test("production checkout redirects use the public MKE Black domain", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;

  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_ENV = "production";

  try {
    assert.equal(
      getBaseUrl("https://www.mkeblack.org"),
      "https://www.mkeblack.org"
    );
    assert.equal(
      getBaseUrl(
        "https://mkeblack-n4c8sy7c6-ezras-projects-a5d28798.vercel.app"
      ),
      "https://www.mkeblack.org"
    );
  } finally {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  }
});
