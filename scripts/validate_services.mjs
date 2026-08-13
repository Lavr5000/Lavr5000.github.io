// validate_services.mjs — local gate for services.js and the order buttons that reference it.
// Mirrors validate_products.mjs in style; separate registry, separate contract.
// It checks two things at once, because they are one invariant:
//   1. the registry itself (unique kebab-case ids, non-empty title/price/unit, no duplicate titles);
//   2. every order button in the pages: data-service-id is a known id and data-order is that
//      record's title.ru byte-for-byte. A button may carry neither attribute only if it carries
//      both — a button with one of the two is an error.
// Usage: node scripts/validate_services.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "services.js"), "utf-8");

const sandbox = { window: {} };
vm.createContext(sandbox);
new vm.Script(src).runInContext(sandbox);
const services = sandbox.window.AI_SERVICES;

// Self-discipline cap until the Т-Касса receipt-name limit is confirmed (audit A5 GAP-3).
const NAME_CAP = 64;
const PAGES = ["index.html", join("services", "index.html")];
const errors = [];

if (!Array.isArray(services)) {
  console.error("FATAL: window.AI_SERVICES is not an array");
  process.exit(1);
}

const byId = new Map();
const titles = new Set();
services.forEach((s, i) => {
  const tag = `record[${i}] (${s && s.id ? s.id : "?"})`;
  if (!s || typeof s !== "object") { errors.push(`${tag}: not an object`); return; }
  if (!s.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) errors.push(`${tag}: id missing or not kebab-case`);
  if (byId.has(s.id)) errors.push(`${tag}: duplicate id`);
  byId.set(s.id, s);
  if (!s.title || !s.title.ru) errors.push(`${tag}: title.ru missing`);
  else {
    if (titles.has(s.title.ru)) errors.push(`${tag}: duplicate title.ru "${s.title.ru}"`);
    titles.add(s.title.ru);
    if (s.title.ru.length > NAME_CAP) {
      errors.push(`${tag}: title.ru is ${s.title.ru.length} chars, over the ${NAME_CAP}-char receipt cap`);
    }
  }
  if (!s.price || !s.price.ru) errors.push(`${tag}: price.ru missing`);
  else if (!/^\d+$/.test(s.price.ru)) errors.push(`${tag}: price.ru must be a numeric string without currency`);
  if (!s.unit || !s.unit.ru) errors.push(`${tag}: unit.ru missing`);
});

let buttons = 0;
for (const page of PAGES) {
  const html = readFileSync(join(root, page), "utf-8");
  const tags = html.match(/<button\b[^>]*>/g) || [];
  tags.forEach(tag => {
    const sid = (tag.match(/\bdata-service-id="([^"]*)"/) || [])[1];
    const order = (tag.match(/\bdata-order="([^"]*)"/) || [])[1];
    if (sid === undefined && order === undefined) return;
    buttons += 1;
    const where = `${page}: ${tag.slice(0, 90)}`;
    if (sid === undefined) { errors.push(`${where}: data-order without data-service-id`); return; }
    if (order === undefined) { errors.push(`${where}: data-service-id without data-order`); return; }
    const rec = byId.get(sid);
    if (!rec) { errors.push(`${where}: data-service-id "${sid}" is not in services.js`); return; }
    if (rec.title && order !== rec.title.ru) {
      errors.push(`${where}: data-order "${order}" != title.ru "${rec.title.ru}"`);
    }
  });
}

if (errors.length) {
  console.error(`services.js validation FAILED (${errors.length}):`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
const lens = services.map(s => `${s.id}=${s.title.ru.length}`).join(", ");
console.log(`services.js OK: ${services.length} records, ${buttons} order buttons matched, ` +
  `title lengths (cap ${NAME_CAP}): ${lens}`);
