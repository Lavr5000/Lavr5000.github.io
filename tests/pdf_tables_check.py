#!/usr/bin/env python
"""«Таблицы из PDF» order dialog on the catalog (PLAN-7 Э7c). Playwright route-mock: no real API, no bank.

    python tests/pdf_tables_check.py [--shots DIR]

Serves the working tree on 127.0.0.1 (same helper as tests/v2_gate.py), intercepts every request to
https://api.ai-vibes.ru/** (CORS preflight included), the bank host and Metrika. Scenarios (brief E7c):
  а) status public -> the tile is there -> «Загрузить PDF» opens the dialog, the address does not change;
     no «200 МБ», no «бесплат»; the consent is the registered pdf-tables-v1-2026-10 text verbatim;
  б) a file without email/consent -> the hint, no /api/orders; invalid email -> no request either;
  в) file + email + consent -> exactly one POST /api/orders and one POST /api/upload, the check starts by
     itself; precheck pending -> no pay button; ok -> «Оплатить 499 ₽»; 429 daily_cap is shown; a foreign
     payment host never navigates; the allowed host is reached through POST /api/orders/pay; while locked
     Esc and the backdrop do not close the dialog; the token survives the bank round-trip;
     resume: a stored token opens the dialog by itself and walks queued -> parsing -> delivered;
     invalid_product -> «Сервис пока доступен по приглашению.»;
  г) precheck failed -> the server text, no pay button, «Выбрать другой файл» returns to the choice and a new
     file makes a new order;
  д) Esc closes the dialog and the focus goes back to the tile button;
  е) phone 375x812: the dialog fits, no horizontal scroll (screenshot);
  ж) /pdf-tables.html lands on /products.html#pdf-tables with the dialog open.
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

API = "https://api.ai-vibes.ru"
PAY_HOST = "pay.tbank-online.com"   # the host T-Bank hands out since 2026-10 (prod check 26.10)
PAGE = "/products.html"
PDF = Path(__file__).resolve().parent / "fixtures" / "text.pdf"
EMAIL = "check@example.com"
DLG = "#pt-dialog"
TILE_BTN = '[data-product="pdf-tables"] a[data-pt-open]'
PAY_BTN = f"{DLG} .pt-pay"
CONSENT_TEXT = ("Согласен с офертой и политикой обработки персональных данных. Листы загруженного PDF "
                "(изображения и извлечённые данные) будут переданы внешнему сервису распознавания OpenRouter "
                "только для формирования результата; файл и данные удаляются после доставки, при неуспешной "
                "обработке — не позднее 7 дней. Понимаю, что в Excel попадут только таблицы, прошедшие "
                "автоматическую проверку; если не прошла ни одна, оплата возвращается полностью. "
                "Подтверждаю, что вправе передавать этот документ.")
PENDING = {"stage": "awaiting_payment", "message": "", "payment_url": None,
           "precheck": "pending", "precheck_message": "Проверяем файл…"}
OK = {"stage": "awaiting_payment", "message": "", "payment_url": None,
      "precheck": "ok", "precheck_message": "Файл подходит. Можно оплатить.", "can_pay": True}
RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    return bool(ok)


class Api:
    """Scripted stand-in for api.ai-vibes.ru."""

    def __init__(self):
        self.order_posts = []
        self.upload_posts = 0
        self.pay_posts = 0
        self.status_calls = 0
        self.status_script = [PENDING]     # the last body repeats
        self.pay_body = {"payment_url": f"https://{PAY_HOST}/new/abc"}
        self.order_error = None

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin,
                "access-control-allow-headers": "content-type, authorization",
                "access-control-allow-methods": "POST, GET, OPTIONS", "vary": "Origin"}
        url = request.url

        def js(body, status=200):
            return route.fulfill(status=status, headers=cors, content_type="application/json", body=json.dumps(body))

        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "GET" and url.startswith(f"{API}/api/products/status"):
            return js({"pdf_tables": "public"})
        if request.method == "POST" and url.startswith(f"{API}/api/orders/pay"):
            self.pay_posts += 1
            if self.pay_body.get("_status"):
                return js(self.pay_body["_json"], self.pay_body["_status"])
            return js(self.pay_body)
        if request.method == "POST" and url.startswith(f"{API}/api/orders"):
            self.order_posts.append(json.loads(request.post_data or "{}"))
            if self.order_error:
                return js(self.order_error[1], self.order_error[0])
            n = len(self.order_posts)
            return js({"order_id": f"pt{n:026d}", "order_token": "order_TEST", "upload_token": "upload_TEST",
                       "payment_required": True, "payment_stage": "after_check"})
        if request.method == "POST" and url.startswith(f"{API}/api/upload"):
            self.upload_posts += 1
            return js({"ok": True})
        if request.method == "GET" and url.startswith(f"{API}/api/status"):
            self.status_calls += 1
            return js(self.status_script[min(self.status_calls - 1, len(self.status_script) - 1)])
        return js({"error": "not_found"}, 404)

    def reset(self, script):
        self.status_calls = 0
        self.status_script = script


def message(page) -> str:
    return page.locator(f"{DLG} [data-pt=message]").inner_text().strip()


def dlg_open(page) -> bool:
    return page.evaluate(f"() => document.querySelector('{DLG}').open")


def open_from_tile(page, base):
    page.goto(base + PAGE)
    page.wait_for_selector(TILE_BTN, timeout=8000)
    page.click(TILE_BTN)
    page.wait_for_function(f"() => document.querySelector('{DLG}').open", timeout=4000)


def fill(page, email=EMAIL, consent=True):
    page.set_input_files(f"{DLG} [data-pt=file]", str(PDF))
    page.fill(f"{DLG} [data-pt=email]", email)
    if consent:
        page.check(f"{DLG} [data-pt=consent]")


def wait_bad(page):
    page.wait_for_function(f"() => document.querySelector('{DLG} [data-pt=message]').dataset.state === 'bad'",
                           timeout=15000)


def no_hscroll(page) -> bool:
    return page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=None)
    args = ap.parse_args()
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    def shot(page, name):
        if shots:
            page.screenshot(path=str(shots / name))

    with Served(None) as served:
        base = served.base
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            api = Api()
            ctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), api.handle)
            ctx.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net)/"), lambda r: r.abort())
            bank_hits = []
            ctx.route(re.compile(rf"^https://{re.escape(PAY_HOST)}/"),
                      lambda r: (bank_hits.append(r.request.url),
                                 r.fulfill(status=200, content_type="text/html", body="<html>bank</html>"))[1])
            errors = []
            ctx.on("weberror", lambda e: errors.append(str(e.error)))

            # --- а) the tile opens the dialog, the address stays ---
            page = ctx.new_page()
            page.goto(base + PAGE)
            page.wait_for_selector(TILE_BTN, timeout=8000)
            url_before = page.url
            check(not dlg_open(page), "а: dialog closed on a plain catalog visit")
            page.click(TILE_BTN)
            settle(page, 300)
            check(dlg_open(page), "а: tile button opens the dialog")
            check(page.url == url_before, f"а: address unchanged ({page.url})")
            text = page.locator(DLG).inner_text()
            check("200 МБ" not in text and "бесплат" not in text.lower(), "а: no «200 МБ», no «бесплат»")
            check("PDF до 25 листов, один файл" in text and "499 ₽" in text, "а: requirements and price shown")
            consent = re.sub(r"\s+", " ", page.locator(f"{DLG} .dlg-consent span").inner_text()).strip()
            check(consent == CONSENT_TEXT, "а: consent text verbatim")
            links = set(page.eval_on_selector_all(f"{DLG} .dlg-consent a", "els => els.map(e => e.getAttribute('href'))"))
            check(links == {"oferta.html", "privacy.html"}, f"а: consent links ({links})")
            check(page.locator(PAY_BTN).count() == 0, "а: no pay button before the check")
            check(page.evaluate("() => getComputedStyle(document.documentElement).overflow === 'hidden'"),
                  "а: catalog scroll locked under the dialog")
            shot(page, "01-dialog-open.png")

            # --- б) file without email / consent -> hint, no request ---
            page.set_input_files(f"{DLG} [data-pt=file]", str(PDF))
            settle(page, 200)
            check("Укажите почту и отметьте согласие" in message(page), f"б: hint without email ({message(page)!r})")
            page.fill(f"{DLG} [data-pt=email]", "bad-email")
            page.check(f"{DLG} [data-pt=consent]")
            settle(page, 300)
            check(not api.order_posts, "б: no /api/orders without a valid email")
            page.uncheck(f"{DLG} [data-pt=consent]")
            page.fill(f"{DLG} [data-pt=email]", EMAIL)
            settle(page, 300)
            check(not api.order_posts, "б: no /api/orders without consent")
            shot(page, "02-hint.png")

            # --- в) invalid_product at creation ---
            api.order_error = (400, {"error_code": "invalid_product", "message": "Неизвестный продукт."})
            page.check(f"{DLG} [data-pt=consent]")
            wait_bad(page)
            check(message(page) == "Сервис пока доступен по приглашению.", f"в: invalid_product text ({message(page)!r})")
            body = api.order_posts[0] if api.order_posts else {}
            check(len(api.order_posts) == 1 and body.get("product") == "pdf-tables"
                  and body.get("consent_version") == "pdf-tables-v1-2026-10" and body.get("email") == EMAIL
                  and body.get("website") == "", f"в: order body ({body})")
            check(api.upload_posts == 0, "в: no upload after a refused order")
            page.close()

            # --- в) auto start: one order, one upload, pending -> ok -> pay ---
            api.order_error = None
            api.order_posts.clear()
            api.reset([PENDING, OK])
            page = ctx.new_page()
            open_from_tile(page, base)
            fill(page)
            page.wait_for_selector(f"{DLG} .pt-ladder", timeout=8000)
            check("Проверяем файл" in page.locator(f"{DLG} [data-pt=status]").inner_text(), "в: pending ladder shown")
            check(page.locator(PAY_BTN).count() == 0, "в: pending -> no pay button")
            # the same file again must not make a second order
            page.dispatch_event(f"{DLG} [data-pt=email]", "change")
            page.dispatch_event(f"{DLG} [data-pt=consent]", "change")
            page.wait_for_selector(PAY_BTN, timeout=15000)
            check(len(api.order_posts) == 1 and api.upload_posts == 1,
                  f"в: exactly one order and one upload ({len(api.order_posts)}/{api.upload_posts})")
            check(page.locator(PAY_BTN).inner_text().strip() == "Оплатить 499 ₽", "в: ok -> «Оплатить 499 ₽»")
            check(page.locator(f"{DLG} .pt-ladder li.on").count() == 2, "в: ladder at the pay step")
            shot(page, "03-pay-ready.png")

            api.pay_body = {"_status": 429, "_json": {"error_code": "daily_cap",
                                                      "message": "Сегодня лимит заказов исчерпан. Попробуйте завтра."}}
            page.click(PAY_BTN)
            wait_bad(page)
            check("лимит заказов исчерпан" in message(page), "в: daily_cap text shown")
            check(page.locator(PAY_BTN).is_enabled(), "в: pay button enabled again")
            check(not page.evaluate(f"() => document.querySelector('{DLG}').dataset.locked"), "в: unlocked after error")

            api.pay_body = {"payment_url": "https://example.test/pay"}
            page.click(PAY_BTN)
            settle(page, 500)
            check("недоступна" in message(page), "в: foreign payment host refused")
            check(not bank_hits and page.url.startswith(base + PAGE), "в: no navigation to a foreign host")

            # locked: Esc and the backdrop do nothing
            page.evaluate(f"() => {{ document.querySelector('{DLG}').dataset.locked = '1'; }}")
            page.keyboard.press("Escape")
            page.mouse.click(5, 5)
            settle(page, 200)
            check(dlg_open(page), "в: locked dialog survives Esc and a backdrop click")
            page.evaluate(f"() => {{ delete document.querySelector('{DLG}').dataset.locked; }}")

            api.pay_body = {"payment_url": f"https://{PAY_HOST}/new/pt1"}
            pay_before = api.pay_posts
            page.click(PAY_BTN)
            page.wait_for_url(re.compile(re.escape(PAY_HOST)), timeout=8000)
            check(api.pay_posts == pay_before + 1 and bool(bank_hits), f"в: POST /api/orders/pay -> bank ({bank_hits})")
            page.go_back()
            settle(page, 500)
            check(page.evaluate("() => sessionStorage.getItem('av-pt:order-token')") == "order_TEST",
                  "в: order token kept for the return from the bank")

            # resume: the stored token opens the dialog by itself
            api.reset([{"stage": "queued", "message": "Оплата получена, файл в обработке."},
                       {"stage": "parsing", "message": "Извлекаем таблицы."},
                       {"stage": "delivered", "message": "Таблицы отправлены на вашу почту."}])
            page.goto(base + PAGE)
            page.wait_for_function(f"() => document.querySelectorAll('{DLG} .pt-ladder li.on').length === 3",
                                   timeout=8000)
            check(dlg_open(page), "в: resume opens the dialog by itself")
            page.wait_for_function(f"() => document.querySelectorAll('{DLG} .pt-ladder li.on').length === 4",
                                   timeout=15000)
            check("Таблицы отправлены" in message(page), "в: delivered text on resume")
            check(page.evaluate("() => sessionStorage.getItem('av-pt:order-token')") is None, "в: token cleared")
            page.close()

            # --- г) precheck failed -> reason, no pay, another file -> new order ---
            api.order_posts.clear()
            api.reset([{"stage": "awaiting_payment", "message": "", "payment_url": None, "precheck": "failed",
                        "precheck_message": "В файле больше 25 листов. Разделите его на части до 25 листов."}])
            page = ctx.new_page()
            open_from_tile(page, base)
            fill(page)
            wait_bad(page)
            check("больше 25 листов" in message(page), "г: server reason shown")
            check(page.locator(PAY_BTN).count() == 0, "г: no pay button")
            shot(page, "04-precheck-failed.png")
            page.click(f"{DLG} .pt-again")
            settle(page, 200)
            check(page.locator(f"{DLG} [data-pt=file]").is_enabled()
                  and page.evaluate(f"() => document.querySelector('{DLG} [data-pt=file]').files.length") == 0
                  and page.locator(f"{DLG} .pt-ladder").count() == 0, "г: «Выбрать другой файл» back to the choice")
            api.reset([PENDING])
            page.set_input_files(f"{DLG} [data-pt=file]", str(PDF))
            page.wait_for_selector(f"{DLG} .pt-ladder", timeout=8000)
            check(len(api.order_posts) == 2, f"г: a new file makes a new order ({len(api.order_posts)})")
            page.close()

            # --- д) Esc closes, focus back on the tile button ---
            page = ctx.new_page()
            open_from_tile(page, base)
            page.keyboard.press("Escape")
            settle(page, 200)
            check(not dlg_open(page), "д: Esc closes the dialog")
            check(page.evaluate("() => !!document.activeElement && document.activeElement.matches("
                                "'[data-product=\"pdf-tables\"] a[data-pt-open]')"), "д: focus back on the tile button")
            page.close()

            # --- ж) the old page forwards into the dialog ---
            page = ctx.new_page()
            page.goto(base + "/pdf-tables.html")
            page.wait_for_url(re.compile(r"/products\.html#pdf-tables$"), timeout=8000)
            page.wait_for_function(f"() => document.querySelector('{DLG}').open", timeout=4000)
            check(dlg_open(page), "ж: /pdf-tables.html -> /products.html#pdf-tables with the dialog open")
            page.close()
            ctx.close()

            # --- е) phone 375x812 ---
            mctx = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
            mctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), api.handle)
            mctx.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net)/"), lambda r: r.abort())
            mctx.on("weberror", lambda e: errors.append(str(e.error)))
            page = mctx.new_page()
            open_from_tile(page, base)
            rect = page.evaluate(f"() => {{ const r = document.querySelector('{DLG}').getBoundingClientRect();"
                                 " return [r.left, r.right, window.innerWidth]; }")
            check(rect[0] >= 8 and rect[1] <= rect[2] - 8, f"е: dialog inside the phone width ({rect})")
            check(no_hscroll(page), "е: no horizontal scroll at 375")
            shot(page, "05-phone-375.png")
            fill(page)
            page.wait_for_selector(f"{DLG} .pt-ladder", timeout=8000)
            check(no_hscroll(page), "е: no horizontal scroll with the ladder")
            shot(page, "06-phone-checking.png")
            mctx.close()

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
