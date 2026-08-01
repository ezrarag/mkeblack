# Stripe Verification Checklist — MKE Black

Manual checks to run in the Stripe Dashboard yourself. Nothing here requires
pasting a key or secret anywhere — these are all things to *look at*, not
configure via API. Pair this with `scripts/stripe-health-check.js` (automated,
read-only) for the parts that can be checked programmatically.

## 1. Connected account capabilities
Dashboard → Connect → Accounts → (MKE Black's connected account)

- [ ] `charges_enabled` is `true`
- [ ] `payouts_enabled` is `true`
- [ ] `details_submitted` is `true`
- [ ] No items under "Requirements" → "Past due" or "Currently due"
- [ ] Bank account / payout destination on file matches what MKE Black expects
- [ ] Confirm memberships and donations appear as **direct charges** in MKE
      Black's connected account. ReadyAimGo should see only its configured
      application fee in the platform account.

## 2. Webhook endpoints
Dashboard → Developers → Webhooks

- [ ] The endpoint URL(s) point at the current production domain and route
      (`/api/webhooks/stripe`) — confirm there's no stale endpoint left
      pointing at a preview/staging URL or an old domain from before the
      Vercel migration (see `DEPLOYMENT_MIGRATION.md`)
- [ ] Endpoint status is **Enabled** (not disabled)
- [ ] Subscribed events include `checkout.session.completed`,
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.paid`, and
      `invoice.payment_failed`
- [ ] Open the endpoint's **"Recent deliveries"** tab and check the success
      rate directly — this is the exact number; the health-check script can
      only approximate it from recent event `pending_webhooks` counts
- [ ] No repeated delivery failures / retries in the last 7 days

## 3. Signing secret
Dashboard → Developers → Webhooks → (endpoint) → "Signing secret"

- [ ] The `STRIPE_WEBHOOK_SECRET` value configured in Vercel's environment
      variables matches the current signing secret shown here
- [ ] If you ever rotate the signing secret (Dashboard has a "Roll secret"
      button), update `STRIPE_WEBHOOK_SECRET` in Vercel immediately — a
      stale secret makes every webhook fail signature verification, which
      surfaces as `400` responses from `app/api/webhooks/stripe/route.ts`
- [ ] Confirm there isn't a second, older endpoint still registered with the
      previous secret that's silently failing

## 4. API keys
Dashboard → Developers → API keys

- [ ] The live secret key in use matches what's set as `STRIPE_SECRET_KEY`
      in Vercel (Production environment) — check the key's last-used
      timestamp/fingerprint, not the value itself
- [ ] No unused/legacy restricted keys still active that should be revoked

## 5. Environment/config parity
Cross-check against `.env.example` in this repo:

- [ ] `STRIPE_SECRET_KEY` — set in Vercel Production
- [ ] `STRIPE_WEBHOOK_SECRET` — set in Vercel Production
- [ ] `STRIPE_MKE_BLACK_ACCOUNT_ID` points to MKE Black's live connected account
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` matches the connected-account endpoint
- [ ] `PLATFORM_FEE_RATE` is the intended membership fee (defaults to `0.05`)
- [ ] `DONATION_PLATFORM_FEE_RATE` is the intended donation fee (defaults to `0.025`)

---
Generated as part of a July 2026 diagnostic pass. Not a substitute for
Stripe's own account-health notifications — keep those email alerts on.
