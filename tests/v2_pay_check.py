#!/usr/bin/env python
"""Pay-flow gate (plan PLAN.md section 5 E3 + 4.5.2 + 13; markup contract in plans/site-v2-2026-10/CONTRACT.md).

    python tests/v2_pay_check.py [base_url] [--backend URL] [--backend-disabled URL]

Part 1 (always). Playwright intercepts every request to https://api.ai-vibes.ru/** (CORS preflight included) and the
page's /services.config.js (enabled true/false), so no real API and no bank is ever called. Chromium, 1440x900.
  * for every `[data-pay]` button of `/` and `/services/` (enumerated by selector): the pay window shows that button's
    own title and price; a valid submit sends product / consent_version / Idempotency-Key (uuid) / website="" and
    navigates to the payment_url (the navigation is caught by interception: pay hosts are answered with an empty page);
  * sessionStorage["av-pay:<id>"] = {key,email,contact,ts}; "back" (pageshow) unlocks the button and the repeat uses the
    same key; 409 payment_link_expired -> new key and exactly one retry; after fail=1 the retry opens the window again
    and creates a NEW key; a record older than a day gets a new key;
  * negative cases (counted as neg=K/K): empty e-mail / contact / unchecked consent block the request; amount mismatch,
    403, 429, 500, timeout, foreign payment_url host -> error state with "write to us" and no navigation; the second 409
    stops after one retry; PAY_ENABLED=false -> no API request; /spasibo/ with markup in `n`, with a malformed `n`,
    with extra bank parameters (never shown, never claims the payment succeeded), without `n`; empty sessionStorage ->
    the retry link points to /#tarify.
Part 2 (--backend URL): the same successful scenarios against the local BACK dev server (printed by
`python scripts/dev_service_server.py` as `DEV_SERVER url=...` in ai-stroyka-orders-svc-wt): a real CORS preflight with
the Idempotency-Key header, order_number AV-XXXXXXXX, amount = data-amount, payment_url present, the same key returns the
same order. `--backend-disabled URL` (a second server with WEBINTAKE_SERVICE_PAYMENTS_ENABLED off) must answer 503
service_payments_disabled and the page must show the error state. Without --backend: backend=skipped.
Contract expectation not in CONTRACT.md: the config may carry `timeoutMs` (the 15 s client timeout is shortened to 1.5 s
by it); if pay.js ignores it the timeout case simply waits the full 15 s.
Last line: PAY status=ok|fail buttons=N neg=K/K backend=local|skipped [disabled=..] [miss=..]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, block_metrika, settle, norm_price   # noqa: E402

API = "https://api.ai-vibes.ru"
CONSENT = "setup-v1-2026-10"
PAY_HOSTS = ["securepay.tinkoff.ru", "pay.tbank-online.com"]
AMOUNTS = {"setup-start": 750000, "setup-vip": 4500000}
PAGES = ["/", "/services/"]
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
ORDER_RE = re.compile(r"^AV-[0-9A-F]{8}$")
EMAIL, CONTACT = "check@example.com", "+7 900 000-00-00"
TIMEOUT_MS = 1500
GOOD_N = "AV-0123ABCD"


def config_js(enabled: bool, api: str = API, extra_hosts: tuple = ()) -> str:
    return ("window.AI_PAY = " + json.dumps({"enabled": enabled, "api": api, "consentVersion": CONSENT,
                                              "allowedPayHosts": PAY_HOSTS + list(extra_hosts), "timeoutMs": TIMEOUT_MS}) + ";\n")


class Mock:
    """Scripted stand-in for api.ai-vibes.ru. `script` is a list of specs (the last one repeats) or a function
    (body, headers, n) -> spec. Spec: ("ok", overrides) | ("status", code, json_body) | ("hang",)."""

    def __init__(self, script):
        self.script, self.posts, self.requests, self.parked = script, [], [], []

    def spec(self, body, headers):
        n = len(self.posts) - 1
        if callable(self.script):
            return self.script(body, headers, n)
        return self.script[min(n, len(self.script) - 1)]

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin, "access-control-allow-headers": "content-type, idempotency-key",
                "access-control-allow-methods": "POST, GET, OPTIONS", "vary": "Origin"}
        self.requests.append((request.method, request.url))
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "POST" and urlparse(request.url).path.rstrip("/") == "/api/orders":
            try:
                body = json.loads(request.post_data or "{}")
            except Exception:
                body = {"_raw": request.post_data}
            self.posts.append({"headers": request.headers, "body": body})
            spec = self.spec(body, request.headers)
            if spec[0] == "hang":
                self.parked.append(route)
                return
            if spec[0] == "status":
                return route.fulfill(status=spec[1], headers=cors, content_type="application/json", body=json.dumps(spec[2]))
            oid = uuid.uuid4().hex
            resp = {"order_id": oid, "order_number": "AV-" + oid[:8].upper(), "payment_required": True,
                    "payment_url": f"https://{PAY_HOSTS[0]}/new/{oid}", "amount": AMOUNTS.get(body.get("product"), 100)}
            resp.update(spec[1] if len(spec) > 1 else {})
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(resp))
        return route.fulfill(status=404, headers=cors, content_type="application/json", body='{"error":"not_found"}')


class Site:
    """One browser context with its page, the interception and the navigation log."""

    def __init__(self, br, base, mock=None, enabled=True, api=API, extra_hosts=(), real_api=False):
        self.base, self.mock, self.navs = base, mock, []
        self.ctx = br.new_context(viewport={"width": 1440, "height": 900}, locale="ru-RU")
        host = urlparse(base).netloc
        keep = re.escape(host) + r"|127\.0\.0\.1|localhost"
        self.ctx.route(re.compile(rf"^https?://(?!(?:{keep})(?:[:/]|$))"), lambda r: r.abort())      # nothing leaves the machine
        block_metrika(self.ctx)
        stub = lambda r: r.fulfill(status=200, content_type="text/html", body="<!doctype html><title>pay-stub</title>stub")
        self.ctx.route(re.compile(r"^https://(securepay\.tinkoff\.ru|pay\.tbank-online\.com|evil\.example)/"), stub)
        if mock is not None:
            self.ctx.route(API + "/**", mock.handle)
        self.ctx.route(re.compile(r"/services\.config\.js(\?.*)?$"),
                       lambda r: r.fulfill(status=200, content_type="application/javascript", body=config_js(enabled, api, extra_hosts)))
        self.pg = self.ctx.new_page()
        self.stored = {}                      # last value written to sessionStorage["av-pay:*"], kept across the redirect
        self.pg.expose_function("__avRec", lambda k, v: self.stored.__setitem__(k, v))
        self.pg.add_init_script("""(() => { const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) { try { if (this === window.sessionStorage && String(k).startsWith('av-pay:')) window.__avRec(String(k), String(v)); } catch (e) {} return set.apply(this, arguments); }; })();""")
        self.pg.on("request", self._req)
        self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)[:100]))

    def _req(self, r):
        try:
            if r.is_navigation_request() and r.frame == self.pg.main_frame:
                self.navs.append(r.url)
        except Exception:
            pass

    def goto(self, path):
        resp = self.pg.goto(self.base + path, wait_until="load", timeout=45000)
        settle(self.pg, 500)
        return resp.status if resp else 0

    def close(self):
        for r in (self.mock.parked if self.mock else []):
            try:
                r.abort()
            except Exception:
                pass
        try:
            self.ctx.close()
        except Exception:
            pass

    # -- helpers on the page
    def buttons(self):
        return self.pg.evaluate("""() => [...document.querySelectorAll('[data-pay]')].map(b => ({id: b.getAttribute('data-service-id'),
            order: b.getAttribute('data-order') || '', price: b.getAttribute('data-price-label') || '', amount: b.getAttribute('data-amount') || '',
            text: b.textContent.trim().replace(/\\s+/g, ' '), tag: b.tagName}))""")

    def open_dialog(self, idx, sel="dialog#pay-dialog"):
        loc = self.pg.locator("[data-pay]").nth(idx)
        loc.scroll_into_view_if_needed()
        loc.click(timeout=5000)
        self.pg.wait_for_selector(f"{sel}[open]", state="visible", timeout=3500)

    def fill(self, email=EMAIL, contact=CONTACT, consent=True):
        self.pg.fill("#pay-email", email)
        self.pg.fill("#pay-contact", contact)
        if consent:
            self.pg.check("#pay-consent")
        else:
            self.pg.uncheck("#pay-consent")

    def submit(self):
        self.pg.click("#pay-submit", timeout=5000)

    def left_site(self):
        me = urlparse(self.base).netloc
        return any(urlparse(u).netloc not in ("", me) for u in self.navs)

    def outcome(self, timeout_ms=8000):
        """'redirect' (a main-frame navigation request to another host), 'error' (state=error), or 'none'."""
        end = time.time() + timeout_ms / 1000
        me = urlparse(self.base).netloc
        while time.time() < end:
            for u in self.navs:
                if urlparse(u).netloc not in ("", me):
                    return "redirect", u
            try:
                st = self.pg.get_attribute("#pay-status", "data-state", timeout=300)
            except Exception:
                st = None
            if st == "error":
                return "error", self.pg.inner_text("#pay-status")
            self.pg.wait_for_timeout(120)
        return "none", ""

    def storage(self, sid):
        raw = self.stored.get(f"av-pay:{sid}")
        return json.loads(raw) if raw else None


def need(cond, msg):
    if not cond:
        raise AssertionError(msg)


def error_checks(s: Site, what: str):
    st = s.pg.inner_text("#pay-status")
    need(re.search(r"напишите", st, re.I), f"{what}: no 'write to us' text in #pay-status ({st[:60]!r})")
    n_contacts = s.pg.locator("dialog#pay-dialog a[href*='max.ru'], dialog#pay-dialog a[href*='t.me'], dialog#pay-dialog a[href^='mailto:']").count()
    need(n_contacts >= 1, f"{what}: no contact link inside the pay window")
    need(not s.left_site(), f"{what}: the page navigated away: {s.navs[-1:]}")


# ------------------------------------------------------------------ cases
def case_button(br, base, path, idx, btn):
    mock = Mock([("ok", {"amount": int(btn["amount"] or 0)})])
    s = Site(br, base, mock)
    try:
        s.goto(path)
        sid = btn["id"]
        if sid in AMOUNTS:
            need(btn["amount"] == str(AMOUNTS[sid]), f"data-amount {btn['amount']!r} != {AMOUNTS[sid]}")
        need(btn["tag"] == "A", f"button is <{btn['tag']}>, not <a>")
        s.open_dialog(idx)
        title, price = s.pg.inner_text("#pay-title"), norm_price(s.pg.inner_text("#pay-price"))
        need(norm_price(btn["order"]) in norm_price(title), f"window title {title[:50]!r} lacks data-order {btn['order'][:40]!r}")
        need(norm_price(btn["price"]) in price, f"window price {price!r} lacks {btn['price']!r}")
        s.pg.wait_for_timeout(2200)                                   # past the 2 s "too fast" trap window
        s.fill()
        s.submit()
        kind, url = s.outcome()
        need(kind == "redirect", f"no redirect after valid submit ({kind}: {url[:60]!r})")
        need(len(mock.posts) == 1, f"{len(mock.posts)} POSTs, expected 1")
        post = mock.posts[0]
        b, h = post["body"], post["headers"]
        need(b.get("product") == sid, f"product {b.get('product')!r} != {sid!r}")
        need(b.get("consent_version") == CONSENT, f"consent_version {b.get('consent_version')!r}")
        need(b.get("email") == EMAIL and b.get("contact") == CONTACT, "email/contact not sent as typed")
        need(b.get("website", "") == "", f"trap field sent non-empty: {b.get('website')!r}")
        key = h.get("idempotency-key", "")
        need(UUID_RE.match(key), f"Idempotency-Key not a uuid4: {key!r}")
        need("json" in h.get("content-type", ""), f"content-type {h.get('content-type')!r}")
        need(url.startswith(f"https://{PAY_HOSTS[0]}/"), f"navigated to {url[:60]!r}")
        rec = s.storage(sid)
        need(rec and rec.get("key") == key and rec.get("email") == EMAIL and rec.get("contact") == CONTACT and "ts" in rec,
             f"sessionStorage av-pay:{sid} = {rec!r}")
    finally:
        s.close()


def first_button(br, base):
    s = Site(br, base, Mock([("ok",)]))
    try:
        for path in ("/services/", "/"):
            s.goto(path)
            for i, b in enumerate(s.buttons()):
                if b["id"] == "setup-start":
                    return path, i, b
    finally:
        s.close()
    return None


def flow_ok(s: Site, idx, wait_trap=True, timeout_ms=8000):
    s.open_dialog(idx)
    if wait_trap:
        s.pg.wait_for_timeout(2200)
    s.fill()
    s.submit()
    return s.outcome(timeout_ms)


def case_back_same_key(br, base, path, idx, btn):
    mock = Mock([("ok",)])
    s = Site(br, base, mock)
    try:
        s.goto(path)
        k, u = flow_ok(s, idx)
        need(k == "redirect", "first flow did not redirect")
        key1 = mock.posts[0]["headers"].get("idempotency-key")
        s.navs.clear()
        s.pg.go_back()
        s.pg.wait_for_timeout(1200)
        need(s.pg.url.startswith(base), f"back did not return to the site ({s.pg.url[:50]})")
        b = s.pg.locator("[data-pay]").nth(idx)
        need(b.get_attribute("aria-busy") != "true" and b.get_attribute("aria-disabled") != "true" and b.get_attribute("disabled") is None,
             "button still locked after pageshow")
        s.open_dialog(idx)
        s.pg.wait_for_timeout(2200)
        s.fill()
        s.submit()
        k, u = s.outcome()
        need(k == "redirect" and len(mock.posts) == 2, f"repeat did not redirect ({k}, posts={len(mock.posts)})")
        key2 = mock.posts[1]["headers"].get("idempotency-key")
        need(key1 == key2, f"repeat used a different key: {key1} / {key2}")
    finally:
        s.close()


def case_409_new_key(br, base, path, idx, btn):
    mock = Mock([("status", 409, {"error_code": "payment_link_expired", "message": "payment_link_expired"}), ("ok",)])
    s = Site(br, base, mock)
    try:
        s.goto(path)
        k, u = flow_ok(s, idx)
        need(k == "redirect", f"no redirect after 409 -> retry ({k})")
        need(len(mock.posts) == 2, f"{len(mock.posts)} POSTs after a 409, expected 2")
        k1, k2 = (p["headers"].get("idempotency-key") for p in mock.posts)
        need(k1 != k2 and UUID_RE.match(k2 or ""), f"409 retry reused the key or sent a bad one: {k1} / {k2}")
    finally:
        s.close()


def case_409_twice(br, base, path, idx, btn):
    mock = Mock([("status", 409, {"error_code": "payment_link_expired", "message": "payment_link_expired"})])
    s = Site(br, base, mock)
    try:
        s.goto(path)
        k, u = flow_ok(s, idx)
        need(k == "error", f"second 409 did not end in the error state ({k})")
        s.pg.wait_for_timeout(800)
        need(len(mock.posts) == 2, f"{len(mock.posts)} POSTs after repeated 409, expected exactly 2 (one retry)")
        error_checks(s, "409x2")
    finally:
        s.close()


def case_fail_path_new_key(br, base, path, idx, btn):
    mock = Mock([("ok",)])
    s = Site(br, base, mock)
    try:
        s.goto(path)
        k, u = flow_ok(s, idx)
        need(k == "redirect", "first flow did not redirect")
        key1 = mock.posts[0]["headers"].get("idempotency-key")
        s.navs.clear()
        s.goto(f"/spasibo/?fail=1&n={GOOD_N}")
        need(s.pg.locator("#spasibo-fail").is_visible(), "#spasibo-fail not visible for ?fail=1")
        href = s.pg.get_attribute("a#retry-pay", "href") or ""
        need("tarify" in href, f"retry-pay href {href!r} does not lead to /#tarify")
        need(not any(urlparse(h).netloc in PAY_HOSTS for h in s.navs), "fail page navigated to the old payment link")
        s.pg.click("a#retry-pay")
        s.pg.wait_for_selector("dialog#pay-dialog[open]", state="visible", timeout=4000)
        need(s.pg.input_value("#pay-email") == EMAIL, "retry window not prefilled from sessionStorage")
        s.pg.wait_for_timeout(2200)
        s.pg.check("#pay-consent")
        s.submit()
        k, u = s.outcome()
        need(k == "redirect" and len(mock.posts) == 2, f"retry did not create a new order ({k}, posts={len(mock.posts)})")
        need(mock.posts[1]["headers"].get("idempotency-key") != key1, "fail=1 retry reused the old Idempotency-Key")
    finally:
        s.close()


def case_stale_record(br, base, path, idx, btn):
    old = "00000000-0000-4000-8000-000000000000"
    sid = btn["id"]

    def script(body, headers, n):
        return ("status", 409, {"error_code": "payment_link_expired", "message": "payment_link_expired"}) if headers.get("idempotency-key") == old else ("ok",)
    mock = Mock(script)
    s = Site(br, base, mock)
    try:
        s.goto(path)
        s.pg.evaluate("([k, v]) => sessionStorage.setItem(k, v)",
                      [f"av-pay:{sid}", json.dumps({"key": old, "email": EMAIL, "contact": CONTACT, "ts": int((time.time() - 26 * 3600) * 1000)})])
        s.pg.reload(wait_until="load")
        settle(s.pg, 400)
        s.open_dialog(idx)
        s.pg.wait_for_timeout(2200)
        s.pg.fill("#pay-email", EMAIL)
        s.pg.fill("#pay-contact", CONTACT)
        s.pg.check("#pay-consent")
        s.submit()
        k, u = s.outcome()
        need(k == "redirect", f"record older than a day did not end in a new order ({k})")
        need(mock.posts[-1]["headers"].get("idempotency-key") != old, "the day-old key was used for the final order")
    finally:
        s.close()


def neg_blocked(field):
    def f(br, base, path, idx, btn):
        mock = Mock([("ok",)])
        s = Site(br, base, mock)
        try:
            s.goto(path)
            s.open_dialog(idx)
            s.pg.wait_for_timeout(2200)
            s.fill(email="" if field == "email" else EMAIL, contact="" if field == "contact" else CONTACT, consent=field != "consent")
            s.submit()
            s.pg.wait_for_timeout(1200)
            need(len(mock.posts) == 0, f"{len(mock.posts)} POST(s) sent with {field} missing")
            need(not s.left_site(), "navigated away")
            need(s.pg.locator("dialog#pay-dialog[open]").count() == 1, "pay window closed on invalid input")
        finally:
            s.close()
    return f


def neg_error(script, label, timeout_ms=8000):
    def f(br, base, path, idx, btn):
        mock = Mock(script(btn) if callable(script) else script)
        s = Site(br, base, mock)
        try:
            s.goto(path)
            k, u = flow_ok(s, idx, timeout_ms=timeout_ms)
            need(k == "error", f"{label}: expected the error state, got {k} {u[:50]!r}")
            error_checks(s, label)
        finally:
            s.close()
    return f


def neg_disabled(br, base, path, idx, btn):
    mock = Mock([("ok",)])
    s = Site(br, base, mock, enabled=False)
    try:
        s.goto(path)
        txt = s.buttons()[idx]["text"]
        need(txt.lower().startswith("заказать"), f"button text with PAY_ENABLED=false: {txt!r}")
        s.open_dialog(idx, sel="dialog#order-dialog")
        need(s.pg.locator("dialog#pay-dialog[open]").count() == 0, "pay window opened with PAY_ENABLED=false")
        s.pg.wait_for_timeout(600)
        need(not mock.requests, f"API requests with PAY_ENABLED=false: {mock.requests[:2]}")
    finally:
        s.close()


def case_spasibo_markup(br, base, *_):
    mock = Mock([("ok",)])
    s = Site(br, base, mock)
    try:
        s.goto("/spasibo/?n=" + "%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E")
        need(s.pg.evaluate("window.__x === undefined"), "markup in n was executed")
        need(s.pg.locator("#spasibo-ok img, #order-number img, #spasibo-plain img").count() == 0, "markup in n produced an element")
        need("<" not in s.pg.inner_text("body"), "markup in n is printed")
        need(not s.pg.locator("#spasibo-ok").is_visible(), "#spasibo-ok visible for a bad n")
        need(s.pg.locator("#spasibo-plain").is_visible(), "#spasibo-plain not visible for a bad n")
        need(not mock.requests, "spasibo called the API")
    finally:
        s.close()


def case_spasibo_bad_format(br, base, *_):
    s = Site(br, base, Mock([("ok",)]))
    try:
        for bad in ("AV-0123abcd", "AV-0123ABCG", "AV-0123ABC", "AV-0123ABCDE", "av-0123ABCD"):
            s.goto("/spasibo/?n=" + bad)
            need(not s.pg.locator("#spasibo-ok").is_visible() and bad not in s.pg.inner_text("body"), f"malformed n {bad!r} shown")
            need(s.pg.locator("#spasibo-plain").is_visible(), f"#spasibo-plain hidden for {bad!r}")
    finally:
        s.close()


def case_spasibo_extra(br, base, *_):
    s = Site(br, base, Mock([("ok",)]))
    try:
        s.goto(f"/spasibo/?n={GOOD_N}&Success=true&ErrorCode=0&PaymentId=7770001&Status=CONFIRMED&Amount=750000&Pan=430000**0777")
        need(s.pg.locator("#spasibo-ok").is_visible(), "#spasibo-ok not visible for a valid n with bank parameters")
        need(s.pg.inner_text("#order-number").strip() == GOOD_N, f"#order-number = {s.pg.inner_text('#order-number')!r}")
        body = s.pg.inner_text("body")
        for junk in ("7770001", "CONFIRMED", "430000"):
            need(junk not in body, f"bank parameter {junk} shown")
        need(not re.search(r"оплата\s+(прошла|получена|подтвержд)|оплачен", body, re.I), "page claims the payment succeeded")
        need(re.search(r"проверяется", body, re.I), "no 'payment is being checked' text")
    finally:
        s.close()


def case_spasibo_plain(br, base, *_):
    s = Site(br, base, Mock([("ok",)]))
    try:
        s.goto("/spasibo/")
        need(s.pg.locator("#spasibo-plain").is_visible(), "#spasibo-plain not visible without n")
        need(not s.pg.locator("#spasibo-ok").is_visible() and not s.pg.locator("#spasibo-fail").is_visible(), "ok/fail blocks visible without n")
        s.goto("/spasibo/?fail=1")
        need(s.pg.locator("#spasibo-fail").is_visible(), "#spasibo-fail not visible for ?fail=1")
    finally:
        s.close()


def case_retry_empty_storage(br, base, *_):
    s = Site(br, base, Mock([("ok",)]))
    try:
        s.goto(f"/spasibo/?fail=1&n={GOOD_N}")
        href = s.pg.get_attribute("a#retry-pay", "href") or ""
        u = urlparse(href)
        need(u.fragment == "tarify" and u.path in ("", "/"), f"retry link with empty storage: {href!r}")
        s.pg.click("a#retry-pay")
        s.pg.wait_for_timeout(1200)
        need(urlparse(s.pg.url).fragment == "tarify", f"retry did not land on /#tarify: {s.pg.url}")
    finally:
        s.close()


# ------------------------------------------------------------------ backend part
def preflight(backend, base):
    req = urllib.request.Request(backend.rstrip("/") + "/api/orders", method="OPTIONS", headers={
        "Origin": base, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,idempotency-key"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            h = {k.lower(): v for k, v in r.headers.items()}
            st = r.status
    except urllib.error.HTTPError as e:
        return f"preflight status {e.code}"
    except Exception as e:
        return f"preflight failed: {type(e).__name__}"
    if st not in (200, 204):
        return f"preflight status {st}"
    if h.get("access-control-allow-origin") not in (base, "*"):
        return f"preflight allow-origin {h.get('access-control-allow-origin')!r}"
    if "idempotency-key" not in h.get("access-control-allow-headers", "").lower():
        return f"preflight allow-headers lacks idempotency-key: {h.get('access-control-allow-headers')!r}"
    return None


def capture(s: Site, backend: str):
    """Proxy POST /api/orders to the real backend through Playwright and keep (status, json): the body would be lost with the navigation."""
    got = []

    def h(route, request):
        if request.method != "POST":
            return route.continue_()
        resp = route.fetch()
        try:
            body = resp.json()
        except Exception:
            body = {"_raw": resp.text()[:100]}
        got.append((resp.status, body))
        route.fulfill(response=resp)
    s.ctx.route(backend.rstrip("/") + "/api/orders*", h)
    return got


def case_backend_button(backend):
    host = urlparse(backend).hostname or "127.0.0.1"

    def f(br, base, path, idx, btn):
        s = Site(br, base, None, api=backend.rstrip("/"), extra_hosts=(host,))
        try:
            orders = capture(s, backend)
            s.goto(path)
            s.open_dialog(idx)
            s.pg.wait_for_timeout(2200)
            s.fill()
            s.submit()
            s.outcome(10000)
            need(orders, "no POST /api/orders reached the backend")
            body = orders[0][1]
            need(orders[0][0] == 200, f"backend answered {orders[0][0]}: {str(body)[:80]}")
            need(ORDER_RE.match(str(body.get("order_number", ""))), f"order_number {body.get('order_number')!r}")
            need(str(body.get("amount")) == btn["amount"], f"amount {body.get('amount')} != data-amount {btn['amount']}")
            need(str(body.get("payment_url", "")).startswith("http"), f"payment_url {body.get('payment_url')!r}")
            need(any(n.startswith(body["payment_url"].split("?")[0]) for n in s.navs), "the page did not navigate to payment_url")
            first = body["order_number"]
            s.navs.clear()
            s.goto(path)                                              # same tab: sessionStorage keeps the key
            orders.clear()
            s.open_dialog(idx)
            s.pg.wait_for_timeout(2200)
            s.fill()
            s.submit()
            s.outcome(10000)
            need(orders, "repeat did not reach the backend")
            need(orders[0][1].get("order_number") == first, "the same Idempotency-Key produced a different order")
        finally:
            s.close()
    return f


def case_backend_disabled(url):
    host = urlparse(url).hostname or "127.0.0.1"

    def f(br, base, path, idx, btn):
        s = Site(br, base, None, api=url.rstrip("/"), extra_hosts=(host,))
        try:
            answers = capture(s, url)
            s.goto(path)
            k, u = flow_ok(s, idx)
            need(answers and answers[0][0] == 503, f"disabled backend answered {answers[0][0] if answers else 'nothing'}, expected 503")
            need("service_payments_disabled" in json.dumps(answers[0][1]), "503 body lacks service_payments_disabled")
            need(k == "error", f"page state after 503: {k}")
            error_checks(s, "503")
        finally:
            s.close()
    return f


# ------------------------------------------------------------------ runner
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--backend")
    ap.add_argument("--backend-disabled")
    a = ap.parse_args(argv)
    from playwright.sync_api import sync_playwright
    fails: list[str] = []
    backend, disabled = "skipped", "skipped"
    stats = dict(buttons=0, neg_ok=0, neg_total=0)

    def run(name, fn, neg=False):
        if neg:
            stats["neg_total"] += 1
        try:
            fn()
            print(f"  ok   {name}", flush=True)
            if neg:
                stats["neg_ok"] += 1
        except Exception as e:
            msg = str(e).strip().splitlines()[0][:150] if str(e).strip() else type(e).__name__
            print(f"  FAIL {name}: {type(e).__name__}: {msg}", flush=True)
            fails.append(name)

    try:
        with Served(a.base) as srv, sync_playwright() as p:
            br = p.chromium.launch()
            base = srv.base
            probe = Site(br, base, Mock([("ok",)]))
            buttons = []
            try:
                for path in PAGES:
                    probe.goto(path)
                    bs = probe.buttons()
                    buttons += [(path, i, b) for i, b in enumerate(bs)]
                    if len(bs) < 2:
                        fails.append(f"buttons:{path}={len(bs)}")
                        print(f"  FAIL {path}: {len(bs)} [data-pay] buttons, need >= 2")
            except Exception as e:
                fails.append("enumerate")
                print(f"  FAIL enumerate buttons: {type(e).__name__}: {str(e)[:100]}")
            finally:
                probe.close()
            stats["buttons"] = len(buttons)
            # positives, one run per button
            for path, i, b in buttons:
                run(f"button {path}#{i} {b['id']}", lambda path=path, i=i, b=b: case_button(br, base, path, i, b))
            ref = None
            try:
                ref = first_button(br, base)
            except Exception:
                pass
            if ref is None and buttons:
                ref = buttons[0]
            if ref is None:
                for nm in ("back_same_key", "409_new_key", "fail_path_new_key", "stale_record"):
                    fails.append(nm)
                    print(f"  FAIL {nm}: no [data-pay] button to run it on")
                for nm in ["email_empty", "contact_empty", "consent_off", "amount_mismatch", "http_403", "http_429", "http_500", "timeout",
                           "foreign_host", "409_twice", "pay_disabled"]:
                    stats["neg_total"] += 1
                    fails.append("neg:" + nm)
                    print(f"  FAIL neg {nm}: no [data-pay] button to run it on")
            else:
                path, idx, btn = ref
                run("repeat_after_back_same_key", lambda: case_back_same_key(br, base, path, idx, btn))
                run("409_new_key_one_retry", lambda: case_409_new_key(br, base, path, idx, btn))
                run("fail_path_new_key", lambda: case_fail_path_new_key(br, base, path, idx, btn))
                run("stale_record_new_key", lambda: case_stale_record(br, base, path, idx, btn))
                negs = [
                    ("email_empty", neg_blocked("email")), ("contact_empty", neg_blocked("contact")), ("consent_off", neg_blocked("consent")),
                    ("amount_mismatch", neg_error(lambda btn: [("ok", {"amount": int(btn["amount"] or 1) + 100})], "amount mismatch")),
                    ("http_403", neg_error([("status", 403, {"error_code": "forbidden", "message": "forbidden"})], "403")),
                    ("http_429", neg_error([("status", 429, {"error_code": "rate_limited", "message": "rate_limited"})], "429")),
                    ("http_500", neg_error([("status", 500, {"error_code": "server_error", "message": "server_error"})], "500")),
                    ("timeout", neg_error([("hang",)], "timeout", timeout_ms=22000)),
                    ("foreign_host", neg_error([("ok", {"payment_url": "https://evil.example/pay/1"})], "foreign payment_url")),
                    ("409_twice", case_409_twice), ("pay_disabled", neg_disabled)]
                for nm, fn in negs:
                    run("neg " + nm, lambda fn=fn: fn(br, base, path, idx, btn), neg=True)
            for nm, fn in [("spasibo_markup_in_n", case_spasibo_markup), ("spasibo_malformed_n", case_spasibo_bad_format),
                           ("spasibo_extra_bank_params", case_spasibo_extra), ("spasibo_without_n", case_spasibo_plain),
                           ("retry_link_empty_storage", case_retry_empty_storage)]:
                run("neg " + nm, lambda fn=fn: fn(br, base), neg=True)
            # ---------------- part 2
            if a.backend:
                backend = "local"
                run("backend preflight", lambda: (lambda m: need(m is None, m))(preflight(a.backend, base)))
                for path, i, b in buttons:
                    run(f"backend button {path}#{i} {b['id']}", lambda path=path, i=i, b=b: case_backend_button(a.backend)(br, base, path, i, b))
            if a.backend_disabled and ref:
                before = len(fails)
                run("backend disabled -> 503", lambda: case_backend_disabled(a.backend_disabled)(br, base, *ref))
                disabled = "ok" if len(fails) == before else "fail"
            br.close()
    except Exception as e:
        fails.append(f"gate_error:{type(e).__name__}")
        print(f"GATE_ERROR {type(e).__name__}: {str(e)[:200]}")
    ok = not fails and stats["buttons"] >= 4
    extra = f" disabled={disabled}" if a.backend_disabled else ""
    extra += "" if ok else " miss=" + ",".join(re.sub(r"[\s,]+", "_", f) for f in fails[:10])
    print(f"PAY status={'ok' if ok else 'fail'} buttons={stats['buttons']} neg={stats['neg_ok']}/{stats['neg_total']} backend={backend}{extra}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
