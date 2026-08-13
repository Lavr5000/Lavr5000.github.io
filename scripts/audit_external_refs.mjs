import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "index.html",
  "services/index.html",
  "assets/site2.css",
  "assets/index2.app.js",
  "assets/hero-demo.js",
  "about.html",
  "products.html",
  "oferta.html",
  "privacy.html",
  "assets/site.css",
  "assets/fonts.css",
  "assets/vedomost.css",
  "assets/about.css",
  "assets/legal.css",
  "assets/index.app.js",
  "assets/about.app.js",
  "assets/catalog.js",
  "products.app.js",
  "vedomost.html",
  "vedomost.js",
  "assets/textlayer-check.js"
];

const assetLinkRels = new Set([
  "stylesheet",
  "modulepreload",
  "preload",
  "icon",
  "apple-touch-icon"
]);

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
  if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) return;
  if (/^data:/i.test(value)) {
    findings.push(`${file}: ${kind}: inline data URL`);
    return;
  }
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

function attrsOf(tag) {
  const attrs = new Map();
  const attrRe = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(attrRe)) {
    attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function isRuntimeLink(attrs) {
  const rel = (attrs.get("rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
  return rel.some(item => assetLinkRels.has(item));
}

function reportSrcset(file, kind, srcset, index) {
  for (const part of srcset.split(",")) {
    report(file, kind, part.trim().split(/\s+/)[0], index);
  }
}

function scanRuntimeTags(file, src) {
  const tagRe = /<\s*(script|link|img|source|iframe)\b[^>]*>/gi;
  for (const match of src.matchAll(tagRe)) {
    const tagName = match[1].toLowerCase();
    const attrs = attrsOf(match[0]);
    if (tagName === "script" && attrs.has("src")) report(file, "<script src>", attrs.get("src"), match.index);
    if (tagName === "iframe" && attrs.has("src")) report(file, "<iframe src>", attrs.get("src"), match.index);
    if ((tagName === "img" || tagName === "source") && attrs.has("src")) {
      report(file, `<${tagName} src>`, attrs.get("src"), match.index);
    }
    if ((tagName === "img" || tagName === "source") && attrs.has("srcset")) {
      reportSrcset(file, `<${tagName} srcset>`, attrs.get("srcset"), match.index);
    }
    if (tagName === "link" && attrs.has("href") && isRuntimeLink(attrs)) {
      report(file, "<link runtime href>", attrs.get("href"), match.index);
    }
  }
}

function scan(file, src) {
  scanRuntimeTags(file, src);

  for (const match of src.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    report(file, "css url()", match[2], match.index);
  }

  for (const match of src.matchAll(/@import\s+(?:url\(\s*)?(['"]?)([^'"\s;)]+)\1/gi)) {
    report(file, "css @import", match[2], match.index);
  }

  for (const match of src.matchAll(/new\s+URL\(\s*(['"`])([\s\S]*?)\1/g)) {
    report(file, "new URL", match[2], match.index);
  }

  for (const match of src.matchAll(/(^|[^\w:])((?:\/\/)[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?::\d+)?[^\s"'`<>){}]*)/g)) {
    const prefix = match[1] || "";
    const start = match.index + prefix.length;
    const before = src.slice(Math.max(0, start - 12), start).toLowerCase();
    if (!before.endsWith("http:") && !before.endsWith("https:")) {
      report(file, "protocol-relative URL", match[2], start);
    }
  }
}

function readSiteFile(file) {
  try {
    return readFileSync(join(root, file), "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

for (const file of files) {
  const src = readSiteFile(file);
  if (src !== null) {
    scan(file, src);
  }
}

if (findings.length) {
  console.error(`External reference audit FAILED (${findings.length}):`);
  findings.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}

console.log(`External reference audit OK: self + ${apiOrigin}`);
