#!/usr/bin/env python
"""Start auto-sale front gate (PLAN start-autosale-2026-10-18, E7 + E11 steps 5 and 8).

    python tests/start_autosale_check.py [base_url] [--expect held|start-open|auto]

Runs headless Chromium (Playwright) against the working tree served by `python -m http.server` (or base_url) with the
REAL services.config.js of the checked-out branch. The order API is a stub (every request to https://api.ai-vibes.ru/**
is intercepted and recorded; nothing leaves the machine, no bank, no backend).

  mode held        (branch start/autosale)         every [data-pay] button -> request window, 0 API requests.
  mode start-open  (branch start/autosale-release) setup-start -> payment window with its own consent text; the other
                                                   buttons (VIP 45 000) still -> request window, 0 API requests.
  `--expect auto` (default) derives the mode from heldServices in services.config.js and prints it; the mode is a fact
  of the branch, the checks below are strict for it. `--expect held|start-open` makes a wrong branch fail.

Checks
  1. static: every html file with `data-pay` is enumerated (ids and amounts are checked against the known catalogue, an
     unknown id fails the gate so that a new button forces this test to be updated); VIP is held in the config; every
     page with a payment window carries the setup-start consent text whose sha256 equals tests/fixtures/soglasie-setup-v2.txt
     (without the final newline; the backend compares the same hash) and consentVersions[setup-start] = setup-v2-2026-10.
  2. browser, one fresh context per [data-pay] button on every such page (index.html x4, services/index.html x2 now):
     held  -> the request window opens, the payment window stays closed, button reads «Заказать …», 0 API requests,
              and a forged submit of the (closed) payment form creates no POST /api/orders either;
     open  -> the payment window opens with the own consent text only, valid submit sends product=setup-start,
              consent_version=setup-v2-2026-10, Idempotency-Key, and navigates to the (stub) bank host.
  3. forged config: held list emptied, enabled=true -> setup-vip still opens no payment window and makes no POST.
  4. /spasibo/ in the browser with the stubbed GET /api/rieltor/handoff: Start ready / bound / check_mail / pending->hostile
     link; no `r` -> no request.
  Hard invariant over the whole run: not a single POST /api/orders with product setup-vip; in mode held not a single POST at all.

Last line: START-AUTOSALE status=ok|fail mode=held|start-open buttons=N cases=M posts=P vip_posts=0 [miss=...]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import ROOT, Served, block_metrika, settle, norm_price   # noqa: E402

API = "https://api.ai-vibes.ru"
PAY_HOST = "pay.tbank-online.com"
CATALOGUE = {"setup-start": 750000, "setup-vip": 4500000, "setup-rieltor": 990000}   # known data-pay ids -> kopecks
ALWAYS_HELD = {"setup-vip", "setup-rieltor"}      # never open for payment in the start/autosale line of branches
START_CONSENT_VERSION = "setup-v2-2026-10"
EMAIL, CONTACT = "check@example.com", "+7 900 000-00-00"
FIXTURE = ROOT / "tests" / "fixtures" / "soglasie-setup-v2.txt"
NUM = "AV-0123ABCD"
KEY = "ABCDEFGHJKLMNPQRSTUV"
EXCLUDE_DIRS = {".git", "node_modules", "assets", "docs", "scripts", "tests"}


def need(cond, msg):
    if not cond:
        raise AssertionError(msg)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def html_files():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if rel.parts[0] in EXCLUDE_DIRS:
            continue
        yield rel, read(p)


def page_url(rel: Path) -> str:
    parts = list(rel.parts)
    if parts[-1] == "index.html":
        parts = parts[:-1]
    return "/" + "/".join(parts) + ("/" if rel.name == "index.html" and parts else "")


def config_held() -> list[str]:
    m = re.search(r"heldServices\s*:\s*\[(.*?)\]", read(ROOT / "services.config.js"), re.S)
    need(m, "heldServices not found in services.config.js")
    return re.findall(r"[\"']([^\"']+)[\"']", m.group(1))


def consent_sha() -> str:
    raw = read(FIXTURE)
    need(raw.endswith("\n") and not raw.endswith("\n\n"), "fixture must end with exactly one newline")
    return hashlib.sha256(raw[:-1].encode("utf-8")).hexdigest()


# ------------------------------------------------------------------ the browser stub
class Api:
    """Stand-in for api.ai-vibes.ru: records every request, answers POST /api/orders and GET /api/rieltor/handoff."""

    def __init__(self, handoff=None):
        self.requests, self.posts, self.handoff = [], [], list(handoff or [])

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin, "access-control-allow-headers": "content-type, idempotency-key",
                "access-control-allow-methods": "POST, GET, OPTIONS", "vary": "Origin"}
        self.requests.append((request.method, request.url))
        path = urlparse(request.url).path.rstrip("/")
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "POST" and path == "/api/orders":
            try:
                body = json.loads(request.post_data or "{}")
            except Exception:
                body = {"_raw": request.post_data}
            self.posts.append({"headers": request.headers, "body": body})
            oid = "0123456789abcdef0123456789abcdef"
            resp = {"order_id": oid, "order_number": NUM, "payment_required": True,
                    "payment_url": f"https://{PAY_HOST}/new/{oid}", "amount": CATALOGUE.get(body.get("product"), 100)}
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(resp))
        if request.method == "GET" and path == "/api/rieltor/handoff":
            spec = self.handoff.pop(0) if len(self.handoff) > 1 else (self.handoff[0] if self.handoff else None)
            if spec is None:
                return route.fulfill(status=404, headers=cors, content_type="application/json", body="{}")
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(spec))
        return route.fulfill(status=404, headers=cors, content_type="application/json", body='{"error":"not_found"}')


class Ctx:
    def __init__(self, br, base, api: Api, config_js: str | None = None):
        self.base, self.api, self.navs = base, api, []
        self.ctx = br.new_context(viewport={"width": 1440, "height": 900}, locale="ru-RU")
        host = urlparse(base).netloc
        keep = re.escape(host) + r"|127\.0\.0\.1|localhost"
        self.ctx.route(re.compile(rf"^https?://(?!(?:{keep})(?:[:/]|$))"), lambda r: r.abort())     # nothing leaves the machine
        block_metrika(self.ctx)
        self.ctx.route(re.compile(rf"^https://{re.escape(PAY_HOST)}/"),
                       lambda r: r.fulfill(status=200, content_type="text/html", body="<!doctype html><title>pay-stub</title>stub"))
        self.ctx.route(API + "/**", api.handle)
        if config_js is not None:        # the forged-config case only; every other case reads the real file
            self.ctx.route(re.compile(r"/services\.config\.js(\?.*)?$"),
                           lambda r: r.fulfill(status=200, content_type="application/javascript", body=config_js))
        self.pg = self.ctx.new_page()
        self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)[:120]))
        self.pg.on("request", self._req)

    def _req(self, r):
        try:
            if r.is_navigation_request() and r.frame == self.pg.main_frame:
                self.navs.append(r.url)
        except Exception:
            pass

    def goto(self, path):
        self.pg.goto(self.base + path, wait_until="load", timeout=45000)
        settle(self.pg, 500)

    def left_site(self):
        me = urlparse(self.base).netloc
        return [u for u in self.navs if urlparse(u).netloc not in ("", me)]

    def close(self):
        try:
            self.ctx.close()
        except Exception:
            pass


def buttons(c: Ctx):
    return c.pg.evaluate("""() => [...document.querySelectorAll('[data-pay]')].map(b => ({id: b.getAttribute('data-service-id'),
        order: b.getAttribute('data-order') || '', price: b.getAttribute('data-price-label') || '', amount: b.getAttribute('data-amount') || '',
        text: b.textContent.trim().replace(/\\s+/g, ' ')}))""")


def forged_submit(c: Ctx):
    """Fill the payment form from script and submit it although its window is closed: must not create an order."""
    c.pg.evaluate("""([e, t]) => { const f = document.getElementById('pay-form'); if (!f) return;
        document.getElementById('pay-email').value = e; document.getElementById('pay-contact').value = t;
        document.getElementById('pay-consent').checked = true;
        f.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true})); }""", [EMAIL, CONTACT])
    c.pg.wait_for_timeout(500)


def is_open(held_ids: set[str], sid: str) -> bool:
    return sid not in held_ids and sid not in ALWAYS_HELD


# ------------------------------------------------------------------ cases
def case_held(br, base, path, idx, btn):
    api = Api()
    c = Ctx(br, base, api)
    try:
        c.goto(path)
        need(btn["text"].lower().startswith("заказать"), f"held button reads {btn['text']!r}, not «Заказать …»")
        loc = c.pg.locator("[data-pay]").nth(idx)
        loc.scroll_into_view_if_needed()
        loc.click(timeout=5000)
        c.pg.wait_for_selector("dialog#order-dialog[open]", state="visible", timeout=3500)
        need(c.pg.locator("dialog#pay-dialog[open]").count() == 0, "payment window opened for a held service")
        need(norm_price(btn["order"]) in norm_price(c.pg.inner_text("#order-service")), "request window lacks the service title")
        need(norm_price(btn["price"]) in norm_price(c.pg.inner_text("#order-price")), "request window lacks the price")
        forged_submit(c)
        c.pg.wait_for_timeout(600)
        need(not api.requests, f"API requests from a held button: {api.requests[:3]}")
        need(not c.left_site(), f"navigated away: {c.left_site()[:1]}")
        need(not c.errors, f"page errors: {c.errors[:2]}")
    finally:
        c.close()
    return api


def case_open(br, base, path, idx, btn, sha):
    api = Api()
    c = Ctx(br, base, api)
    try:
        c.goto(path)
        loc = c.pg.locator("[data-pay]").nth(idx)
        loc.scroll_into_view_if_needed()
        loc.click(timeout=5000)
        c.pg.wait_for_selector("dialog#pay-dialog[open]", state="visible", timeout=3500)
        need(c.pg.locator("dialog#order-dialog[open]").count() == 0, "request window open together with the payment window")
        own = c.pg.locator("#pay-consent-text-setup-start")
        need(own.is_visible(), "own consent text of setup-start is not visible")
        need(not c.pg.locator("#pay-consent-text").is_visible(), "the old consent text is visible next to the own one")
        got = hashlib.sha256(own.evaluate("e => e.textContent").encode("utf-8")).hexdigest()
        need(got == sha, f"consent text sha256 {got[:12]} != fixture {sha[:12]}")
        need(norm_price(c.pg.inner_text("#pay-price")) == norm_price(btn["price"]), "payment window price")
        c.pg.wait_for_timeout(2200)                                    # past the 2 s "too fast" trap
        c.pg.fill("#pay-email", EMAIL)
        c.pg.fill("#pay-contact", CONTACT)
        c.pg.check("#pay-consent")
        c.pg.click("#pay-submit", timeout=5000)
        c.pg.wait_for_timeout(1500)
        need(len(api.posts) == 1, f"{len(api.posts)} POSTs, expected 1")
        b, h = api.posts[0]["body"], api.posts[0]["headers"]
        need(b.get("product") == "setup-start", f"product {b.get('product')!r}")
        need(b.get("consent_version") == START_CONSENT_VERSION, f"consent_version {b.get('consent_version')!r}")
        need(b.get("email") == EMAIL and b.get("contact") == CONTACT and b.get("website", "") == "", "email/contact/trap field")
        need(re.match(r"^[0-9a-f-]{36}$", h.get("idempotency-key", "")), "Idempotency-Key is not a uuid")
        need(any(urlparse(u).netloc == PAY_HOST for u in c.left_site()), f"no navigation to the bank host: {c.navs[-2:]}")
    finally:
        c.close()
    return api


def case_forged_config(br, base, path, idx, btn):
    """Held list emptied and payment on: setup-vip must still not pay (NEVER_PAY in assets/pay.js)."""
    cfg = ("window.AI_PAY = " + json.dumps({"enabled": True, "api": API, "consentVersion": "setup-v1-2026-10",
                                            "consentVersions": {"setup-start": START_CONSENT_VERSION},
                                            "heldServices": [], "allowedPayHosts": [PAY_HOST], "timeoutMs": 1500}) + ";\n")
    api = Api()
    c = Ctx(br, base, api, config_js=cfg)
    try:
        c.goto(path)
        loc = c.pg.locator("[data-pay]").nth(idx)
        loc.scroll_into_view_if_needed()
        loc.click(timeout=5000)
        c.pg.wait_for_selector("dialog#order-dialog[open]", state="visible", timeout=3500)
        need(c.pg.locator("dialog#pay-dialog[open]").count() == 0, "VIP payment window opened with a forged config")
        forged_submit(c)
        need(not api.requests, f"API requests for VIP with a forged config: {api.requests[:3]}")
        # even if the payment window is forced open by script, the submit must not create an order
        c.pg.evaluate("() => { const d = document.getElementById('pay-dialog'); if (d && d.showModal && !d.open) d.showModal(); }")
        c.pg.wait_for_timeout(2200)
        c.pg.fill("#pay-email", EMAIL)
        c.pg.fill("#pay-contact", CONTACT)
        c.pg.check("#pay-consent")
        c.pg.click("#pay-submit", timeout=5000)
        c.pg.wait_for_timeout(1200)
        need(not api.posts, f"POST /api/orders for VIP from a forced window: {api.posts[:1]}")
        need(not c.left_site(), "VIP navigated to a bank host")
    finally:
        c.close()
    return api


def spasibo_case(br, base, name, query, handoff, check):
    api = Api(handoff)
    c = Ctx(br, base, api)
    try:
        c.goto("/spasibo/" + query)
        c.pg.wait_for_timeout(900)
        check(c, api)
        need(not api.posts, f"{name}: spasibo created an order")
    finally:
        c.close()
    return api


def run_spasibo(br, base, run):
    ok_link = "https://max.ru/id644404692540_3_bot?start=TOKEN2345"

    def ready(c, api):
        need(c.pg.locator("#spasibo-handoff").is_visible(), "handoff block not visible")
        need(not c.pg.locator("#spasibo-ok").is_visible(), "the 'bank is checking' block stays next to the handoff")
        t = c.pg.inner_text("#spasibo-handoff")
        need("Оплата получена" in t and "«Начать»" in t, f"title/lead: {t[:90]!r}")
        need("Если ссылка не открылась" in t and "письмо продублирует" in t, "fallback / mail text missing")
        need(c.pg.get_attribute("#ho-link", "href") == ok_link, "link href")
        need(c.pg.inner_text("#ho-code").strip() == "ABCD-EFGH-JKLM", "code")
        need(len(api.requests) == 1 and f"n={NUM}" in api.requests[0][1] and f"r={KEY}" in api.requests[0][1], f"requests {api.requests}")
        need("r=" not in c.pg.url and NUM in c.pg.url, f"r not removed from the address bar: {c.pg.url}")
        need("рието" not in t.lower(), "realtor wording on the Start page")
    run("spasibo start ready", lambda: spasibo_case(br, base, "ready", f"?n={NUM}&r={KEY}",
        [{"product": "setup-start", "status": "ready", "link": ok_link, "code": "ABCD-EFGH-JKLM", "bot_name": "Помощник: подключение"}], ready))

    def bound(c, api):
        t = c.pg.inner_text("#spasibo-handoff")
        need("Бот уже подключён" in t and "ho-code" not in t and c.pg.locator("#ho-code-wrap").is_hidden(), t[:80])
    run("spasibo start bound", lambda: spasibo_case(br, base, "bound", f"?n={NUM}&r={KEY}", [{"product": "setup-start", "status": "bound", "bot_name": "Бот"}], bound))

    def mail(c, api):
        need("отправлены на указанную вами почту" in c.pg.inner_text("#spasibo-handoff"), "check_mail text")
    run("spasibo start check_mail", lambda: spasibo_case(br, base, "mail", f"?n={NUM}&r={KEY}", [{"product": "setup-start", "status": "check_mail"}], mail))

    def hostile(c, api):
        need(c.pg.locator("#ho-link-wrap").is_hidden() and c.pg.locator("#ho-code-wrap").is_hidden(), "hostile link/code shown")
        need(c.pg.locator("#spasibo-ok").is_visible(), "the plain order block must stay")
    run("spasibo hostile link", lambda: spasibo_case(br, base, "hostile", f"?n={NUM}&r={KEY}",
        [{"product": "setup-start", "status": "ready", "link": "https://evil.example/x", "code": "ABCD-EFGH-JKLM"}], hostile))

    def no_r(c, api):
        need(not api.requests, f"requests without r: {api.requests}")
        need(c.pg.locator("#spasibo-ok").is_visible(), "order block")
    run("spasibo without r", lambda: spasibo_case(br, base, "no-r", f"?n={NUM}", [], no_r))


# ------------------------------------------------------------------ runner
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--expect", choices=["auto", "held", "start-open"], default="auto")
    a = ap.parse_args(argv)
    from playwright.sync_api import sync_playwright
    fails: list[str] = []
    stats = dict(cases=0, buttons=0, posts=0, vip_posts=0)

    held = set(config_held())
    mode = "start-open" if "setup-start" not in held else "held"
    print(f"MODE {mode} heldServices={sorted(held)}", flush=True)

    def run(name, fn):
        stats["cases"] += 1
        try:
            api = fn()
            if isinstance(api, Api):
                stats["posts"] += len(api.posts)
                stats["vip_posts"] += sum(1 for p in api.posts if p["body"].get("product") == "setup-vip")
            print(f"  ok   {name}", flush=True)
        except Exception as e:
            msg = str(e).strip().splitlines()[0][:170] if str(e).strip() else type(e).__name__
            print(f"  FAIL {name}: {type(e).__name__}: {msg}", flush=True)
            fails.append(name)

    if a.expect != "auto" and a.expect != mode:
        fails.append(f"mode_{mode}_expected_{a.expect}")
        print(f"  FAIL services.config.js is in mode {mode}, expected {a.expect}")

    # ---- 1. static
    pay_pages: list[tuple[str, int]] = []
    try:
        listing = []
        for rel, text in html_files():
            tags = re.findall(r"<a\b[^>]*\sdata-pay(?:\s|>|=)[^>]*>", text)
            if not tags:
                continue
            url = page_url(rel)
            pay_pages.append((url, len(tags)))
            for t in tags:
                sid = re.search(r'data-service-id="([^"]+)"', t)
                amt = re.search(r'data-amount="([^"]+)"', t)
                need(sid, f"{url}: data-pay without data-service-id")
                need(sid.group(1) in CATALOGUE, f"{url}: unknown data-pay service {sid.group(1)!r} - update this test and the hold list")
                need(amt and int(amt.group(1)) == CATALOGUE[sid.group(1)], f"{url}: amount of {sid.group(1)}")
                listing.append(f"{url}:{sid.group(1)}")
        need(pay_pages, "no [data-pay] buttons found in the html files")
        print("  DATA-PAY " + " ".join(listing), flush=True)
        need({"setup-vip", "setup-rieltor"} <= held, "setup-vip / setup-rieltor must be in heldServices")
        cfg = read(ROOT / "services.config.js")
        need(re.search(r"enabled\s*:\s*true", cfg), "enabled must be true (the hold list is what keeps the services in the request mode)")
        need(re.search(r'consentVersions\s*:\s*\{\s*"setup-start"\s*:\s*"' + START_CONSENT_VERSION + '"', cfg), "consentVersions[setup-start]")
        need("draft, approve before release" in cfg, "the consent draft mark is missing in services.config.js")
        sha = consent_sha()
        for url, _ in pay_pages:
            f = ROOT / (url.strip("/") + "/index.html" if url.endswith("/") and url != "/" else (url.strip("/") or "index.html"))
            m = re.search(r'<span id="pay-consent-text-setup-start" data-consent-for="setup-start" hidden>(.*?)</span>', read(f), re.S)
            need(m, f"{url}: no own consent text of setup-start")
            visible = re.sub(r"<[^>]+>", "", m.group(1))
            need(hashlib.sha256(visible.encode("utf-8")).hexdigest() == sha, f"{url}: consent text differs from the fixture")
        need("NEVER_PAY" in read(ROOT / "assets" / "pay.js") and "'setup-vip'" in read(ROOT / "assets" / "pay.js"), "NEVER_PAY[setup-vip] missing in pay.js")
        print(f"  ok   static (pages={len(pay_pages)}, buttons={sum(n for _, n in pay_pages)}, consent sha256={sha[:16]}…)", flush=True)
    except Exception as e:
        print(f"  FAIL static: {type(e).__name__}: {str(e)[:200]}", flush=True)
        fails.append("static")
        pay_pages = pay_pages or [("/", 0)]
    stats["cases"] += 1

    # ---- 2-4. browser
    try:
        with Served(a.base) as srv, sync_playwright() as p:
            br = p.chromium.launch()
            base = srv.base
            sha = consent_sha()
            probe = Ctx(br, base, Api())
            found = []
            try:
                for url, n in pay_pages:
                    probe.goto(url)
                    bs = buttons(probe)
                    if len(bs) != n:
                        fails.append(f"count:{url}")
                        print(f"  FAIL {url}: browser sees {len(bs)} [data-pay], html has {n}")
                    found += [(url, i, b) for i, b in enumerate(bs)]
            finally:
                probe.close()
            stats["buttons"] = len(found)
            for url, i, b in found:
                want_open = is_open(held, b["id"])
                tag = f"button {url}#{i} {b['id']} -> {'pay window' if want_open else 'request window, 0 API requests'}"
                if want_open:
                    run(tag, lambda url=url, i=i, b=b: case_open(br, base, url, i, b, sha))
                else:
                    run(tag, lambda url=url, i=i, b=b: case_held(br, base, url, i, b))
            vip = [(u, i, b) for u, i, b in found if b["id"] == "setup-vip"]
            for url, i, b in vip:
                run(f"forged config {url}#{i} setup-vip", lambda url=url, i=i, b=b: case_forged_config(br, base, url, i, b))
            if not vip:
                fails.append("no_vip_button")
                print("  FAIL no setup-vip button found")
            run_spasibo(br, base, run)
            br.close()
    except Exception as e:
        fails.append(f"gate_error:{type(e).__name__}")
        print(f"GATE_ERROR {type(e).__name__}: {str(e)[:200]}")

    if stats["vip_posts"]:
        fails.append("vip_post")
    if mode == "held" and stats["posts"]:
        fails.append("post_in_held_mode")
    ok = not fails and stats["buttons"] >= 6
    miss = "" if ok else " miss=" + ",".join(re.sub(r"[\s,]+", "_", f) for f in fails[:10])
    print(f"START-AUTOSALE status={'ok' if ok else 'fail'} mode={mode} buttons={stats['buttons']} cases={stats['cases']} "
          f"posts={stats['posts']} vip_posts={stats['vip_posts']}{miss}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
