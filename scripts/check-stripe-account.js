#!/usr/bin/env node
/**
 * MKE Black — Stripe Connected Account Diagnostic Utility
 * 
 * This script retrieves the status of the MKE Black connected Stripe account
 * and generates a secure onboarding link if the setup is incomplete.
 * 
 * Usage:
 *   node scripts/check-stripe-account.js [stripe_secret_key] [connected_account_id]
 */

const fs = require("fs");
const path = require("path");

// Try to load env variables from .env.local if present
let stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let mkeBlackAccountId = process.env.STRIPE_MKE_BLACK_ACCOUNT_ID;

try {
  const envPath = path.join(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === "STRIPE_SECRET_KEY") stripeSecretKey = val;
      if (key === "STRIPE_MKE_BLACK_ACCOUNT_ID") mkeBlackAccountId = val;
    }
  }
} catch (err) {
  // Ignore env loading errors
}

// Override with command-line arguments if provided
if (process.argv[2]) stripeSecretKey = process.argv[2];
if (process.argv[3]) mkeBlackAccountId = process.argv[3];

if (!stripeSecretKey) {
  console.error("❌ Error: STRIPE_SECRET_KEY is missing.");
  console.error("   Please set it in .env.local, or pass it as the first argument:");
  console.error("   node scripts/check-stripe-account.js <stripe_secret_key> [connected_account_id]");
  process.exit(1);
}

if (!mkeBlackAccountId) {
  console.error("❌ Error: STRIPE_MKE_BLACK_ACCOUNT_ID is missing.");
  console.error("   Please set it in .env.local, or pass it as the second argument:");
  console.error("   node scripts/check-stripe-account.js <stripe_secret_key> <connected_account_id>");
  process.exit(1);
}

const stripe = require("stripe")(stripeSecretKey);

async function run() {
  console.log("==============================================================");
  console.log("🔍 Checking Stripe Connected Account Status");
  console.log(`   Account ID: ${mkeBlackAccountId}`);
  console.log("==============================================================");

  try {
    const account = await stripe.accounts.retrieve(mkeBlackAccountId);

    console.log(`\n📋 General Information:`);
    console.log(`   • Business Name : ${account.business_profile?.name || "Not set"}`);
    console.log(`   • Business URL  : ${account.business_profile?.url || "Not set"}`);
    console.log(`   • Support Email : ${account.business_profile?.support_email || "Not set"}`);
    console.log(`   • Country       : ${account.country}`);
    console.log(`   • Default Currency: ${account.default_currency}`);

    console.log(`\n⚙️ Onboarding & Capabilities Status:`);
    console.log(`   • Details Submitted : ${account.details_submitted ? "✅ YES" : "❌ NO"}`);
    console.log(`   • Charges Enabled   : ${account.charges_enabled ? "✅ YES" : "❌ NO (Cards will decline!)"}`);
    console.log(`   • Payouts Enabled   : ${account.payouts_enabled ? "✅ YES" : "❌ NO"}`);

    if (account.capabilities) {
      console.log(`   • Capabilities:`);
      for (const [cap, status] of Object.entries(account.capabilities)) {
        console.log(`     - ${cap}: ${status === "active" ? "✅ active" : `❌ ${status}`}`);
      }
    }

    if (account.requirements) {
      const disabledReason = account.requirements.disabled_reason;
      console.log(`\n⚠️ Requirements & Restrictions:`);
      console.log(`   • Disabled Reason : ${disabledReason || "None"}`);
      
      const currentlyDue = account.requirements.currently_due || [];
      if (currentlyDue.length > 0) {
        console.log(`   • Currently Due Items:`);
        currentlyDue.forEach(item => console.log(`     - ${item}`));
      } else {
        console.log(`   • Currently Due Items: None`);
      }

      const eventuallyDue = account.requirements.eventually_due || [];
      if (eventuallyDue.length > 0) {
        console.log(`   • Eventually Due Items:`);
        eventuallyDue.forEach(item => console.log(`     - ${item}`));
      }
    }

    if (!account.charges_enabled || !account.details_submitted) {
      console.log("\n--------------------------------------------------------------");
      console.log("🚀 Generating Stripe Onboarding Link for Rick...");
      console.log("--------------------------------------------------------------");
      
      const accountLink = await stripe.accountLinks.create({
        account: mkeBlackAccountId,
        refresh_url: "https://dashboard.stripe.com",
        return_url: "https://dashboard.stripe.com",
        type: "account_onboarding",
      });

      console.log(`\n🎉 Success! Send the link below to Rick to complete setup:\n`);
      console.log(`👉 ${accountLink.url}\n`);
      console.log("⚠️ Note: This link is secure and will expire in 24 hours.");
    } else {
      console.log("\n✅ Account is fully onboarded and ready to receive membership payments!");
    }

  } catch (err) {
    console.error("\n❌ Error retrieving Stripe account details:");
    console.error(err.message);
    process.exit(1);
  }
}

run();
