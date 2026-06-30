# Deployment Migration: Wix Domain to Vercel

This document covers the production cutover for the MKE Black Next.js app from a Vercel staging URL to a live custom domain managed in Wix DNS.

It is intentionally limited to deployment and domain migration. It does not cover blog/article migration.

## Scope

- App platform: Next.js 14 on Vercel
- DNS manager: Wix
- Data/services already in use: Firebase Auth, Firestore, Firebase Storage, Google Maps, Mapbox, Stripe
- Repo root: `mkeblack`

## Recommended Domain Shape

Use one canonical production hostname and redirect the other:

- Preferred canonical: `www.mkeblack.org`
- Redirect secondary: `mkeblack.org`

This is the simplest setup when Wix is only used as the DNS host and Vercel serves the app.

If the team prefers apex-only (`mkeblack.org`) as canonical, Vercel can support that too. The DNS records below include both variants either way.

## Before You Touch DNS

Complete these checks first in Vercel and Firebase.

### 1. Confirm the Vercel project is production-ready

In Vercel:

1. Open the project.
2. Confirm the latest production deployment builds cleanly.
3. Confirm the project already works on its Vercel URL.

### 2. Add production environment variables in Vercel

This repo expects at least the following variables in production:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SITE_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
YELP_API_KEY=
YEL_API_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

Notes:

- Set `NEXT_PUBLIC_SITE_URL` to the final canonical URL, for example `https://www.mkeblack.org`.
- Paste secret values into Vercel without wrapping quotes unless the provider explicitly requires them.
- The repo README already notes that the Firebase client variables must exist in Vercel.

### 3. Add the new production domain to Firebase Auth

This app uses Firebase Auth. After the domain changes, sign-in can fail unless the domain is whitelisted.

In Firebase Console:

1. Open Authentication.
2. Open Settings.
3. Open Authorized domains.
4. Add:
   - `mkeblack.org`
   - `www.mkeblack.org`

### 4. Review Stripe URLs if Stripe is live

If production payments are enabled:

1. Confirm webhook endpoints point to the production Vercel domain if they are domain-specific.
2. Confirm any checkout success/cancel URLs resolve from `NEXT_PUBLIC_SITE_URL`.

### 5. Lower DNS TTL ahead of cutover

If Wix allows TTL edits on the existing records, lower them several hours before launch, for example to `300` seconds. This reduces rollback time if anything goes wrong.

## Add the Domain in Vercel First

Do this before editing Wix DNS.

In Vercel:

1. Open the project.
2. Go to `Settings` -> `Domains`.
3. Add both:
   - `mkeblack.org`
   - `www.mkeblack.org`
4. Set the preferred production domain to the canonical hostname you want users to see.
5. Leave the non-canonical hostname configured so Vercel can redirect it.

Vercel will then show the DNS records it expects.

## Wix DNS Records

Use the record values Vercel shows for the project if they differ. As of the current Vercel documentation, the standard record pattern is:

- Apex/root domain (`mkeblack.org`): `A` record to `76.76.21.21`
- `www` subdomain: `CNAME` to `cname.vercel-dns-0.com`

### Target Setup

For a typical production setup:

| Hostname | Record Type | Value | Purpose |
| --- | --- | --- | --- |
| `@` | `A` | `76.76.21.21` | Root domain to Vercel |
| `www` | `CNAME` | `cname.vercel-dns-0.com` | `www` to Vercel |

Notes:

- In Wix DNS, `@` usually means the root/apex domain.
- Remove conflicting old Wix site records for the same hostnames before saving.
- Do not leave an old Wix `A`, `CNAME`, or forwarding rule active for the same host if you want Vercel to serve production traffic.

## Step-by-Step: Change DNS in Wix

In Wix:

1. Open the domain management area for `mkeblack.org`.
2. Open DNS / DNS Records.
3. Find any existing records for:
   - `@`
   - `www`
4. Record the current values somewhere safe in case rollback is needed.
5. Delete or replace conflicting records for those hosts.
6. Create or update the apex record:
   - Host: `@`
   - Type: `A`
   - Points to: `76.76.21.21`
7. Create or update the `www` record:
   - Host: `www`
   - Type: `CNAME`
   - Points to: `cname.vercel-dns-0.com`
8. Save changes.

If Vercel shows different values in the project domain UI, use Vercel’s displayed values instead of this document.

## Wait for Verification and Propagation

After saving DNS:

1. Return to Vercel `Settings` -> `Domains`.
2. Wait for both domains to verify.
3. Confirm one is marked primary and the other redirects.

Propagation may complete in minutes, but allow up to 24-48 hours globally.

## Post-Cutover Checks

Run these checks once Vercel shows the domains as active.

### 1. Browser checks

Test all of the following:

1. `https://mkeblack.org`
2. `https://www.mkeblack.org`
3. Confirm one redirects to the canonical domain.
4. Confirm the homepage loads without mixed-content or certificate errors.

### 2. App checks

Verify these critical paths:

1. Public directory page loads.
2. Business detail pages load.
3. Map loads.
4. Firebase-authenticated login works.
5. Admin pages load for admin users.
6. Image assets load, including Firebase Storage and `static.wixstatic.com` images allowed in `next.config.mjs`.
7. Any Stripe checkout flow resolves back to the live domain correctly.

### 3. Firebase Auth checks

If login fails with an unauthorized-domain style error:

1. Re-open Firebase Authorized Domains.
2. Confirm both `mkeblack.org` and `www.mkeblack.org` are present.
3. Retry after a few minutes.

### 4. Environment check

Confirm `NEXT_PUBLIC_SITE_URL` is set to the canonical live URL and redeploy if it was previously pointing at localhost or the staging domain.

## Recommended Redirect Policy

Use one permanent redirect only:

- If canonical is `www.mkeblack.org`, redirect `mkeblack.org` -> `https://www.mkeblack.org`
- If canonical is `mkeblack.org`, redirect `www.mkeblack.org` -> `https://mkeblack.org`

Do not split production traffic across both hosts.

## Rollback Plan

If production has a serious issue after cutover:

1. Revert the Wix DNS records to the previously documented values.
2. Wait for propagation.
3. Keep the Vercel domain settings in place so you can retry later.
4. Fix the blocking issue in Vercel.
5. Re-run the cutover steps.

## Repo-Specific Notes

- `README.md` already documents a basic Vercel deployment flow.
- `NEXT_PUBLIC_SITE_URL` exists in `.env.example` and should be updated for production.
- `lib/firebase-errors.ts` already anticipates Firebase unauthorized-domain failures, which is a strong signal that authorized-domain setup matters for launch.
- `next.config.mjs` allows images from Firebase Storage, Google user content, Wix static assets, and Yelp CDN; no extra domain image config should be needed just for the production hostname.

## Launch Checklist

- Vercel project deploys cleanly
- Production env vars added in Vercel
- `NEXT_PUBLIC_SITE_URL` set to live canonical URL
- Firebase Auth authorized domains updated
- Domain added in Vercel
- Wix DNS switched to Vercel records
- Canonical redirect confirmed
- Public pages tested
- Login/admin tested
- Payments/maps checked if applicable

## Reference Values Used Here

These values should be confirmed against the live Vercel project UI at the moment of cutover:

- Apex `A`: `76.76.21.21`
- `www` `CNAME`: `cname.vercel-dns-0.com`

If Vercel shows different values in its domain screen, Vercel’s project UI is the source of truth.
