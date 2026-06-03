# MKE Black — Stripe Setup Guide
# Generated after products were created via Stripe MCP

================================================================================
WHAT WAS CREATED IN STRIPE (TEST MODE)
================================================================================

Product 1: MKE Black Solidarity Circle Membership
  Stripe Product ID : prod_UdXJwGu9qXV3be
  Stripe Price ID   : price_1TeGFX6BZNNqOUDM3BNLjc7b
  Amount            : $10.00 / month (recurring)
  Type              : Subscription

Product 2: MKE Black Community Donation
  Stripe Product ID : prod_UdXKEj0rtQJFlW
  Stripe Price ID   : price_1TeGFp6BZNNqOUDMvyZ60B81
  Amount            : $5.00 base (one-time)
  Type              : One-time payment

NOTE: These are TEST MODE objects (livemode: false).
When you're ready to go live, create new products in Live Mode
and swap the env vars. Never mix test and live keys.


================================================================================
ENV VARIABLES — WHAT GOES WHERE
================================================================================

LOCAL (.env.local) — already filled in:
  STRIPE_SECRET_KEY             sk_test_51SJhBk...
  STRIPE_MEMBERSHIP_PRICE_ID    price_1TeGFX6BZNNqOUDM3BNLjc7b
  STRIPE_DONATION_PRICE_ID      price_1TeGFp6BZNNqOUDMvyZ60B81
  STRIPE_WEBHOOK_SECRET         ← fill in after Step 2 below

VERCEL (add all of the above in Project Settings → Environment Variables):
  Copy the exact same values.
  STRIPE_SECRET_KEY must NOT have quotes around it in Vercel.
  STRIPE_WEBHOOK_SECRET will be different for local vs Vercel (see below).


================================================================================
STEP 1 — ANSWER: YES, STRIP QUOTES FROM .ENV.LOCAL
================================================================================

The Vercel CLI wraps values in double quotes when it writes .env.local.
Our env-loader.js now handles this automatically — it strips surrounding
" or ' before using the value.

The rule for your own manual edits:
  - In .env.local: you CAN have quotes (env-loader strips them)
  - In code that reads process.env directly (like lib/stripe/server.ts):
    values come in WITHOUT quotes automatically — Node handles this
  - In Vercel dashboard: NEVER add quotes — paste the raw value only


================================================================================
STEP 2 — WEBHOOK SETUP (get STRIPE_WEBHOOK_SECRET)
================================================================================

You need TWO webhook secrets:
  A) One for LOCAL development (Stripe CLI)
  B) One for PRODUCTION (Vercel deployment)

--- A) LOCAL WEBHOOK (for testing on localhost:3000) ---

1. Install the Stripe CLI if you haven't:
   brew install stripe/stripe-cli/stripe

2. Login to Stripe CLI:
   stripe login

3. In a NEW terminal tab, run:
   stripe listen --forward-to localhost:3000/api/webhooks/stripe

   You'll see output like:
   > Ready! Your webhook signing secret is whsec_abc123...
   Copy that whsec_ value.

4. Add it to .env.local:
   STRIPE_WEBHOOK_SECRET=whsec_abc123...

5. Leave that terminal tab running while you test.
   Every Stripe event will be forwarded to your local server.

--- B) PRODUCTION WEBHOOK (for Vercel) ---

1. Go to https://dashboard.stripe.com/test/webhooks
   (Use /test/ path since we're in test mode)

2. Click "Add endpoint"

3. Endpoint URL:
   https://YOUR-VERCEL-URL.vercel.app/api/webhooks/stripe

4. Select events to listen to:
   ✅ checkout.session.completed
   ✅ customer.subscription.created
   ✅ customer.subscription.updated
   ✅ customer.subscription.deleted
   ✅ invoice.payment_succeeded
   ✅ invoice.payment_failed
   ✅ payment_intent.succeeded

5. Click "Add endpoint"

6. On the endpoint detail page, click "Reveal" under Signing secret
   Copy the whsec_ value

7. Add to Vercel environment variables:
   STRIPE_WEBHOOK_SECRET = whsec_[the value from step 6]

NOTE: The local whsec_ (from stripe listen) and the production whsec_
(from the dashboard) are DIFFERENT. Use the right one in each place.


================================================================================
STEP 3 — WHAT THE WEBHOOK HANDLER DOES
================================================================================

Our webhook route is at: app/api/webhooks/stripe/route.ts

It handles:
  checkout.session.completed
    → If mode is "subscription": creates/updates a member doc in Firestore
      with status: "active", links to businessId if owner, fires benefit assignment
    → If mode is "payment" (donation): logs the donation to Firestore

  customer.subscription.deleted
    → Sets member status to "expired" in Firestore
    → Sets business.solidarityMember = false

  invoice.payment_failed
    → Sets member status to "payment_failed" in Firestore
    → Can trigger a notification email


================================================================================
STEP 4 — GOING LIVE CHECKLIST
================================================================================

When MKE Black is ready to accept real payments:

1. In Stripe dashboard, switch to Live Mode (toggle top left)

2. Create the same two products in Live Mode:
   - MKE Black Solidarity Circle Membership → $10/month recurring
   - MKE Black Community Donation → $5 one-time

3. Copy the new price_ IDs (they'll be different from test mode)

4. Update Vercel env vars:
   STRIPE_SECRET_KEY          = sk_live_...
   STRIPE_MEMBERSHIP_PRICE_ID = price_live_...
   STRIPE_DONATION_PRICE_ID   = price_live_...

5. Create a new live webhook endpoint in the Stripe dashboard (same steps as above)
   STRIPE_WEBHOOK_SECRET      = whsec_live_...

6. Redeploy on Vercel (or trigger a new deployment)

7. Test with a real card ($1 charge is fine) before announcing to members


================================================================================
QUICK REFERENCE — STRIPE DASHBOARD LINKS
================================================================================

Products:    https://dashboard.stripe.com/test/products
Webhooks:    https://dashboard.stripe.com/test/webhooks
API Keys:    https://dashboard.stripe.com/test/apikeys
Customers:   https://dashboard.stripe.com/test/customers
Payments:    https://dashboard.stripe.com/test/payments

Membership product: https://dashboard.stripe.com/test/products/prod_UdXJwGu9qXV3be
Donation product:   https://dashboard.stripe.com/test/products/prod_UdXKEj0rtQJFlW
