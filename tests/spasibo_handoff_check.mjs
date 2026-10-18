// Gate for assets/spasibo.js, the handoff (bot link + code) branch: runs the real script in a fake DOM (no browser, no network).
//   node tests/spasibo_rieltor_check.mjs
// Last line: SPASIBO-HANDOFF status=ok|fail cases=N
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "assets", "spasibo.js"), "utf-8");
const IDS = ["spasibo-plain", "spasibo-ok", "spasibo-fail", "spasibo-handoff", "order-number", "retry-pay", "ho-number",
  "ho-title", "ho-lead", "ho-link-wrap", "ho-link", "ho-code-wrap", "ho-fallback", "ho-code", "ho-note"];
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
  check("ready: only the handoff block is shown", visible(h).join() === "spasibo-handoff", visible(h).join());
  check("ready: link", h.els["ho-link"].href === "https://max.ru/id644404692540_3_bot?start=TOKEN2345" && !h.els["ho-link-wrap"].hidden);
  check("ready: code", h.els["ho-code"].textContent === "ABCD-EFGH-JKLM" && !h.els["ho-code-wrap"].hidden);
  check("ready: r hidden from the address bar", h.replaced.length === 1 && !h.replaced[0].includes("r=") && h.replaced[0].includes(NUM), h.replaced.join());
  check("ready: r kept for a reload", h.store[`av-rl:${NUM}`] === KEY);
}
// 2. pending first (the bank is still confirming), then ready
{
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "pending" }, { status: "ready", link: "https://max.ru/x_bot?start=AAA", code: "ABCD EFGH JKLM", bot_name: "Бот" }] });
  await settle(h);
  check("pending: asked again", h.fetched.length === 2, String(h.fetched.length));
  check("pending: ends in ready", h.els["ho-code"].textContent === "ABCD EFGH JKLM" && visible(h).join() === "spasibo-handoff");
}
// 3. a link to a foreign host or a code with markup is never shown
{
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "ready", link: "https://evil.example/x", code: "ABCD-EFGH-JKLM" }, { status: "ready", link: "https://max.ru/b?start=A", code: "<img src=x onerror=alert(1)>" }] });
  await settle(h);
  check("hostile: no link set", h.els["ho-link"].href === "" && h.els["ho-link-wrap"].hidden);
  check("hostile: no code shown", h.els["ho-code"].textContent === "" && h.els["ho-code-wrap"].hidden);
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
  const text = h.els["ho-title"].textContent + " " + h.els["ho-lead"].textContent;
  check(`state ${status}`, visible(h).join() === "spasibo-handoff" && text.includes(word) && h.els["ho-code"].textContent === "", text);
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
// 10. texts by product: Start gets its own instructions, anything else (also hostile keys) the generic ones
for (const [product, own] of [["setup-start", true], ["start", true], ["setup-rieltor", false], ["__proto__", false], ["constructor", false], [undefined, false]]) {
  const h = run(`?n=${NUM}&r=${KEY}`, { responses: [{ status: "ready", product, link: "https://max.ru/id1_bot?start=AAAA", code: "ABCD-EFGH-JKLM", bot_name: "Бот" }] });
  await settle(h);
  const lead = h.els["ho-lead"].textContent, fb = h.els["ho-fallback"].textContent, note = h.els["ho-note"].textContent;
  check(`product ${product}: link and code shown`, visible(h).join() === "spasibo-handoff" && !h.els["ho-link-wrap"].hidden && h.els["ho-code"].textContent === "ABCD-EFGH-JKLM");
  check(`product ${product}: ${own ? "Start texts" : "generic texts"}`,
    own ? (lead.includes("бот сам проведёт") && fb.startsWith("Если ссылка не открылась") && note.includes("письмо продублирует"))
        : (lead.startsWith("Откройте нашего бота") && !note.includes("продублирует")), lead);
}
console.log(`SPASIBO-HANDOFF status=${failures ? "fail" : "ok"} cases=${cases}`);
process.exit(failures ? 1 : 0);
