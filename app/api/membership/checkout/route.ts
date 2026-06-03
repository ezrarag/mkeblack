import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { getBaseUrl, getStripe } from "@/lib/stripe/server";

type CheckoutKind = "membership" | "donation";

function getPriceId(kind: CheckoutKind) {
  return kind === "membership"
    ? process.env.STRIPE_MEMBERSHIP_PRICE_ID
    : process.env.STRIPE_DONATION_PRICE_ID;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: { kind?: CheckoutKind; name?: string; email?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind = body.kind === "donation" ? "donation" : "membership";
  const name = getString(body.name);
  const email = getString(body.email).toLowerCase();
  const priceId = getPriceId(kind);

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured." },
      { status: 500 }
    );
  }

  if (kind === "membership" && (!name || !email)) {
    return NextResponse.json(
      { error: "Name and email are required." },
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

    const session = await stripe.checkout.sessions.create({
      mode: kind === "membership" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: memberRef?.id,
      metadata: {
        kind,
        memberId: memberRef?.id ?? "",
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
