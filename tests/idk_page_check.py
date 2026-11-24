#!/usr/bin/env python
"""Order page of «Комплект исполнительной документации» (id-komplekt.html). Playwright against scripts/mock_api.mjs.

    python tests/idk_page_check.py [--shots DIR]

Serves the working tree on 127.0.0.1 (helper of tests/v2_gate.py), starts scripts/mock_api.mjs on a free port and
forwards every request to https://api.ai-vibes.ru/** to it (CORS preflight answered here); the bank and Metrika
are intercepted. Checks:
  а) the page is noindex, has the consent checkbox, the approved short text, a flat 1 000 RUB beta price and the beta notice;
  б) the checkbox text equals the backend registry text verbatim (read from the backend repo; skipped when absent);
  в) client checks: no files / bad extension / more than 20 files / more than 200 MB / bad email / no consent /
     bad contact -> Russian message and NO request to the API;
  г) the whole flow against the mock: form -> upload -> queued -> awaiting_payment (composition, missing list,
     the server amount, pay button) -> pay -> delivered (download link) ; screenshots at 1440 and 390 px;
  д) a foreign payment host and a foreign download host render no button;
  е) the stored order token brings the status back after a reload; failed shows the server message;
  ж) no page errors, no CSP violations, no horizontal scroll at 390 px.
Last line: IDK status=ok|fail checks=<n>/<n>
"""
from __future__ import annotations

import argparse
import ast
import html
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, free_port  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BACKEND_REGISTRY = Path(r"C:\Users\user\.claude\0 ProEKTi\ai-stroyka-orders-idk\webintake\consent_registry.py")
DEFAULT_SHOTS = Path(r"C:\Users\user\.claude\plans\id-service-ai-vibes\stage3\front-shots")
API = "https://api.ai-vibes.ru"
PAGE = "/id-komplekt.html"
FIX = Path(__file__).resolve().parent / "fixtures"
EMAIL = "check@example.com"
RESULTS: list[tuple[bool, str]] = []

SHORT_TEXT = ("Сервис готовит черновики документов. Всё, что он рассчитал сам, перечислено в ведомости допусков — "
              "проверьте её до подписания. Подписи, паспорта партий, протоколы и исполнительные схемы — за вами. "
              "Документы хранятся 30 дней и удаляются автоматически.")


BETA_TEXT = ("Услуга в бета-тестировании. В ходе тестирования возможны ошибки. Оплата не возвращается, но услуга будет оказана "
             "до конца: при сбое к заказу подключится менеджер или система будет доработана и ваши файлы обработают повторно.")
BETA_RULE = "Оплата не возвращается, но услуга будет оказана до конца"


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    print(("OK   " if ok else "FAIL ") + name, flush=True)
    return bool(ok)


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).strip()


def registry_statement() -> str | None:
    """The consent text of idk-v1-2026-11 from the backend repo, or None when the repo is not on this machine."""
    if not BACKEND_REGISTRY.exists():
        return None
    tree = ast.parse(BACKEND_REGISTRY.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "_IDK_V1_STATEMENT" for t in node.targets):
            return norm(ast.literal_eval(node.value))
    return None


class Mock:
    def __init__(self):
        self.port = free_port()
        self.proc = None

    def __enter__(self):
        env = {**__import__("os").environ, "MOCK_PORT": str(self.port)}
        self.proc = subprocess.Popen(["node", str(ROOT / "scripts" / "mock_api.mjs")], env=env,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{self.port}/healthz", timeout=1).read()
                return self
            except Exception:
                time.sleep(0.1)
        raise RuntimeError("mock_api did not start")

    def __exit__(self, *exc):
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except Exception:
                self.proc.kill()

    def post(self, path: str, body: dict):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        return json.loads(urllib.request.urlopen(req, timeout=5).read() or b"{}")


class Router:
    """Forwards api.ai-vibes.ru to the mock; counts the calls; can override the status answer."""

    def __init__(self, mock: Mock):
        self.mock = mock
        self.calls: list[tuple[str, str]] = []
        self.status_override: dict | None = None
        self.order_token = ""

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin, "vary": "Origin",
                "access-control-allow-headers": "content-type, authorization, idempotency-key",
                "access-control-allow-methods": "POST, GET, OPTIONS"}
        path = request.url[len(API):]
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        self.calls.append((request.method, path.split("?")[0]))
        if path.startswith("/api/status") and self.status_override is not None:
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body=json.dumps(self.status_override))
        resp = route.fetch(url=f"http://127.0.0.1:{self.mock.port}{path}", headers=request.headers,
                           post_data=request.post_data_buffer)
        body = resp.body()
        if path.startswith("/api/orders") and resp.status == 200:
            try:
                self.order_token = json.loads(body).get("order_token", self.order_token)
            except ValueError:
                pass
        return route.fulfill(status=resp.status, headers={**cors, "content-type": "application/json"}, body=body)

    def count(self, method: str, prefix: str) -> int:
        return sum(1 for m, p in self.calls if m == method and p.startswith(prefix))


def set_files(page, names: list[str]):
    page.set_input_files('[data-idk="file"]', [
        {"name": n, "mimeType": "application/octet-stream", "buffer": (FIX / "text.pdf").read_bytes() if n.endswith(".pdf") else b"PK\x03\x04 test " + n.encode()}
        for n in names])


def fill_form(page, email=EMAIL, contact="", consent=True):
    page.fill('[data-idk="email"]', email)
    page.fill('[data-idk="contact"]', contact)
    box = page.locator('[data-idk="consent"]')
    if consent != box.is_checked():
        box.click()


def msg(page) -> str:
    return page.locator('[data-idk="message"]').inner_text().strip()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=str(DEFAULT_SHOTS))
    args = ap.parse_args(argv)
    shots = Path(args.shots)
    shots.mkdir(parents=True, exist_ok=True)

    src = (ROOT / "id-komplekt.html").read_text(encoding="utf-8")
    # --- а) static content ---
    check('<meta name="robots" content="noindex"' in src, "noindex until the launch")
    check(SHORT_TEXT in norm(src), "approved short text is on the page")
    price_text = norm(src)
    check("1 000 ₽" in price_text and not any(x in price_text for x in ("3 500", "6 000 ₽", "9 000", "100 ₽ за")),
          "landing: flat 1 000 RUB beta price, no old tiers")
    check(BETA_TEXT in price_text, "landing: the beta notice near the price")
    oferta = norm((ROOT / "oferta.html").read_text(encoding="utf-8"))
    s21 = oferta[oferta.index('21 Услуга'):]
    s21 = s21[:s21.index('22 Услуга VIP')] if '22 Услуга VIP' in s21 else s21  # s21 only, not the later sections
    check(BETA_RULE in s21 and "1 000 ₽ за комплект" in s21 and "3 500" not in s21 and "9 000" not in s21
          and "возвращает оплату" not in s21, "oferta s21: beta price and no-refund rule")
    check("Редакция 1.11 от 22.11.2026" in oferta, "oferta: edition of 22.11.2026 is kept in the edition history")
    check("href=\"/oferta.html#s21\"" in src and 'id="s21"' in (ROOT / "oferta.html").read_text(encoding="utf-8"),
          "the page links to oferta section 21 and it exists")
    # --- б) consent text equals the registry ---
    m = re.search(r'<span data-idk="consent-text">(.*?)</span>', src, re.S)
    page_consent = norm(m.group(1)) if m else ""
    reg = registry_statement()
    if reg is None:
        print("SKIP consent vs backend registry: backend repo not found", flush=True)
    else:
        check(page_consent == reg, "consent checkbox text equals the backend registry text (idk-v1-2026-11)")
    check("idk-v1-2026-11" in (ROOT / "idk.config.js").read_text(encoding="utf-8"), "consent version in the config")

    with Served(None) as served, Mock() as mock:
        base = served.base
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            router = Router(mock)
            ctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), router.handle)
            ctx.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net)/"), lambda r: r.abort())
            bank = []
            ctx.route(re.compile(r"^https://securepay\.tinkoff\.ru/"),
                      lambda r: (bank.append(r.request.url), r.fulfill(status=200, content_type="text/html", body="<html>bank</html>"))[1])
            errors: list[str] = []
            ctx.on("weberror", lambda e: errors.append(str(e.error)))
            page = ctx.new_page()
            page.on("console", lambda c: errors.append(c.text) if c.type == "error" and "Content Security" in c.text else None)
            page.goto(base + PAGE)
            page.wait_for_selector('[data-idk="form"]')

            # --- в) client checks, no API traffic ---
            before = len(router.calls)
            page.click('[data-idk="submit"]')
            check("файл" in msg(page).lower(), "no files -> a Russian hint")
            set_files(page, ["scan.exe"])
            check("не подходит" in msg(page) and page.locator(".idk-file").count() == 0, "bad extension is rejected with a message")
            set_files(page, ["ks2.xlsx"])
            page.click('[data-idk="submit"]')
            check("почт" in msg(page).lower(), "no email -> a hint")
            fill_form(page, email="not-an-email", consent=False)
            page.click('[data-idk="submit"]')
            check("почт" in msg(page).lower(), "invalid email -> a hint")
            fill_form(page, consent=False)
            page.click('[data-idk="submit"]')
            check("согласи" in msg(page).lower() or "оферт" in msg(page).lower(), "no consent -> a hint")
            fill_form(page, contact="<script>", consent=True)
            page.click('[data-idk="submit"]')
            check("контакт" in msg(page).lower(), "bad contact -> a hint")
            check(len(router.calls) == before, "client validation sends nothing to the API")
            limits = page.evaluate("""async () => {
              const m = await import('/idk-order.js?v=20261122-idk2');
              const mk = (n, size, i) => ({name: n, size, lastModified: i});
              const many = Array.from({length: 22}, (_, i) => mk('f' + i + '.pdf', 10, i));
              const r1 = m.checkNewFiles(many, []);
              const r2 = m.checkNewFiles([mk('big.zip', 150 * 1048576, 1), mk('big2.zip', 60 * 1048576, 2)], []);
              const r3 = m.checkNewFiles([mk('a.PDF', 5, 1), mk('a.PDF', 5, 1)], []);
              return {n1: r1.accepted.length, p1: r1.problems.length, n2: r2.accepted.length, p2: r2.problems.join(' '), n3: r3.accepted.length,
                      c1: m.contactProblem('Иван +7 (900) 000-00-00'), c2: m.contactProblem('a'), r: m.formatRubles(6400)};
            }""")
            check(limits["n1"] == 20 and limits["p1"] == 2, "more than 20 files: 20 accepted, the rest refused")
            check(limits["n2"] == 1 and "200" in limits["p2"], "total over 200 MB: the last file refused with the limit in the text")
            check(limits["n3"] == 1, "the same file added twice is kept once")
            check(limits["c1"] == "" and limits["c2"] != "" and "6\u00a0400\u00a0₽" == limits["r"], "contact rule and ruble format")

            # --- г) the whole flow ---
            fill_form(page, contact="Иван +7 900 000-00-00")
            set_files(page, ["act.pdf"])
            check(page.locator(".idk-file").count() == 2, "two files in the list")
            page.screenshot(path=str(shots / "01-form-filled-desktop.png"), full_page=True)
            page.click('[data-idk="submit"]')
            page.wait_for_selector('[data-idk="status"] .idk-ladder', timeout=8000)
            check(router.count("POST", "/api/orders") == 1 and router.count("POST", "/api/upload") == 2
                  and router.count("POST", "/api/idk/submit") == 1, "one order, two uploads (one per file), one submit")
            check(page.locator('[data-idk="form"]').is_hidden(), "the form gives way to the status view")
            check("IDK-" in page.locator('[data-idk="status"]').inner_text().upper(), "the order number is shown")
            check(page.locator(".idk-pay").count() == 0, "no pay button while the free analysis runs (queued)")
            page.screenshot(path=str(shots / "02-queued-desktop.png"), full_page=True)
            page.wait_for_selector(".idk-pay", timeout=12000)
            st = page.locator('[data-idk="status"]').inner_text()
            check("Акты освидетельствования скрытых работ" in st and "× 34" in st, "awaiting_payment: composition with counts")
            check("Паспорта и сертификаты на трубы ПНД" in st, "awaiting_payment: the missing list")
            check("1 000 ₽" in st or "1 000 ₽" in st, "awaiting_payment: the amount comes from the server")
            check(BETA_TEXT in norm(st), "awaiting_payment: the beta notice is shown before the pay button")
            check("Оплатить" in page.locator(".idk-pay").inner_text(), "the pay button")
            page.screenshot(path=str(shots / "03-awaiting-payment-desktop.png"), full_page=True)
            page.click(".idk-pay")
            page.wait_for_url(re.compile(r"securepay\.tinkoff\.ru"), timeout=5000)
            check(bool(bank), "the pay button goes to the allowed bank host")
            mock.post("/__mock/idk/pay", {"order_token": router.order_token})
            page.goto(base + PAGE)                      # the return from the bank: the stored token brings the status back
            page.wait_for_selector(".idk-ladder", timeout=8000)
            check(page.locator('[data-idk="form"]').is_hidden(), "e) a stored token restores the status after a reload")
            page.wait_for_selector(".idk-download", timeout=10000)
            link = page.locator(".idk-download").get_attribute("href") or ""
            check(re.fullmatch(r"https://api\.ai-vibes\.ru/k/[A-Za-z0-9_-]{32}", link) is not None, "delivered: the download link")
            dtxt = page.locator('[data-idk="status"]').inner_text()
            check("72 часа" in dtxt and "30 дней" in dtxt, "delivered: 72 h link and 30 days retention are stated")
            page.screenshot(path=str(shots / "04-delivered-desktop.png"), full_page=True)

            # --- д) hostile links ---
            quote = {"tier": "ks2", "acts_count": 3, "amount": 3500, "composition": [{"title": "АОСР", "count": 3}], "missing": []}
            router.status_override = {"stage": "awaiting_payment", "payment_url": "https://evil.example/pay", "quote": quote}
            page.goto(base + PAGE)
            page.wait_for_selector(".idk-quote", timeout=8000)
            check(page.locator(".idk-pay").count() == 0, "a foreign payment host renders no pay button")
            router.status_override = {"stage": "delivered", "download_url": "https://evil.example/k/" + "a" * 32, "quote": quote}
            page.goto(base + PAGE)
            page.wait_for_selector(".idk-again", timeout=8000)
            check(page.locator(".idk-download").count() == 0, "a foreign download host renders no link")
            # --- credit order (amount 0, no payment_url) and the owner price (10 RUB) ---
            cq = {"tier": "ks2", "acts_count": 3, "amount": 0, "credit": True, "composition": [{"title": "АОСР", "count": 3}], "missing": []}
            router.status_override = {"stage": "awaiting_payment", "credit": True, "quote": cq}
            page.goto(base + PAGE)
            page.wait_for_selector(".idk-continue", timeout=8000)
            ct = page.locator('[data-idk="status"]').inner_text()
            check("Оплата не нужна: за вами закреплён бесплатный заказ" in ct and page.locator(".idk-pay").count() == 0,
                  "credit: free-order message, no pay button")
            before = len(router.calls)
            page.click(".idk-continue")
            page.wait_for_timeout(500)
            check("securepay" not in page.url and len(router.calls) > before, "credit: the continue button stays off the bank and refreshes the status")
            router.status_override = {"stage": "awaiting_payment", "payment_url": "https://securepay.tinkoff.ru/new/x",
                                      "quote": {**cq, "amount": 10, "credit": False}}
            page.goto(base + PAGE)
            page.wait_for_selector(".idk-pay", timeout=8000)
            check("Оплатить 10 ₽" in page.locator(".idk-pay").inner_text(), "owner price: 10 RUB renders as «10 ₽»")
            router.status_override = None
            router.status_override = {"stage": "failed", "message": "По этим файлам комплект собрать не удалось."}
            page.goto(base + PAGE)
            page.wait_for_selector(".idk-again", timeout=8000)
            check("не удалось" in page.locator('[data-idk="message"]').inner_text(), "failed shows the server message")
            page.click(".idk-again")
            check(page.locator('[data-idk="form"]').is_visible(), "a new order returns to the form")
            router.status_override = None

            # --- ж) 390 px ---
            ctx.close()
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, device_scale_factor=2)
            mrouter = Router(mock)
            mctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), mrouter.handle)
            mctx.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net)/"), lambda r: r.abort())
            mpage = mctx.new_page()
            mpage.on("weberror", lambda e: errors.append(str(e.error)))
            mpage.goto(base + PAGE)
            mpage.wait_for_selector('[data-idk="form"]')
            mpage.screenshot(path=str(shots / "05-landing-390.png"), full_page=True)
            set_files(mpage, ["ks2.xlsx", "act.pdf"])
            fill_form(mpage)
            mpage.screenshot(path=str(shots / "06-form-filled-390.png"), full_page=True)
            mpage.click('[data-idk="submit"]')
            mpage.wait_for_selector(".idk-ladder", timeout=8000)
            mpage.screenshot(path=str(shots / "07-queued-390.png"), full_page=True)
            mpage.wait_for_selector(".idk-pay", timeout=12000)
            mpage.screenshot(path=str(shots / "08-awaiting-payment-390.png"), full_page=True)
            check(mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "390 px: no horizontal scroll")
            mock.post("/__mock/idk/pay", {"order_token": mrouter.order_token})
            mpage.wait_for_selector(".idk-download", timeout=20000)
            mpage.screenshot(path=str(shots / "09-delivered-390.png"), full_page=True)
            check(mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "390 px: no horizontal scroll when delivered")
            browser.close()
            check(not errors, f"no page errors, no CSP violations ({errors[:2]})")

    ok = sum(1 for r, _ in RESULTS if r)
    status = "ok" if ok == len(RESULTS) else "fail"
    print(f"IDK status={status} checks={ok}/{len(RESULTS)}")
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
