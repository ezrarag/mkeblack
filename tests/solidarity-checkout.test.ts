import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  createSolidarityCheckoutSession,
  StripeDestinationUnavailableError
} from "../lib/stripe/solidarity-checkout";
import { isStripeDestinationAccountReady } from "../lib/stripe/server";

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
