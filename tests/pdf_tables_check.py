#!/usr/bin/env python
"""pdf-tables order page gate (PLAN-7 Э7). Playwright route-mock, no real API and no bank is ever called.

    python tests/pdf_tables_check.py [--shots DIR]

Serves the working tree on 127.0.0.1 (same helper as tests/v2_gate.py) and intercepts every request to
https://api.ai-vibes.ru/** (CORS preflight included) plus the bank host. Checks:
  * markup: the consent checkbox carries the registered pdf-tables-v1-2026-10 statement verbatim
    (links and bold stripped); the page links oferta.html and privacy.html;
  * negative: submit without consent / email / file is refused locally (no API request);
  * order creation sends product=pdf-tables, consent_version=pdf-tables-v1-2026-10, email, website="";
    400 invalid_product -> "Сервис пока доступен по приглашению." (no upload follows);
  * flow pending -> ok: status pending shows "Проверяем файл…", ok shows the "Оплатить 499 ₽" button;
  * pay: POST /api/orders/pay (same bearer as status) -> navigation to the allowed pay host is caught
    by interception; sessionStorage keeps the order token for the resume; 429 daily_cap message is
    shown and the button is re-enabled; a payment_url on a foreign host never navigates;
  * flow failed: precheck failed shows precheck_message, no pay button;
  * resume: a saved token restores the processing ladder (queued/parsing) and lands on delivered;
    stage failed shows the refund text.
Last line: PT status=ok|fail checks=<n>/<n>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, settle  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.ai-vibes.ru"
PAY_HOST = "pay.tbank.ru"
PAGE = "/pdf-tables.html"
PDF = Path(__file__).resolve().parent / "fixtures" / "text.pdf"
EMAIL = "check@example.com"
CONSENT_TEXT = ("Согласен с офертой и политикой обработки персональных данных. Листы загруженного PDF "
                "(изображения и извлечённые данные) будут переданы внешнему сервису распознавания OpenRouter "
                "только для формирования результата; файл и данные удаляются после доставки, при неуспешной "
                "обработке — не позднее 7 дней. Понимаю, что в Excel попадут только таблицы, прошедшие "
                "автоматическую проверку; если не прошла ни одна, оплата возвращается полностью. "
                "Подтверждаю, что вправе передавать этот документ.")

ORDERS = {  # script per scenario: list of (error_code|None, body) for POST /api/orders
}
PAY_RESPONSES = {}
STATUS_SCRIPTS = {}
RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    return bool(ok)


class Api:
    """Scripted stand-in for api.ai-vibes.ru, keyed by a scenario tag the test sets per page."""

    def __init__(self):
        self.order_posts = []
        self.pay_posts = 0
        self.status_calls = 0
        self.status_script = []           # list of status bodies; the last one repeats
        self.pay_body = {"payment_url": f"https://{PAY_HOST}/new/abc"}
        self.order_error = None
        self.navigations = []

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin,
                "access-control-allow-headers": "content-type, authorization",
                "access-control-allow-methods": "POST, GET, OPTIONS", "vary": "Origin"}
        url = request.url
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "POST" and url.startswith(f"{API}/api/orders"):
            if not url.endswith("/pay"):
                body = json.loads(request.post_data or "{}")
                self.order_posts.append({"headers": request.headers, "body": body})
                if self.order_error:
                    return route.fulfill(status=self.order_error[0], headers=cors,
                                         content_type="application/json",
                                         body=json.dumps(self.order_error[1]))
                oid = "pt" + "0" * 26
                return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps({
                    "order_id": oid, "order_token": "order_TEST", "upload_token": "upload_TEST",
                    "payment_required": True, "payment_stage": "after_check"}))
            self.pay_posts += 1
            if isinstance(self.pay_body, dict) and self.pay_body.get("_status"):
                return route.fulfill(status=self.pay_body["_status"], headers=cors,
                                     content_type="application/json",
                                     body=json.dumps(self.pay_body["_json"]))
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body=json.dumps(self.pay_body))
        if request.method == "POST" and url.startswith(f"{API}/api/upload"):
            return route.fulfill(status=200, headers=cors, content_type="application/json", body='{"ok": true}')
        if request.method == "GET" and url.startswith(f"{API}/api/status"):
            self.status_calls += 1
            body = self.status_script[min(self.status_calls - 1, len(self.status_script) - 1)]
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(body))
        return route.fulfill(status=404, headers=cors, content_type="application/json", body='{"error":"not_found"}')


def notice(page) -> str:
    return page.locator("#message").inner_text().strip()


def consent_dom_text(page) -> str:
    return re.sub(r"\s+", " ", page.locator("label.check span").first.inner_text()).strip()


def fill_and_submit(page):
    page.set_input_files("#file", str(PDF))
    page.fill("#email", EMAIL)
    page.check("#consent")
    page.click("#submitBtn")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=None)
    args = ap.parse_args()
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    with Served(None) as served:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            api = Api()
            ctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), api.handle)
            bank_hits = []
            ctx.route(re.compile(rf"^https://{re.escape(PAY_HOST)}/"),
                      lambda r: (bank_hits.append(r.request.url), r.fulfill(status=200, content_type="text/html",
                                                                             body="<html>bank</html>"))[1])
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(served.base + PAGE)
            settle(page)

            # --- markup: consent text verbatim, legal links present ---
            check(consent_dom_text(page) == CONSENT_TEXT, "consent text verbatim")
            links = {h for h in page.eval_on_selector_all("label.check a", "els => els.map(e => e.getAttribute('href'))")}
            check(links == {"oferta.html", "privacy.html"}, f"consent links oferta+privacy ({links})")
            check(page.locator("button.pay").count() == 0, "no pay button before submit")

            if shots:
                page.screenshot(path=str(shots / "01-initial.png"), full_page=True)

            # --- negative: no consent / no email / no file -> local refusal, no API call ---
            page.set_input_files("#file", str(PDF))
            page.fill("#email", EMAIL)
            page.click("#submitBtn")
            settle(page, 200)
            check("согласие" in notice(page), "consent required locally")
            page.check("#consent")
            page.fill("#email", "bad-email")
            page.click("#submitBtn")
            settle(page, 200)
            check("email" in notice(page), "email validated locally")
            check(not api.order_posts, "no /api/orders from local refusals")

            # --- invalid_product at creation ---
            api.order_error = (400, {"error_code": "invalid_product", "message": "Неизвестный продукт."})
            fill_and_submit(page)
            settle(page, 400)
            check(notice(page) == "Сервис пока доступен по приглашению.", f"invalid_product message ({notice(page)!r})")
            check(len(api.order_posts) == 1 and api.order_posts[0]["body"]["product"] == "pdf-tables"
                  and api.order_posts[0]["body"]["consent_version"] == "pdf-tables-v1-2026-10"
                  and api.order_posts[0]["body"]["website"] == "", "order body product/consent/website")
            api.order_error = None

            # --- pending -> ok -> pay (allowed host, navigation caught) ---
            api.status_script = [
                {"stage": "awaiting_payment", "message": "", "payment_url": None,
                 "precheck": "pending", "precheck_message": "Проверяем файл…"},
                {"stage": "awaiting_payment", "message": "", "payment_url": None,
                 "precheck": "ok", "precheck_message": "Файл подходит. Можно оплатить.", "can_pay": True},
            ]
            page.click("#submitBtn")
            page.wait_for_selector("#status .line", timeout=8000)
            check("Проверяем файл" in page.locator("#status").inner_text(), "pending ladder shown")
            check("Проверяем файл…" in notice(page), "pending message shown")
            page.wait_for_selector("button.pay", timeout=15000)
            check(page.locator("button.pay").inner_text().strip() == "Оплатить 499 ₽", "pay button text 499")
            check(page.locator("#status .line.on").count() == 2, "ladder at pay step")
            if shots:
                page.screenshot(path=str(shots / "02-pay-ready.png"), full_page=True)

            # pay error first: 429 daily_cap message, button re-enabled
            api.pay_body = {"_status": 429, "_json": {"error_code": "daily_cap",
                                                      "message": "Сегодня лимит заказов исчерпан. Попробуйте завтра."}}
            page.click("button.pay")
            settle(page, 400)
            check("лимит заказов исчерпан" in notice(page), "daily_cap message shown")
            check(page.locator("button.pay").is_enabled(), "pay button re-enabled after error")

            # foreign host: no navigation
            api.pay_body = {"payment_url": "https://example.test/pay"}
            page.click("button.pay")
            settle(page, 400)
            check("недоступна" in notice(page), "foreign payment host refused")
            check(not bank_hits and page.url.endswith(PAGE), "no navigation on foreign host")

            # allowed host: navigation caught by interception
            api.pay_body = {"payment_url": f"https://{PAY_HOST}/new/pt1"}
            page.click("button.pay")
            page.wait_for_url(re.compile(re.escape(PAY_HOST)), timeout=8000)
            check(bool(bank_hits), f"navigated to allowed pay host ({bank_hits})")
            # back from the bank: the site origin still holds the saved order token
            page.go_back()
            settle(page, 500)
            check(page.evaluate("() => sessionStorage.getItem('av-pt:order-token')") == "order_TEST",
                  "order token kept in sessionStorage")

            # --- resume: saved token, queued -> parsing -> delivered ---
            page.goto(served.base + PAGE)
            page.evaluate("() => sessionStorage.setItem('av-pt:order-token', 'order_TEST')")
            api.status_calls = 0
            api.status_script = [
                {"stage": "queued", "message": "Оплата получена, файл в обработке.", "queue_position": 2},
                {"stage": "parsing", "message": "Извлекаем таблицы."},
                {"stage": "delivered", "message": "Таблицы отправлены на вашу почту."},
            ]
            page.reload()
            page.wait_for_selector("#status .queue-info", timeout=15000)
            check("Перед вами в очереди: 2 документа" in page.locator("#status").inner_text(), "queue info shown")
            check(page.evaluate("() => document.querySelectorAll('#status .line.on').length") == 3,
                  "resume processing ladder (3 steps on)")
            page.wait_for_function(
                "() => document.querySelectorAll('#status .line.on').length === 4", timeout=15000)
            check("Таблицы отправлены" in notice(page), "delivered message on resume")
            check(page.evaluate("() => sessionStorage.getItem('av-pt:order-token')") is None,
                  "token cleared after delivered")

            # --- resume into a refund: stage failed keeps the reason text ---
            page2 = ctx.new_page()
            page2.goto(served.base + PAGE)
            page2.evaluate("() => sessionStorage.setItem('av-pt:order-token', 'order_TEST')")
            api.status_script = [{"stage": "failed",
                                  "message": "Ни одна таблица файла не прошла проверку — деньги возвращены на карту.",
                                  "precheck": "ok", "precheck_message": "Файл подходит. Можно оплатить."}]
            api.status_calls = 0
            page2.reload()
            page2.wait_for_function("() => document.querySelector('#message').classList.contains('bad')", timeout=15000)
            check("возвращены" in notice(page2), "refund text shown on failed")
            check(page2.locator("button.pay").count() == 0, "no pay button on failed resume")

            # --- precheck failed from a fresh order ---
            page3 = ctx.new_page()
            page3.goto(served.base + PAGE)
            api.status_calls = 0
            api.status_script = [{"stage": "awaiting_payment", "message": "", "payment_url": None,
                                  "precheck": "failed",
                                  "precheck_message": "В файле больше 25 листов. Разделите его на части до 25 листов."}]
            fill_and_submit(page3)
            page3.wait_for_function("() => document.querySelector('#message').classList.contains('bad')", timeout=15000)
            check("больше 25 листов" in notice(page3), "precheck failed message shown")
            check(page3.locator("button.pay").count() == 0, "no pay button after failed precheck")
            check(page3.locator("#submitBtn").is_enabled(), "submit re-enabled after failed precheck")
            if shots:
                page3.screenshot(path=str(shots / "03-precheck-failed.png"), full_page=True)

            check(not errors, f"no page errors ({errors})")
            browser.close()

    ok = all(r for r, _ in RESULTS)
    print(("PT status=ok " if ok else "PT status=fail ") + f"checks={sum(1 for r, _ in RESULTS if r)}/{len(RESULTS)}")
    for r, name in RESULTS:
        if not r:
            print(f"FAIL {name}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
