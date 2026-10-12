// validate_services.mjs — local gate for services.js and the order buttons that reference it.
// Mirrors validate_products.mjs in style; separate registry, separate contract.
// It checks three things at once, because they are one invariant:
//   1. the registry itself (unique kebab-case ids, non-empty title/price/unit, no duplicate titles,
//      priceLabel shape and its agreement with price + pricingModel, `archived` only as exactly true);
//   2. every order button in the pages (index.html, services/index.html, products.html): payment links
//      <a data-pay> and request links <a data-request> (<button> is scanned too, so a CTA added in the
//      old shape is still covered). data-service-id is a known NON-archived id, data-order is that
//      record's title.ru byte-for-byte, data-price-label is that record's priceLabel.ru byte-for-byte.
//      A data-pay link also carries data-amount = price*100 and a non-empty href (it works without
//      scripts). A partial set of attributes is an error;
//   3. the visible price of the card carrying that button (.tariff-price inside article[data-tariff],
//      .card-price inside article.card, text before <small>) equals the same label — the price is
//      duplicated in HTML by design, so the duplicate is proven. Archived records have no buttons and
//      their titles do not appear on the pages.
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
const PAGES = ["index.html", join("services", "index.html"), "products.html"];
// "15 000 ₽" / "от 10 000 ₽" — U+0020 only, thousands separated, no kopeks.
const LABEL_RE = /^(от )?\d{1,3}( \d{3})* ₽$/;
const errors = [];

// Decode the entities and thin/no-break spaces an editor may introduce, so we can tell a value that
// *renders* the same from one that *is* the same. Only the latter passes.
const normalizeSpace = s => s
  .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
  .replace(/[   ]/g, " ");

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
  if ("archived" in s && s.archived !== true) errors.push(`${tag}: archived, when present, must be exactly true`);
});

// Cards and tariffs are <article> elements; the price is read from the card the button sits in:
//   article[data-tariff]  -> .tariff-price   (tariffs on / and /services/)
//   article.card          -> .card-price     (service cards on /products.html)
// A button outside any such article (hero buttons, final CTA) has no visible price of its own and is
// skipped for that comparison only. Text is taken up to <small>, which carries the unit, not the price.
const articlesOf = html => {
  const out = [];
  const re = /<article\b([^>]*)>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, attrs: m[1], body: m[2] });
  }
  return out;
};
const priceIn = (art, cls) => {
  const m = art.body.match(new RegExp(`<[a-z]+\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</[a-z]+>`));
  return m ? m[1].split("<small")[0].trim() : null;
};

let buttons = 0;
const kinds = { pay: 0, request: 0 };
for (const page of PAGES) {
  const html = readFileSync(join(root, page), "utf-8");
  const arts = articlesOf(html);
  const re = /<(a|button)\b[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const attr = n => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
    const isPay = /\sdata-pay(\s|>|=)/.test(tag);
    const isRequest = /\sdata-request(\s|>|=)/.test(tag);
    const sid = attr("data-service-id");
    const order = attr("data-order");
    const label = attr("data-price-label");
    if (!isPay && !isRequest && sid === undefined && order === undefined && label === undefined) continue;
    buttons += 1;
    const where = `${page}: ${tag.slice(0, 90)}`;
    if (isPay && isRequest) { errors.push(`${where}: both data-pay and data-request`); continue; }
    if (m[1] === "a" && !isPay && !isRequest) {
      errors.push(`${where}: order link without data-pay or data-request`);
      continue;
    }
    if (isPay) kinds.pay += 1; else if (isRequest) kinds.request += 1;
    if (sid === undefined) { errors.push(`${where}: order button without data-service-id`); continue; }
    if (order === undefined) { errors.push(`${where}: order button without data-order`); continue; }
    if (label === undefined) { errors.push(`${where}: order button without data-price-label`); continue; }
    const rec = byId.get(sid);
    if (!rec) { errors.push(`${where}: data-service-id "${sid}" is not in services.js`); continue; }
    if (rec.archived === true) {
      errors.push(`${where}: data-service-id "${sid}" is archived and must have no buttons`);
      continue;
    }
    if (rec.title && order !== rec.title.ru) {
      errors.push(`${where}: data-order "${order}" != title.ru "${rec.title.ru}"`);
    }
    if (rec.priceLabel && label !== rec.priceLabel.ru) {
      errors.push(`${where}: data-price-label "${label}" != priceLabel.ru "${rec.priceLabel.ru}"`);
    }
    if (isPay) {
      const amount = attr("data-amount");
      if (rec.pricingModel !== "fixed") errors.push(`${where}: data-pay on a "${rec.pricingModel}" price`);
      if (amount === undefined) errors.push(`${where}: data-pay without data-amount`);
      else if (rec.price && amount !== String(Number(rec.price.ru) * 100)) {
        errors.push(`${where}: data-amount "${amount}" != price*100 "${Number(rec.price.ru) * 100}"`);
      }
      const href = attr("href");
      if (!href || !href.trim()) {
        errors.push(`${where}: data-pay link without a non-empty href (it must work without scripts)`);
      }
    }
    // The visible price of the card / tariff carrying this button.
    const art = arts.find(x => m.index > x.start && m.index < x.end);
    if (!art) continue;
    const tariffId = (art.attrs.match(/\sdata-tariff="([^"]*)"/) || [])[1];
    const isCard = /\sclass="[^"]*\bcard\b/.test(art.attrs);
    let cls = "";
    if (tariffId !== undefined) {
      cls = "tariff-price";
      if (tariffId !== sid) errors.push(`${where}: sits in tariff "${tariffId}" but references "${sid}"`);
    } else if (isCard) {
      cls = "card-price";
    }
    if (!cls) continue;
    const shown = priceIn(art, cls);
    if (shown === null) errors.push(`${where}: no .${cls} in the card of this button`);
    else if (rec.priceLabel && shown !== rec.priceLabel.ru) {
      if (normalizeSpace(shown) === rec.priceLabel.ru) {
        errors.push(`${where}: card price "${shown}" renders like the label but is not U+0020-clean`);
      } else {
        errors.push(`${where}: card price "${shown}" != priceLabel.ru "${rec.priceLabel.ru}"`);
      }
    }
  }
  // An archived service must not leak into the visible pages by its title either.
  for (const rec of services) {
    if (rec && rec.archived === true && rec.title && html.includes(rec.title.ru)) {
      errors.push(`${page}: archived service title "${rec.title.ru}" is still on the page`);
    }
  }
}

if (errors.length) {
  console.error(`services.js validation FAILED (${errors.length}):`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
const lens = services.map(s => `${s.id}=${s.title.ru.length}`).join(", ");
console.log(`services.js OK: ${services.length} records (${services.filter(s => s.archived).length} archived), ` +
  `${buttons} order buttons matched (${kinds.pay} pay, ${kinds.request} request), ` +
  `title lengths (cap ${NAME_CAP}): ${lens}`);
