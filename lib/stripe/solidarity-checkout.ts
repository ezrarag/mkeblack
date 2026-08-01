import type Stripe from "stripe";

export class StripeDestinationUnavailableError extends Error {
  constructor() {
    super("MKE Black's Stripe account is not ready to receive payments.");
    this.name = "StripeDestinationUnavailableError";
  }
}

type CheckoutSessionCreator = {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options?: Stripe.RequestOptions
      ): Promise<Stripe.Checkout.Session>;
    };
  };
};

export async function createSolidarityCheckoutSession({
  stripe,
  destinationAccountId,
  platformFeeRate,
  sessionParams
}: {
  stripe: CheckoutSessionCreator;
  destinationAccountId: string | null | undefined;
  platformFeeRate: number;
  sessionParams: Stripe.Checkout.SessionCreateParams;
}) {
  if (!destinationAccountId) {
    throw new StripeDestinationUnavailableError();
  }

  return stripe.checkout.sessions.create({
    ...sessionParams,
    mode: "subscription",
    subscription_data: {
      ...sessionParams.subscription_data,
      metadata: {
        ...sessionParams.subscription_data?.metadata,
        ...sessionParams.metadata
      },
      application_fee_percent: platformFeeRate * 100
    }
  }, {
    stripeAccount: destinationAccountId
  });
}

export async function createDonationCheckoutSession({
  stripe,
  destinationAccountId,
  platformFeeRate,
  donationAmountCents,
  sessionParams
}: {
  stripe: CheckoutSessionCreator;
  destinationAccountId: string | null | undefined;
  platformFeeRate: number;
  donationAmountCents: number;
  sessionParams: Stripe.Checkout.SessionCreateParams;
}) {
  if (!destinationAccountId) {
    throw new StripeDestinationUnavailableError();
  }

  return stripe.checkout.sessions.create({
    ...sessionParams,
    mode: "payment",
    payment_intent_data: {
      ...sessionParams.payment_intent_data,
      metadata: {
        ...sessionParams.payment_intent_data?.metadata,
        ...sessionParams.metadata
      },
      application_fee_amount: Math.round(donationAmountCents * platformFeeRate)
    }
  }, {
    stripeAccount: destinationAccountId
  });
}
