#!/usr/bin/env node
/**
 * Adds Articles link to admin nav in site-header.tsx
 * Run: node scripts/patch-header-articles.js
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../components/layout/site-header.tsx"
);

let content = fs.readFileSync(filePath, "utf-8");

const target = `        { href: "/admin/homepage", label: "Homepage editor" },`;
const replacement = `        { href: "/admin/homepage", label: "Homepage editor" },
        { href: "/admin/articles", label: "Articles" },`;

if (content.includes('{ href: "/admin/articles"')) {
  console.log("✅ Articles link already present in header — no change needed.");
  process.exit(0);
}

if (!content.includes(target)) {
  console.error("❌ Could not find the target line to patch. Check the file manually.");
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, "utf-8");
console.log("✅ Added Articles link to admin nav in site-header.tsx");
