// validate_services.mjs — local gate for services.js and the order buttons that reference it.
// Mirrors validate_products.mjs in style; separate registry, separate contract.
// It checks three things at once, because they are one invariant:
//   1. the registry itself (unique kebab-case ids, non-empty title/price/unit, no duplicate titles,
//      priceLabel shape and its agreement with price + pricingModel);
//   2. every order button in the pages: data-service-id is a known id, data-order is that record's
//      title.ru byte-for-byte, data-price-label is that record's priceLabel.ru byte-for-byte.
//      A button may carry none of the three only if it carries all three — a partial set is an error.
//      Buttons are found by scanning ALL <button> tags, so a CTA button added later is covered too.
//   3. the visible price on the card carrying that button (.panel-tag.price, text before <small>)
//      equals the same label — the price is duplicated in HTML by design, so the duplicate is proven.
// Whitespace canon: price strings use U+0020 only. A string that needs entity-decoding or NBSP
// normalization to match is an ERROR, not a pass — otherwise "byte for byte" means nothing.
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
// "15 000 ₽" / "от 10 000 ₽" — U+0020 only, thousands separated, no kopeks.
const LABEL_RE = /^(от )?\d{1,3}( \d{3})* ₽$/;
const errors = [];

// Decode the entities and thin/no-break spaces an editor may introduce, so we can tell a value that
// *renders* the same from one that *is* the same. Only the latter passes.
const normalizeSpace = s => s
  .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
  .replace(/[   ]/g, " ");

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
  if (s.pricingModel !== "fixed" && s.pricingModel !== "from") {
    errors.push(`${tag}: pricingModel must be "fixed" or "from"`);
  }
  if (!s.priceLabel || !s.priceLabel.ru) errors.push(`${tag}: priceLabel.ru missing`);
  else {
    const label = s.priceLabel.ru;
    if (normalizeSpace(label) !== label) {
      errors.push(`${tag}: priceLabel.ru contains a non-breaking/thin space or an entity — use U+0020`);
    }
    if (!LABEL_RE.test(label)) errors.push(`${tag}: priceLabel.ru "${label}" does not match ${LABEL_RE}`);
    const digits = label.replace(/\D/g, "");
    if (s.price && s.price.ru && digits !== s.price.ru) {
      errors.push(`${tag}: priceLabel.ru digits "${digits}" != price.ru "${s.price.ru}"`);
    }
    const startsFrom = label.startsWith("от ");
    if (startsFrom !== (s.pricingModel === "from")) {
      errors.push(`${tag}: priceLabel.ru "${label}" and pricingModel "${s.pricingModel}" disagree`);
    }
  }
  if (!s.unit || !s.unit.ru) errors.push(`${tag}: unit.ru missing`);
});

// The card price node that belongs to a button: the last <p class="panel-tag price"> opened before
// the button AND inside the same card — if the card closed in between, the button is a standalone
// CTA (the final «Оставить заявку»), which has no visible price of its own and is skipped.
// Text is read up to <small>, which carries the unit, not the price.
const cardPriceBefore = (html, buttonIndex) => {
  const re = /<p class="panel-tag price">([\s\S]*?)<\/p>/g;
  let m, last = null, lastEnd = -1;
  while ((m = re.exec(html)) !== null) {
    if (m.index > buttonIndex) break;
    last = m[1];
    lastEnd = m.index + m[0].length;
  }
  if (last === null) return null;
  if (html.slice(lastEnd, buttonIndex).includes("</article>")) return null;
  return last.split("<small")[0].trim();
};

let buttons = 0;
for (const page of PAGES) {
  const html = readFileSync(join(root, page), "utf-8");
  const re = /<button\b[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const sid = (tag.match(/\bdata-service-id="([^"]*)"/) || [])[1];
    const order = (tag.match(/\bdata-order="([^"]*)"/) || [])[1];
    const label = (tag.match(/\bdata-price-label="([^"]*)"/) || [])[1];
    if (sid === undefined && order === undefined && label === undefined) continue;
    buttons += 1;
    const where = `${page}: ${tag.slice(0, 90)}`;
    if (sid === undefined) { errors.push(`${where}: order button without data-service-id`); continue; }
    if (order === undefined) { errors.push(`${where}: order button without data-order`); continue; }
    if (label === undefined) { errors.push(`${where}: order button without data-price-label`); continue; }
    const rec = byId.get(sid);
    if (!rec) { errors.push(`${where}: data-service-id "${sid}" is not in services.js`); continue; }
    if (rec.title && order !== rec.title.ru) {
      errors.push(`${where}: data-order "${order}" != title.ru "${rec.title.ru}"`);
    }
    if (rec.priceLabel && label !== rec.priceLabel.ru) {
      errors.push(`${where}: data-price-label "${label}" != priceLabel.ru "${rec.priceLabel.ru}"`);
    }
    // The visible card price, when this button sits inside a service card.
    const shown = cardPriceBefore(html, m.index);
    if (shown !== null && rec.priceLabel && shown !== rec.priceLabel.ru) {
      if (normalizeSpace(shown) === rec.priceLabel.ru) {
        errors.push(`${where}: card price "${shown}" renders like the label but is not U+0020-clean`);
      } else if (/\d/.test(shown)) {
        errors.push(`${where}: card price "${shown}" != priceLabel.ru "${rec.priceLabel.ru}"`);
      }
    }
  }
}

if (errors.length) {
  console.error(`services.js validation FAILED (${errors.length}):`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
const lens = services.map(s => `${s.id}=${s.title.ru.length}`).join(", ");
console.log(`services.js OK: ${services.length} records, ${buttons} order buttons matched, ` +
  `title lengths (cap ${NAME_CAP}): ${lens}`);
