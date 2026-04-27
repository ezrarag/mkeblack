#!/usr/bin/env node
/**
 * Extract text from all .docx files using mammoth
 * Run: node scripts/extract-docs.js
 */
const fs = require("fs");
const path = require("path");

const docsDir = path.join(__dirname, "../docs/App Development Conversations - from MKE - Rick");
const outFile = path.join(__dirname, "../docs/extracted.txt");

async function main() {
  let mammoth;
  try {
    mammoth = require("mammoth");
  } catch {
    console.error("mammoth not found. Run: npm install --save-dev mammoth");
    process.exit(1);
  }

  const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".docx"));
  let output = "";

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    output += `\n${"=".repeat(60)}\n${file}\n${"=".repeat(60)}\n`;
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      output += result.value.trim();
    } catch (err) {
      output += `[Error: ${err.message}]`;
    }
    output += "\n";
  }

  fs.writeFileSync(outFile, output, "utf-8");
  console.log(`✅ Extracted ${files.length} files → docs/extracted.txt`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
