#!/usr/bin/env node
/**
 * Patches login-form.tsx text labels per Rick's feedback
 * Run: node scripts/patch-login-labels.js
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../components/auth/login-form.tsx"
);

let content = fs.readFileSync(filePath, "utf-8");
let changed = false;

// Fix eyebrow label: "Business access" → cleaner label
if (content.includes('"Business access"')) {
  content = content.replace('"Business access"', '"MKE Black Portal"');
  console.log("✅ Fixed eyebrow: Business access → MKE Black Portal");
  changed = true;
}

// Fix h1/h2 heading on left panel
if (content.includes("Update your MKE Black listing in real time.")) {
  content = content.replace(
    "Update your MKE Black listing in real time.",
    "Admin Login. Business Login. Customer Login."
  );
  // Keep the left panel description accurate
  content = content.replace(
    "Business owners land in a private dashboard for their listing only.\n            Admins are routed to the management workspace after sign-in.",
    "Admins are routed to the management workspace. Business owners land in a private dashboard for their listing. Customers can browse favorites and member discounts."
  );
  console.log("✅ Fixed login page left panel heading");
  changed = true;
}

// Fix right panel heading: "Business login" → "Sign In"
// (the type of login is determined by who you are, not which form you use)
if (content.includes('"Business login"') || content.includes(">Business login<")) {
  content = content
    .replace('"Business login"', '"Sign In"')
    .replace(/>Business login</g, ">Sign In<");
  console.log("✅ Fixed right panel heading: Business login → Sign In");
  changed = true;
}

// Fix right panel subtext
const oldSubtext = "Use your email and password, or sign in with Google. Contact the\n            directory team if you need admin access or a linked business profile.";
const newSubtext = "Use your email and password or sign in with Google. You will be routed automatically — admins go to the workspace, business owners go to their dashboard, customers go to their favorites.";
if (content.includes(oldSubtext)) {
  content = content.replace(oldSubtext, newSubtext);
  console.log("✅ Fixed right panel subtext");
  changed = true;
}

if (!changed) {
  console.log("⚠️  No matching text found — check login-form.tsx manually");
  console.log("   The labels may have already been updated by Codex.");
} else {
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("\n✅ login-form.tsx updated");
}
