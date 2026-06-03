#!/usr/bin/env node
/**
 * Patches all MKE Black seed scripts to use the shared env-loader.
 * Run: node scripts/patch-env-loader.js
 */
const fs = require("fs");
const path = require("path");

const scriptsDir = __dirname;

// Old env-loading block (all variations) → replace with shared loader
const SCRIPTS_TO_PATCH = [
  "seed-articles.js",
  "seed-firestore.js",
  "set-admin.js",
];

const OLD_PATTERNS = [
  // Pattern used in seed-articles.js and seed-firestore.js
  /const fs = require\("fs"\);\nconst path = require\("path"\);\n\n\/\/ ── Load \.env\.local[^]*?process\.exit\(1\);\n\}/,
  // Pattern used in set-admin.js
  /const fs = require\("fs"\);\nconst path = require\("path"\);\n\n\/\/ Parse \.env\.local[^]*?env\[key\] = val;\n\}/,
  // Generic fallback — match anything between the requires and the initializeApp call
  /const \{ initializeApp[^]*?const fs = require[^]*?process\.exit\(1\);\n\}(\n\nif \(!getApps[^]*?\}\n)?/,
];

const NEW_HEADER = `const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { loadEnv, getFirebaseAdminConfig } = require("./env-loader");

// ── Load credentials ──────────────────────────────────────────────────────────
const env = loadEnv();
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig(env);

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}`;

for (const scriptName of SCRIPTS_TO_PATCH) {
  const filePath = path.join(scriptsDir, scriptName);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${scriptName} — not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // Check if already patched
  if (content.includes("require(\"./env-loader\")") || content.includes("require('./env-loader')")) {
    console.log(`✅ ${scriptName} already uses env-loader — skipped`);
    continue;
  }

  console.log(`\n🔧 Patching ${scriptName}...`);
  console.log(`   File size: ${content.length} chars`);
  console.log(`   Looking for old Firebase init block...`);

  // Strategy: find the lines from the first require() to the closing
  // of the initializeApp block, replace with new header
  const lines = content.split("\n");

  // Find the shebang + comment block (keep it)
  let shebangEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#!") || lines[i].startsWith("/**") ||
        lines[i].startsWith(" *") || lines[i] === "") {
      shebangEnd = i + 1;
    } else {
      break;
    }
  }

  // Find where the requires start
  let requireStart = -1;
  for (let i = shebangEnd; i < lines.length; i++) {
    if (lines[i].startsWith("const { initializeApp") ||
        lines[i].startsWith("const fs = require") ||
        lines[i].startsWith("const path = require")) {
      requireStart = i;
      break;
    }
  }

  if (requireStart === -1) {
    console.log(`   ❌ Could not find require block — skipping`);
    continue;
  }

  // Find where the init block ends (after initializeApp call + closing brace)
  let initEnd = requireStart;
  let foundInit = false;
  for (let i = requireStart; i < lines.length; i++) {
    if (lines[i].includes("initializeApp({")) foundInit = true;
    if (foundInit && (lines[i] === "}" || lines[i] === "});")) {
      initEnd = i + 1;
      break;
    }
  }

  // Skip blank lines after block
  while (initEnd < lines.length && lines[initEnd].trim() === "") initEnd++;

  // Also find and remove getFirestore/db setup lines if present right after
  // (since the new header doesn't include db — scripts set it themselves)
  let codeStart = initEnd;

  const preamble = lines.slice(0, requireStart).join("\n");
  const rest = lines.slice(codeStart).join("\n");

  content = preamble + "\n" + NEW_HEADER + "\n\nconst db = getFirestore();\n\n" + rest;

  // Clean up double blank lines
  content = content.replace(/\n{4,}/g, "\n\n\n");

  fs.writeFileSync(filePath, content, "utf-8");

  if (content !== original) {
    console.log(`   ✅ Patched successfully`);
  } else {
    console.log(`   ⚠️  Content unchanged — check manually`);
  }
}

console.log("\n✅ Patch complete. Try running: node scripts/seed-articles.js\n");
