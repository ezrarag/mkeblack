#!/usr/bin/env node
/**
 * Read-only Stripe health check for MKE Black.
 *
 * Scope: this is a MONITORING script, not a diagnosis/repair tool — the
 * connected-account setup is already considered resolved. Its only job is
 * to confirm current health and give you a fast pass/fail signal so a
 * future regression (capability revoked, webhook silently failing, etc.)
 * gets caught early.
 *
 * Guarantees:
 *   - Every Stripe SDK call below is a read (`retrieve` / `list`). Nothing
 *     in this file creates, updates, or deletes anything in Stripe.
 *   - No secrets are printed. Only account/webhook metadata is logged.
 *   - Exits 0 on pass, 1 on fail, so it's safe to wire into CI/cron and
 *     alert on a non-zero exit code.
 *
 * Config (read from env — same variable names lib/stripe/server.ts uses):
 *   STRIPE_SECRET_KEY            required
 *   STRIPE_MKE_BLACK_ACCOUNT_ID  required to check the connected account
 *                                 (falls back to platform-account-only
 *                                 checks with a warning if unset)
 *
 * Usage:
 *   node scripts/stripe-health-check.js
 *   node scripts/stripe-health-check.js --json     # machine-readable output
 */

const Stripe = require("stripe");
const { loadEnv } = require("./env-loader");

const STRIPE_API_VERSION = "2026-05-27.dahlia"; // matches lib/stripe/server.ts

function getStripeClient(env) {
  const secretKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set (checked .env.local and process.env).");
  }

  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

/**
 * Confirms the connected account's core capability flags. These three
 * booleans are what actually gate whether MKE Black can accept charges and
 * receive payouts — everything else in the Dashboard is downstream of them.
 */
async function checkConnectedAccount(stripe, accountId) {
  if (!accountId) {
    return {
      ok: false,
      skipped: true,
      reason: "STRIPE_MKE_BLACK_ACCOUNT_ID not set — skipping connected-account check."
    };
  }

  const account = await stripe.accounts.retrieve(accountId);

  const result = {
    ok:
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.details_submitted === true,
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    capabilities: account.capabilities ?? {},
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    requirementsPastDue: account.requirements?.past_due ?? [],
    disabledReason: account.requirements?.disabled_reason ?? null,
    fullPayload: account
  };

  return result;
}

/**
 * Lists platform-level webhook endpoints and their configured event types.
 * Note: Stripe's API does not expose a per-endpoint "delivery success rate"
 * metric directly. As a read-only proxy, we sample recent Events and check
 * their `pending_webhooks` count (how many subscribed endpoints still owe a
 * delivery attempt for that event) — 0 across the board is a good sign,
 * a sustained non-zero count suggests deliveries are failing/backing up.
 * For exact per-endpoint delivery logs, see the dashboard checklist item
 * in docs/stripe-verification-checklist.md.
 */
async function checkWebhookEndpoints(stripe) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

  const recentEvents = await stripe.events.list({ limit: 50 });
  const withPendingDeliveries = recentEvents.data.filter(
    (event) => (event.pending_webhooks ?? 0) > 0
  );

  return {
    endpointCount: endpoints.data.length,
    endpoints: endpoints.data.map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      status: endpoint.status, // "enabled" | "disabled"
      enabledEvents: endpoint.enabled_events,
      apiVersion: endpoint.api_version
    })),
    recentEventsSampled: recentEvents.data.length,
    recentEventsWithPendingDeliveries: withPendingDeliveries.length,
    approximateDeliveryHealthNote:
      "Stripe's API doesn't expose exact per-endpoint delivery success rate; " +
      "this counts recent events still owing a delivery attempt as a rough proxy. " +
      "Confirm exact numbers in Dashboard → Developers → Webhooks → [endpoint] → Recent deliveries.",
    fullPayload: { endpoints: endpoints.data, sampledEvents: recentEvents.data }
  };
}

async function main() {
  const wantsJson = process.argv.includes("--json");
  const env = loadEnv();
  const accountId =
    env.STRIPE_MKE_BLACK_ACCOUNT_ID || process.env.STRIPE_MKE_BLACK_ACCOUNT_ID;

  const report = {
    ranAt: new Date().toISOString(),
    checks: {},
    pass: true,
    errors: []
  };

  let stripe;
  try {
    stripe = getStripeClient(env);
  } catch (error) {
    report.pass = false;
    report.errors.push(error.message);
    printReport(report, wantsJson);
    process.exit(1);
    return;
  }

  try {
    report.checks.connectedAccount = await checkConnectedAccount(stripe, accountId);
    if (report.checks.connectedAccount.skipped) {
      report.errors.push(report.checks.connectedAccount.reason);
    } else if (!report.checks.connectedAccount.ok) {
      report.pass = false;
    }
  } catch (error) {
    report.pass = false;
    report.errors.push(`Connected account check failed: ${error.message}`);
    report.checks.connectedAccount = { ok: false, error: error.message };
  }

  try {
    report.checks.webhooks = await checkWebhookEndpoints(stripe);
    if (report.checks.webhooks.endpointCount === 0) {
      report.pass = false;
      report.errors.push("No webhook endpoints are configured on this Stripe account.");
    }
    const anyDisabled = report.checks.webhooks.endpoints.some(
      (endpoint) => endpoint.status !== "enabled"
    );
    if (anyDisabled) {
      report.pass = false;
      report.errors.push("One or more webhook endpoints are not in 'enabled' status.");
    }
  } catch (error) {
    report.pass = false;
    report.errors.push(`Webhook check failed: ${error.message}`);
    report.checks.webhooks = { ok: false, error: error.message };
  }

  printReport(report, wantsJson);
  process.exit(report.pass ? 0 : 1);
}

function printReport(report, wantsJson) {
  if (wantsJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("═══════════════════════════════════════════");
  console.log(" MKE Black — Stripe Health Check (read-only)");
  console.log("═══════════════════════════════════════════");
  console.log(`Ran at: ${report.ranAt}\n`);

  const acct = report.checks.connectedAccount;
  if (acct?.skipped) {
    console.log(`⚠️  Connected account: SKIPPED — ${acct.reason}`);
  } else if (acct) {
    console.log(`${acct.ok ? "✅" : "❌"} Connected account (${acct.accountId ?? "unknown"})`);
    console.log(`   charges_enabled:    ${acct.chargesEnabled}`);
    console.log(`   payouts_enabled:    ${acct.payoutsEnabled}`);
    console.log(`   details_submitted:  ${acct.detailsSubmitted}`);
    if (acct.requirementsPastDue?.length) {
      console.log(`   ⚠️  past_due requirements: ${acct.requirementsPastDue.join(", ")}`);
    }
    if (acct.requirementsCurrentlyDue?.length) {
      console.log(`   currently_due requirements: ${acct.requirementsCurrentlyDue.join(", ")}`);
    }
    if (acct.disabledReason) {
      console.log(`   ⚠️  disabled_reason: ${acct.disabledReason}`);
    }
  }

  console.log("");

  const hooks = report.checks.webhooks;
  if (hooks) {
    console.log(`${hooks.endpointCount > 0 ? "✅" : "❌"} Webhook endpoints: ${hooks.endpointCount}`);
    for (const endpoint of hooks.endpoints ?? []) {
      console.log(`   • ${endpoint.url}`);
      console.log(
        `     status: ${endpoint.status} | api_version: ${endpoint.apiVersion} | events: ${endpoint.enabledEvents.join(", ")}`
      );
    }
    if (hooks.recentEventsSampled) {
      console.log(
        `   Recent events sampled: ${hooks.recentEventsSampled}, with pending deliveries: ${hooks.recentEventsWithPendingDeliveries}`
      );
      console.log(`   Note: ${hooks.approximateDeliveryHealthNote}`);
    }
  }

  console.log("");

  if (report.errors.length) {
    console.log("Warnings / errors:");
    for (const err of report.errors) {
      console.log(`   - ${err}`);
    }
    console.log("");
  }

  console.log(report.pass ? "PASS ✅" : "FAIL ❌");
}

main().catch((error) => {
  console.error("Stripe health check crashed:", error);
  process.exit(1);
});
