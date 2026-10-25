// Gate for assets/spasibo.js, the realtor branch: runs the real script in a fake DOM (no browser, no network).
//   node tests/spasibo_rieltor_check.mjs
// Last line: SPASIBO-RIELTOR status=ok|fail cases=N
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "assets", "spasibo.js"), "utf-8");
const IDS = ["spasibo-plain", "spasibo-ok", "spasibo-fail", "spasibo-rieltor", "order-number", "retry-pay", "rl-number",
  "rl-title", "rl-lead", "rl-link-wrap", "rl-link", "rl-code-wrap", "rl-fallback", "rl-code", "rl-note"];
const KEY = "ABCDEFGHJKLMNPQRSTUV"; // 20 characters of the allowed alphabet
const NUM = "AV-0123ABCD";
let failures = 0, cases = 0;

function run(search, { responses = [], storage = {} } = {}) {
  const els = Object.fromEntries(IDS.map(id => [id, { hidden: true, textContent: "", href: "", addEventListener() {} }]));
  els["spasibo-plain"].hidden = false; // the page opens with the plain text, as in the markup
  const fetched = [];
  const timers = [];
  const replaced = [];
  const store = { ...storage };
  const win = {
    location: { search, pathname: "/spasibo/" },
    history: { replaceState: (_a, _b, url) => replaced.push(url) },
  };
  const sandbox = {
    window: win, URLSearchParams, encodeURIComponent, console,
    document: { getElementById: id => els[id] || null },
    sessionStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: url => { fetched.push(url); const next = responses.shift(); return Promise.resolve({ ok: next !== undefined, json: () => Promise.resolve(next) }); },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    history: win.history,
  };
  sandbox.window.sessionStorage = sandbox.sessionStorage;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { els, fetched, timers, replaced, store };
}

const flush = () => new Promise(r => setImmediate(r));
async function settle(h, rounds = 6) {
  for (let i = 0; i < rounds; i++) { await flush(); while (h.timers.length) h.timers.shift()(); await flush(); }
}
function check(name, ok, detail = "") {
  cases++;
  if (!ok) { failures++; console.log(`FAIL ${name} ${detail}`); }
}
const visible = h => Object.entries(h.els).filter(([id, e]) => id.startsWith("spasibo-") && !e.hidden).map(([id]) => id);

// 1. ready: link and code shown, r removed from the address bar, kept for a reload
{
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "ready", link: "https://max.ru/id644404692540_3_bot?start=TOKEN2345", code: "ABCD-EFGH-JKLM", bot_name: "Помощник: подключение" }] });
  await settle(h);
  check("ready: fetch url", h.fetched.length === 1 && h.fetched[0] === `https://api.ai-vibes.ru/api/rieltor/handoff?n=${NUM}&r=${KEY}`, h.fetched.join());
  check("ready: only the realtor block is shown", visible(h).join() === "spasibo-rieltor", visible(h).join());
  check("ready: link", h.els["rl-link"].href === "https://max.ru/id644404692540_3_bot?start=TOKEN2345" && !h.els["rl-link-wrap"].hidden);
  check("ready: code", h.els["rl-code"].textContent === "ABCD-EFGH-JKLM" && !h.els["rl-code-wrap"].hidden);
  check("ready: r hidden from the address bar", h.replaced.length === 1 && !h.replaced[0].includes("r=") && h.replaced[0].includes(NUM), h.replaced.join());
  check("ready: r kept for a reload", h.store[`av-rl:${NUM}`] === KEY);
}
// 2. pending first (the bank is still confirming), then ready
{
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "pending" }, { status: "ready", link: "https://max.ru/x_bot?start=AAA", code: "ABCD EFGH JKLM", bot_name: "Бот" }] });
  await settle(h);
  check("pending: asked again", h.fetched.length === 2, String(h.fetched.length));
  check("pending: ends in ready", h.els["rl-code"].textContent === "ABCD EFGH JKLM" && visible(h).join() === "spasibo-rieltor");
}
// 3. a link to a foreign host or a code with markup is never shown
{
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "ready", link: "https://evil.example/x", code: "ABCD-EFGH-JKLM" }, { status: "ready", link: "https://max.ru/b?start=A", code: "<img src=x onerror=alert(1)>" }] });
  await settle(h);
  check("hostile: no link set", h.els["rl-link"].href === "" && h.els["rl-link-wrap"].hidden);
  check("hostile: no code shown", h.els["rl-code"].textContent === "" && h.els["rl-code-wrap"].hidden);
  check("hostile: plain page stays", visible(h).join() === "spasibo-ok");
}
// 4. no r: no request at all (the other products, or an address typed by hand)
{
  const h = run(`?n=${NUM}`);
  await settle(h);
  check("no r: no request", h.fetched.length === 0);
  check("no r: order block as before", visible(h).join() === "spasibo-ok" && h.els["order-number"].textContent === NUM);
}
// 5. r with a wrong shape is ignored; markup in n is never shown
{
  const h = run(`?n=${NUM}&r=short`);
  await settle(h);
  check("bad r: no request", h.fetched.length === 0);
  const g = run(`?n=<b>AV-1</b>&r=${KEY}`);
  await settle(g);
  check("bad n: nothing shown, no request", g.fetched.length === 0 && visible(g).join() === "spasibo-plain" && g.els["order-number"].textContent === "");
}
// 6. states
for (const [status, word] of [["bound", "уже подключён"], ["check_mail", "отправлены на указанную вами почту"], ["expired", "истёк"], ["refunded", "возвращена"]]) {
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status }] });
  await settle(h);
  const text = h.els["rl-title"].textContent + " " + h.els["rl-lead"].textContent;
  check(`state ${status}`, visible(h).join() === "spasibo-rieltor" && text.includes(word) && h.els["rl-code"].textContent === "", text);
}
// 7. API unreachable: the page keeps its text
{
  const h = run(`?n=${NUM}&r=${KEY}`);
  await settle(h);
  check("offline: plain order block stays", visible(h).join() === "spasibo-ok");
}
// 8. reload: r comes from the session
{
  const h = run(`?n=${NUM}`, { storage: { [`av-rl:${NUM}`]: KEY }, responses: [{ status: "bound" }] });
  await settle(h);
  check("reload: uses the stored r", h.fetched.length === 1 && h.fetched[0].endsWith(`&r=${KEY}`));
}
// 9. the failure page and the plain page are unchanged
{
  const f = run("?fail=1");
  check("fail page", visible(f).join() === "spasibo-fail");
  const p = run("");
  check("plain page", visible(p).join() === "spasibo-plain");
}

// 10. a one-off service order (usl-…): its own handoff endpoint, lowercase hex key, r hidden and kept
{
  const UKEY = "0123456789abcdef0123"; // 20 lowercase hex, as the site checkout issues
  const UNUM = "usl-1a2b3c4d";
  const h = run(`?n=${UNUM}&r=${UKEY}`, { responses: [{ status: "paid", link: "https://max.ru/id644404692540_3_bot?start=usl_TOKEN1234567890ABCDEF" }] });
  await settle(h);
  check("uslugi: fetch url", h.fetched.length === 1 && h.fetched[0] === `https://api.ai-vibes.ru/api/uslugi-site/handoff?n=${UNUM}&r=${UKEY}`, h.fetched.join());
  check("uslugi: paid shows the bot button", !h.els["rl-link-wrap"].hidden && h.els["rl-link"].href.endsWith("usl_TOKEN1234567890ABCDEF"), h.els["rl-link"].href);
  check("uslugi: one-time note", h.els["rl-note"].textContent.includes("одноразовая"), h.els["rl-note"].textContent);
  check("uslugi: order number shown", h.els["rl-number"].textContent === UNUM && h.els["order-number"].textContent === UNUM);
  check("uslugi: r hidden from the address bar and kept", h.replaced.length === 1 && !h.replaced[0].includes("r=") && h.store[`av-rl:${UNUM}`] === UKEY, h.replaced.join());
  // an uslugi key must not leak into the rieltor alphabet check and vice versa
  const g = run(`?n=AV-0123ABCD&r=${UKEY}`);
  await settle(g);
  check("uslugi: hex key ignored for AV- orders", g.fetched.length === 0);
}
// 11. uslugi pending → the page keeps polling and does not invent a link
{
  const h = run("?n=usl-1a2b3c4d&r=0123456789abcdef0123", { responses: [{ status: "pending" }] });
  await settle(h);
  check("uslugi: pending text", visible(h).join() === "spasibo-rieltor" && h.els["rl-title"].textContent === "Оплата обрабатывается", h.els["rl-title"].textContent);
  check("uslugi: pending polls again", h.fetched.length >= 2, String(h.fetched.length));
  check("uslugi: pending shows no button", h.els["rl-link-wrap"].hidden);
}
// 12. uslugi expired / problem / a hostile link in a paid answer
{
  const e = run("?n=usl-1a2b3c4d&r=0123456789abcdef0123", { responses: [{ status: "expired" }] });
  await settle(e);
  check("uslugi: expired", e.els["rl-title"].textContent === "Срок оплаты истёк" && visible(e).join() === "spasibo-rieltor");
  const p = run("?n=usl-1a2b3c4d&r=0123456789abcdef0123", { responses: [{ status: "problem" }] });
  await settle(p);
  check("uslugi: problem", p.els["rl-title"].textContent === "Заказ требует внимания" && p.els["rl-link-wrap"].hidden);
  const x = run("?n=usl-1a2b3c4d&r=0123456789abcdef0123", { responses: [{ status: "paid", link: "https://evil.example/x" }] });
  await settle(x);
  check("uslugi: hostile link never shown", x.els["rl-link"].href === "" && x.els["rl-link-wrap"].hidden && x.els["rl-title"].textContent === "Оплата обрабатывается", x.els["rl-title"].textContent);
}
// 13. uslugi: a wrong-shape r or a wrong-shape n makes no request at all
{
  const a = run("?n=usl-1a2b3c4d&r=ABCDEFGHJKLMNPQRSTUV");
  await settle(a);
  check("uslugi: rieltor-alphabet r ignored", a.fetched.length === 0 && visible(a).join() === "spasibo-ok");
  const b = run("?n=usl-short&r=0123456789abcdef0123");
  await settle(b);
  check("uslugi: bad n no request", b.fetched.length === 0 && visible(b).join() === "spasibo-plain");
  const c = run(`?n=usl-1a2b3c4d`, { storage: { "av-rl:usl-1a2b3c4d": "0123456789abcdef0123" }, responses: [{ status: "paid", link: "https://max.ru/b?start=usl_ABCDEFGH" }] });
  await settle(c);
  check("uslugi: reload uses the stored r", c.fetched.length === 1 && !c.els["rl-link-wrap"].hidden);
}

console.log(`SPASIBO-RIELTOR status=${failures ? "fail" : "ok"} cases=${cases}`);
process.exit(failures ? 1 : 0);
