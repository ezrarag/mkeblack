#!/usr/bin/env node
/**
 * Minimal Stripe webhook observability stub.
 *
 * Purpose: let you confirm events are actually arriving and that their
 * signatures verify — nothing more. It does NOT touch Firestore, does NOT
 * fulfill orders/memberships, and does NOT replace
 * app/api/webhooks/stripe/route.ts (the real production handler). Run this
 * standalone when you want a side channel to watch raw deliveries without
 * mixing that traffic into app logs.
 *
 * Built on Node's built-in `http` module (no Express dependency needed, so
 * it doesn't touch package.json) so it drops straight into scripts/ next to
 * the other admin scripts.
 *
 * Usage:
 *   STRIPE_WEBHOOK_SECRET=whsec_... node scripts/stripe-webhook-listener.js
 *   # or rely on .env.local having STRIPE_WEBHOOK_SECRET set already
 *
 * Point Stripe at it for local testing with the Stripe CLI:
 *   stripe listen --forward-to localhost:4242/webhook
 *
 * Every request logs: event type, event id, whether the signature verified,
 * and (only on verification failure) the raw error message. It always
 * responds 200 so Stripe doesn't retry-storm you while you're just
 * observing — signature failures are logged loudly instead of surfaced as
 * a webhook failure in the Stripe dashboard.
 */

const http = require("http");
const Stripe = require("stripe");
const { loadEnv } = require("./env-loader");

const PORT = Number(process.env.PORT || 4242);
const PATH = "/webhook";

const env = loadEnv();
const webhookSecret =
  env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
const secretKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!webhookSecret) {
  console.error("STRIPE_WEBHOOK_SECRET is not set — signature verification would always fail.");
  process.exit(1);
}

if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== PATH) {
    res.writeHead(404).end();
    return;
  }

  const signature = req.headers["stripe-signature"];
  const rawBody = await readRawBody(req);
  const timestamp = new Date().toISOString();

  if (!signature) {
    console.warn(`[${timestamp}] Request with no stripe-signature header received.`);
    res.writeHead(200).end();
    return;
  }

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(
      `[${timestamp}] ✅ signature OK | type=${event.type} | id=${event.id} | livemode=${event.livemode}`
    );
  } catch (error) {
    console.error(
      `[${timestamp}] ❌ signature verification FAILED: ${error.message}`
    );
  }

  // Always 200 — this endpoint only observes, it never wants Stripe to
  // treat a delivery as failed and retry because of what happens here.
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ received: true }));
});

server.listen(PORT, () => {
  console.log(`Stripe webhook observability stub listening on http://localhost:${PORT}${PATH}`);
  console.log("This is read-only/observability only — no Firestore writes, no order fulfillment.");
});
