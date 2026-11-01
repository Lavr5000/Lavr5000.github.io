// Gate for assets/uslugi-return.js and uslugi/return/index.html: the bank return page auto-opens
// the bot only for a strict o=pay_<hex8>, everything else gets just the button. Runs the real script
// in a fake DOM (no browser, no network).
//   node tests/uslugi_return_check.mjs
// Last line: USLUGI-RETURN status=ok|fail cases=N
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "assets", "uslugi-return.js"), "utf-8");
const html = readFileSync(join(root, "uslugi", "return", "index.html"), "utf-8");
const IDS = ["return-plain", "return-auto", "open-bot-wrap", "open-bot", "open-order-wrap", "open-order"];
const PREFIX = "https://max.ru/id644404692540_3_bot?start=";
let failures = 0, cases = 0;

function run(search, { catalog = { bot_link_prefix: PREFIX } } = {}) {
  const els = Object.fromEntries(IDS.map(id => [id, { hidden: true, textContent: "", href: "", addEventListener() {} }]));
  els["return-plain"].hidden = false; // the page opens with the plain block, as in the markup
  const replaced = [];
  const timers = [];
  const win = {
    location: { search, pathname: "/uslugi/return/", replace: url => replaced.push(url) },
  };
  const sandbox = {
    window: win, URLSearchParams, console,
    document: { getElementById: id => els[id] || null },
    setTimeout: fn => { timers.push(fn); return timers.length; },
  };
  sandbox.window.USLUGI_CATALOG = catalog;
  vm.createContext(sandbox); // no fetch, no XMLHttpRequest: any request would throw
  vm.runInContext(src, sandbox);
  return { els, replaced, timers };
}

const flush = () => new Promise(r => setImmediate(r));
async function settle(h, rounds = 3) {
  for (let i = 0; i < rounds; i++) { await flush(); while (h.timers.length) h.timers.shift()(); await flush(); }
}
function check(name, ok, detail = "") {
  cases++;
  if (!ok) { failures++; console.log(`FAIL ${name} ${detail}`); }
}
const visible = h => Object.entries(h.els).filter(([id, e]) => id.startsWith("return-") && !e.hidden).map(([id]) => id);

// 1. valid o: the auto block, the button to the order, the redirect only after the pause
{
  const h = run("?o=pay_60ad582a");
  check("valid: auto block shown", visible(h).join() === "return-auto", visible(h).join());
  check("valid: order button to prefix+o", h.els["open-order"].href === `${PREFIX}pay_60ad582a` && !h.els["open-order-wrap"].hidden, h.els["open-order"].href);
  check("valid: no instant redirect", h.replaced.length === 0 && h.timers.length === 1, `replaced=${h.replaced.length} timers=${h.timers.length}`);
  await settle(h);
  check("valid: redirects to the bot order", h.replaced.length === 1 && h.replaced[0] === `${PREFIX}pay_60ad582a`, h.replaced.join());
}

// 2. spoofs: everything but a strict single o gets only the button, never a redirect
const SPOOFS = [
  ["uppercase hex", "?o=pay_60AD582A"],
  ["7 hex chars", "?o=pay_60ad582"],
  ["9 hex chars", "?o=pay_60ad582ab"],
  ["non-hex char", "?o=pay_60ad582g"],
  ["url in o", "?o=https://evil.example/x"],
  ["javascript: in o", "?o=javascript:alert(1)"],
  ["duplicated: valid first, hostile second", "?o=pay_60ad582a&o=javascript:alert(1)"],
  ["duplicated: two valid", "?o=pay_60ad582a&o=pay_deadbeef"],
  ["empty o", "?o="],
  ["usl- order id, not pay_", "?o=usl-60ad582a"],
];
for (const [name, search] of SPOOFS) {
  const h = run(search);
  await settle(h);
  check(`spoof ${name}: plain block only`, visible(h).join() === "return-plain", visible(h).join());
  check(`spoof ${name}: no redirect ever`, h.replaced.length === 0, h.replaced.join());
  check(`spoof ${name}: no order link`, h.els["open-order"].href === "" && h.els["open-order-wrap"].hidden);
}
// 3. no o at all
{
  const h = run("");
  await settle(h);
  check("no o: plain block, bare bot button", visible(h).join() === "return-plain" && h.els["open-bot"].href === "https://max.ru/id644404692540_3_bot" && !h.els["open-bot-wrap"].hidden, h.els["open-bot"].href);
  check("no o: bare button has no start=", !h.els["open-bot"].href.includes("start="), h.els["open-bot"].href);
  check("no o: no redirect", h.replaced.length === 0);
}
// 4. a broken catalog never redirects and never sets a link
for (const [name, catalog] of [
  ["no catalog", null],
  ["prefix not a string", { bot_link_prefix: 42 }],
  ["prefix on a foreign host", { bot_link_prefix: "https://evil.example/b?start=" }],
  ["prefix without the start tail", { bot_link_prefix: "https://max.ru/id644404692540_3_bot" }],
]) {
  const h = run("?o=pay_60ad582a", { catalog });
  await settle(h);
  check(`catalog ${name}: no redirect`, h.replaced.length === 0 && h.timers.length === 0, h.replaced.join());
  check(`catalog ${name}: no link set`, h.els["open-bot"].href === "" && h.els["open-order"].href === "");
}
// 5. the page markup itself: noindex, no counters, no external requests, honest wording
{
  check("html: noindex", /<meta name="robots" content="noindex"/.test(html));
  check("html: no-referrer", /<meta name="referrer" content="no-referrer"/.test(html));
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  check("html: CSP is self-only", csp === "default-src 'self'", csp);
  check("html: no canonical (stays out of the sitemap)", !/<link rel="canonical"/.test(html));
  const lower = html.toLowerCase();
  check("html: no Metrika or counters", !/mc\.yandex|metrika|\bym\(|googletag|analytics/.test(lower), "");
  check("html: no word of a completed payment", !/оплачено|оплата получена|оплата прошла|деньги списаны/.test(lower), "");
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith("#"));
  check("html: every url is the site's own", urls.length > 0 && urls.every(u => u.startsWith("/")), urls.join(" "));
  check("html: the catalog script comes before the page script", html.indexOf("uslugi.catalog.js") < html.indexOf("uslugi-return.js"));
}
// 6. the page never claims the payment went through: the exact wording from the brief is on the page
{
  check("texts: the bank wording is on the page", html.includes("Банк принял платёж, бот подтвердит оплату в течение минуты."));
  check("texts: the auto block says the bot takes over", html.includes("возвращаем вас в бот"));
  check("texts: the button label", html.includes(">Открыть бота</a>"));
}

console.log(`USLUGI-RETURN status=${failures ? "fail" : "ok"} cases=${cases}`);
process.exit(failures ? 1 : 0);
