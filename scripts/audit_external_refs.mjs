import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["vedomost.html", "vedomost.js", "assets/textlayer-check.js"];

function readApiOrigin() {
  const config = readFileSync(join(root, "vedomost.config.js"), "utf-8");
  const match = config.match(/export\s+const\s+API_ORIGIN\s*=\s*(['"])([^'"]+)\1\s*;/);
  if (!match) throw new Error("API_ORIGIN export not found");
  return new URL(match[2]).origin;
}

const apiOrigin = readApiOrigin();
const allowed = new Set([apiOrigin]);
const findings = [];

function report(file, kind, value, index) {
  let url;
  try {
    url = value.startsWith("//") ? new URL(`https:${value}`) : new URL(value);
  } catch {
    return;
  }
  if (!allowed.has(url.origin)) {
    findings.push(`${file}: ${kind}: ${value} (origin ${url.origin})`);
  }
}

function scan(file, src) {
  const patterns = [
    ["absolute URL", /\bhttps?:\/\/[^\s"'`<>)]+/g],
    ["protocol-relative URL", /(^|[^\w:])\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`<>){}]*/g],
    ["src/href/action", /\b(?:src|href|action)\s*=\s*(['"])(.*?)\1/gi],
    ["srcset", /\bsrcset\s*=\s*(['"])(.*?)\1/gi],
    ["css url()", /url\(\s*(['"]?)(.*?)\1\s*\)/gi],
    ["new URL", /new\s+URL\(\s*(['"`])([\s\S]*?)\1/g],
    ["template literal", /`([^`]*https?:\/\/[^`]*)`/g]
  ];

  for (const [kind, re] of patterns) {
    for (const match of src.matchAll(re)) {
      if (kind === "protocol-relative URL") {
        report(file, kind, match[0].replace(/^[^/]+/, ""), match.index);
      } else if (kind === "srcset") {
        for (const part of match[2].split(",")) report(file, kind, part.trim().split(/\s+/)[0], match.index);
      } else if (kind === "src/href/action" || kind === "css url()" || kind === "new URL" || kind === "template literal") {
        report(file, kind, match[2] || match[1], match.index);
      } else {
        report(file, kind, match[0], match.index);
      }
    }
  }
}

for (const file of files) {
  scan(file, readFileSync(join(root, file), "utf-8"));
}

if (findings.length) {
  console.error(`External reference audit FAILED (${findings.length}):`);
  findings.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}

console.log(`External reference audit OK: self + ${apiOrigin}`);
