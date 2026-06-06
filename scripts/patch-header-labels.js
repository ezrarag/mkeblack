#!/usr/bin/env node
/**
 * Patches site-header.tsx guest account dropdown labels per Rick's feedback:
 * - "Admin Login" first (admins know who they are)
 * - "Business Login" second
 * - "Customer Login" instead of "Join as visitor"
 *
 * Run: node scripts/patch-header-labels.js
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../components/layout/site-header.tsx"
);

let content = fs.readFileSync(filePath, "utf-8");

// ── Fix 1: reorder and relabel the guest Account dropdown ─────────────────
const oldDropdown = `                  <div className="flex flex-col gap-1.5">
                    <DropdownLink
                      href="/join"
                      label="Join as visitor"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/login"
                      label="Business owner login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/login?next=/admin"
                      label="Admin login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                  </div>`;

const newDropdown = `                  <div className="flex flex-col gap-1.5">
                    <DropdownLink
                      href="/login?next=/admin"
                      label="Admin Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/login"
                      label="Business Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/join"
                      label="Customer Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                  </div>`;

if (content.includes(oldDropdown)) {
  content = content.replace(oldDropdown, newDropdown);
  console.log("✅ Fixed guest Account dropdown labels");
} else {
  // Try a looser match for just the labels
  content = content
    .replace(/"Join as visitor"/, '"Customer Login"')
    .replace(/"Business owner login"/, '"Business Login"')
    .replace(/"Admin login"/, '"Admin Login"');
  console.log("✅ Applied label fixes (loose match)");
}

fs.writeFileSync(filePath, content, "utf-8");
console.log("✅ site-header.tsx updated\n");
console.log("Labels are now:");
console.log("  Account dropdown → Admin Login | Business Login | Customer Login");
console.log("  Login page heading → Business Login (unchanged)");
