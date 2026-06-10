// validate_products.mjs — CI/local gate for products.js.
// Source of truth for the schema is normalize() in products.html:
// a record is renderable iff id, title.ru and price.ru exist; status/icon
// fall back when outside their enums. This validator is stricter: it FAILS
// on anything normalize() would silently hide or coerce, so a broken record
// breaks the build instead of vanishing from the grid.
// Usage: node scripts/validate_products.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "products.js"), "utf-8");
const snapshot = parseInt(readFileSync(join(root, ".github", "products-count.txt"), "utf-8").trim(), 10);

const sandbox = { window: {} };
vm.createContext(sandbox);
new vm.Script(src).runInContext(sandbox);
const products = sandbox.window.AI_PRODUCTS;

const STATUSES = ["available", "soon", "dev", "planned"];
const ICONS = ["list", "diff", "mail", "mic", "spark"];
const SERVICE_TYPES = ["telegram", "request_form", "external_app", "info_page"];
const errors = [];

if (!Array.isArray(products)) {
  console.error("FATAL: window.AI_PRODUCTS is not an array");
  process.exit(1);
}
if (products.length !== snapshot) {
  errors.push(`registry has ${products.length} records, snapshot expects ${snapshot}` +
    " (intentional change? update .github/products-count.txt in the same commit)");
}

const ids = new Set();
products.forEach((p, i) => {
  const tag = `record[${i}] (${p && p.id ? p.id : "?"})`;
  if (!p || typeof p !== "object") { errors.push(`${tag}: not an object`); return; }
  if (!p.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errors.push(`${tag}: id missing or not kebab-case`);
  if (ids.has(p.id)) errors.push(`${tag}: duplicate id`);
  ids.add(p.id);
  if (!p.title || !p.title.ru) errors.push(`${tag}: title.ru missing (normalize() would hide the card)`);
  if (!p.price || !p.price.ru) errors.push(`${tag}: price.ru missing (normalize() would hide the card)`);
  else if (!/^\d+$/.test(p.price.ru)) errors.push(`${tag}: price.ru must be a numeric string without currency`);
  if (!STATUSES.includes(p.status)) errors.push(`${tag}: status "${p.status}" outside enum ${STATUSES.join("|")}`);
  if (p.icon && !ICONS.includes(p.icon)) errors.push(`${tag}: icon "${p.icon}" outside enum (renders as list)`);
  if (p.serviceType && !SERVICE_TYPES.includes(p.serviceType)) errors.push(`${tag}: serviceType "${p.serviceType}" outside enum`);
  if (!p.cta || !p.cta.tgText || !p.cta.tgText.ru) errors.push(`${tag}: cta.tgText.ru missing`);
  else if (!p.cta.tgText.ru.includes("oferta.html")) errors.push(`${tag}: cta.tgText.ru lacks the offer-consent line`);
});

if (errors.length) {
  console.error(`products.js validation FAILED (${errors.length}):`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
console.log(`products.js OK: ${products.length} records (snapshot ${snapshot}), ` +
  `${products.filter(p => p.visible !== false).length} visible`);
