#!/usr/bin/env node
/**
 * Extract text from all .docx files using mammoth (no pandoc needed)
 * Run: node scripts/extract-docs-mammoth.js
 */
const fs = require("fs");
const path = require("path");

const docsDir = path.join(__dirname, "../docs/App Development Conversations - from MKE - Rick");
const outFile = path.join(__dirname, "../docs/extracted.txt");

let mammoth;
try {
  mammoth = require("mammoth");
} catch {
  console.error("❌ mammoth not installed. Run: npm install --save-dev mammoth");
  process.exit(1);
}

const files = fs.readdirSync(docsDir)
  .filter(f => f.endsWith(".docx"))
  .sort();

async function run() {
  let output = "";
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    output += `\n${"=".repeat(70)}\n${file}\n${"=".repeat(70)}\n`;
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      output += result.value.trim();
    } catch (err) {
      output += `[Error: ${err.message}]`;
    }
    output += "\n\n";
  }
  fs.writeFileSync(outFile, output, "utf-8");
  console.log(`✅ Done — ${files.length} files → docs/extracted.txt`);
}

run().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
