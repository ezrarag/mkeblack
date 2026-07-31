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
    cancel_url: "https://example.test/membership"
  };
}

test("Solidarity checkout creates a destination subscription with the configured split", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const stripe = {
    checkout: {
      sessions: {
        async create(params: Stripe.Checkout.SessionCreateParams) {
          calls.push(params);
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
  assert.equal(
    calls[0].subscription_data?.on_behalf_of,
    destinationAccountId
  );
  assert.equal(
    calls[0].subscription_data?.transfer_data?.destination,
    destinationAccountId
  );
  assert.equal(calls[0].subscription_data?.application_fee_percent, 5);
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

test("donation checkout routes to MKE Black with the configured platform fee", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const stripe = {
    checkout: {
      sessions: {
        async create(params: Stripe.Checkout.SessionCreateParams) {
          calls.push(params);
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
  assert.equal(
    calls[0].payment_intent_data?.on_behalf_of,
    destinationAccountId
  );
  assert.equal(calls[0].payment_intent_data?.application_fee_amount, 63);
  assert.equal(
    calls[0].payment_intent_data?.transfer_data?.destination,
    destinationAccountId
  );
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
  ]) {
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
