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
- [ ] Confirm the account is still on **destination charges** via the
      platform account (per the comment in `lib/stripe/server.ts`) — if
      Rick's account setup changed to a different Connect charge type, the
      `getReadyStripeDestinationAccountId()` logic in that file will need a
      matching update.

## 2. Webhook endpoints
Dashboard → Developers → Webhooks

- [ ] The endpoint URL(s) point at the current production domain and route
      (`/api/webhooks/stripe`) — confirm there's no stale endpoint left
      pointing at a preview/staging URL or an old domain from before the
      Vercel migration (see `DEPLOYMENT_MIGRATION.md`)
- [ ] Endpoint status is **Enabled** (not disabled)
- [ ] Subscribed events include at minimum `checkout.session.completed`
      (the only event type `app/api/webhooks/stripe/route.ts` currently
      handles) — if you've added new event handling since, confirm those
      event types are subscribed too
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
- [ ] `STRIPE_MKE_BLACK_ACCOUNT_ID` — this is read by
      `lib/stripe/server.ts` but is **not currently listed in
      `.env.example`**. Worth adding it there (with no value) so future
      setup doesn't miss it.
- [ ] `PLATFORM_FEE_RATE` is the intended value (defaults to `0.05` if unset
      — confirm that's still correct)

---
Generated as part of a July 2026 diagnostic pass. Not a substitute for
Stripe's own account-health notifications — keep those email alerts on.
