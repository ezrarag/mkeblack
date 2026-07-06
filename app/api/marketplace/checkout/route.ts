import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  getBaseUrl,
  getPlatformFeeRate,
  getStripe
} from "@/lib/stripe/server";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: {
    listingId?: string;
    customerUid?: string | null;
    customerEmail?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const listingId = getString(body.listingId);
  const customerUid = getString(body.customerUid);
  const customerEmail = getString(body.customerEmail).toLowerCase();

  if (!listingId) {
    return NextResponse.json(
      { error: "listingId is required." },
      { status: 400 }
    );
  }

  try {
    const db = getFirebaseAdminDb();
    const listingRef = db.collection("marketplace_listings").doc(listingId);
    const orderRef = db.collection("marketplace_orders").doc();
    const listingSnapshot = await listingRef.get();

    if (!listingSnapshot.exists) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const listing = listingSnapshot.data() ?? {};
    const available = listing.available !== false;
    const checkoutMode = listing.checkoutMode === "native" ? "native" : "external";
    const amountCents =
      typeof listing.priceCents === "number" && Number.isFinite(listing.priceCents)
        ? Math.max(0, Math.round(listing.priceCents))
        : 0;

    if (!available) {
      return NextResponse.json(
        { error: "This listing is not currently available." },
        { status: 400 }
      );
    }

    if (checkoutMode !== "native") {
      return NextResponse.json(
        { error: "This listing uses external fulfillment." },
        { status: 400 }
      );
    }

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "Only paid listings can use native checkout." },
        { status: 400 }
      );
    }

    const businessId = getString(listing.businessId);
    const businessName = getString(listing.businessName);
    const listingName = getString(listing.name) || "Marketplace listing";
    const feeRate = getPlatformFeeRate();
    const platformFeeCents = Math.round(amountCents * feeRate);
    const netToBusinessCents = Math.max(0, amountCents - platformFeeCents);

    await orderRef.set({
      id: orderRef.id,
      listingId,
      listingName,
      businessId,
      businessName,
      customerUid: customerUid || null,
      customerEmail,
      amountCents,
      platformFeeCents,
      netToBusinessCents,
      stripeCheckoutSessionId: "",
      stripeCustomerId: "",
      stripePaymentStatus: "",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      paidAt: null
    });

    const stripe = getStripe();
    const baseUrl = getBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: listingName,
              description: businessName || undefined
            }
          }
        }
      ],
      customer_email: customerEmail || undefined,
      client_reference_id: orderRef.id,
      metadata: {
        kind: "marketplace_order",
        orderId: orderRef.id,
        listingId,
        businessId,
        businessName,
        listingName,
        saleAmountCents: String(amountCents),
        platformFeeCents: String(platformFeeCents),
        netToBusinessCents: String(netToBusinessCents)
      },
      success_url: `${baseUrl}/marketplace?checkout=success`,
      cancel_url: `${baseUrl}/marketplace?checkout=cancelled`
    });

    await orderRef.update({
      stripeCheckoutSessionId: session.id
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
