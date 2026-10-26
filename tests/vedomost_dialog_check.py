#!/usr/bin/env python
"""«Ведомость материалов из РД» order dialog on the catalog (PO 26.10 Р-4). Playwright route-mock: no real API, no bank.

    python tests/vedomost_dialog_check.py [--shots DIR]

Serves the working tree on 127.0.0.1 (same helper as tests/v2_gate.py), intercepts every request to
https://api.ai-vibes.ru/** (CORS preflight included), the bank host and Metrika. Scenarios:
  а) «Загрузить PDF» on the 990 ₽ tile opens #vd-dialog, the address does not change; requirements and price
     shown; both consent texts (vedomost-v3-2026-10 and the optional 90-day storage) verbatim; no long dash
     outside the consent texts; the catalog does not scroll under the dialog; no pay link before the order;
  б) no consent -> the consent error and no /api/orders; a bad email -> «Укажите корректный email.», no request;
  в) file + email + consent + «Отправить заказ» -> exactly one POST /api/orders (consent_version
     vedomost-v3-2026-10, no product field) and one POST /api/upload; awaiting_payment with an allowed bank
     host -> the pay link; clicking it locks the dialog (Esc and the backdrop do nothing) and keeps the token;
     the bank is reached; back on the catalog the stored token opens the dialog by itself, the status walks
     queued -> delivered and the token is dropped; a foreign payment host shows no link;
  г) failed -> the server text in the error state, «Отправить заказ» usable again;
  д) Esc closes the dialog and the focus goes back to the tile button;
  е) phone 375x812: the dialog fits, no horizontal scroll (screenshot);
  ж) /vedomost.html lands on /products.html#vedomost with the dialog open;
  з) the shared engine still serves /nakladnaya.html: one POST /api/orders with product nakladnaya-m15.
Last line: VD status=ok|fail checks=<n>/<n>
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
PAY_HOST = "securepay.tinkoff.ru"
PAGE = "/products.html"
PDF = Path(__file__).resolve().parent / "fixtures" / "text.pdf"
EMAIL = "check@example.com"
DLG = "#vd-dialog"
TILE_BTN = '[data-product="material-takeoff"] a[data-vd-open]'
PAY_LINK = f"{DLG} a.pay"
STORE_KEY = "av-vd:order-token"
CONSENT_TEXT = ("Согласен с офертой и политикой обработки персональных данных. Если файл нельзя разобрать по "
                "текстовому слою, листы документа (изображения и извлечённые данные) будут переданы внешнему "
                "сервису распознавания OpenRouter (любой из доступных через него моделей) только для формирования "
                "результата; файл и данные удаляются после доставки, при неуспешной обработке — не позднее 7 дней. "
                "Подтверждаю, что вправе передавать этот документ.")
OPTIN_TEXT = ("Разрешаю хранение файла до 90 дней для разбора спорных случаев по моей оценке (необязательно, "
              "можно отозвать — см. политику).")
PAY_URL = f"https://{PAY_HOST}/new/vd-abc"
AWAIT = {"stage": "awaiting_payment", "message": "", "payment_url": PAY_URL}
RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    return bool(ok)


class Api:
    """Scripted stand-in for api.ai-vibes.ru."""

    def __init__(self):
        self.order_posts = []
        self.upload_posts = 0
        self.status_calls = 0
        self.status_script = [AWAIT]     # the last body repeats

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
        if request.method == "POST" and url.startswith(f"{API}/api/orders"):
            self.order_posts.append(json.loads(request.post_data or "{}"))
            n = len(self.order_posts)
            return js({"order_id": f"vd{n:026d}", "order_token": "order_VD", "upload_token": "upload_VD",
                       "payment_required": True})
        if request.method == "POST" and url.startswith(f"{API}/api/upload"):
            self.upload_posts += 1
            return js({"ok": True})
        if request.method == "GET" and url.startswith(f"{API}/api/status"):
            self.status_calls += 1
            return js(self.status_script[min(self.status_calls - 1, len(self.status_script) - 1)])
        return js({"error": "not_found"}, 404)

    def reset(self, script):
        self.order_posts = []
        self.upload_posts = 0
        self.status_calls = 0
        self.status_script = script


def message(page) -> str:
    return page.locator(f"{DLG} #message").inner_text().strip()


def dlg_open(page) -> bool:
    return page.evaluate(f"() => document.querySelector('{DLG}').open")


def open_from_tile(page, base):
    page.goto(base + PAGE)
    page.wait_for_selector(TILE_BTN, timeout=8000)
    page.click(TILE_BTN)
    page.wait_for_function(f"() => document.querySelector('{DLG}').open", timeout=4000)


def fill(page, email=EMAIL, consent=True):
    page.set_input_files(f"{DLG} #file", str(PDF))
    page.fill(f"{DLG} #email", email)
    if consent:
        page.check(f"{DLG} #consent")


def flat(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def stored(page):
    return page.evaluate(f"() => sessionStorage.getItem('{STORE_KEY}')")


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
            ctx.route(re.compile(r"^https://evil\.example/"), lambda r: r.abort())
            errors = []
            ctx.on("weberror", lambda e: errors.append(str(e.error)))
            console_errors = []

            # --- а) the tile opens the dialog, the address stays ---
            page = ctx.new_page()
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.goto(base + PAGE)
            page.wait_for_selector(TILE_BTN, timeout=8000)
            url_before = page.url
            check(not dlg_open(page), "а: dialog closed on a plain catalog visit")
            page.click(TILE_BTN)
            settle(page, 300)
            check(dlg_open(page), "а: tile button opens the dialog")
            check(page.url == url_before, f"а: address unchanged ({page.url})")
            text = page.locator(DLG).inner_text()
            check("Ведомость материалов из РД" in text and "990 ₽" in text, "а: title and price shown")
            check("Один файл до 200 МБ" in text and "векторный, скан или смешанный" in text, "а: requirements shown")
            consents = [flat(t) for t in page.locator(f"{DLG} .dlg-consent span").all_inner_texts()]
            check(consents == [CONSENT_TEXT, OPTIN_TEXT], "а: both consent texts verbatim")
            links = page.eval_on_selector_all(f"{DLG} .dlg-consent a", "els => els.map(e => e.getAttribute('href'))")
            check(links == ["oferta.html", "privacy.html", "privacy.html"], f"а: consent links ({links})")
            rest = text
            for c in page.locator(f"{DLG} .dlg-consent span").all_inner_texts():
                rest = rest.replace(c, "")
            check("—" not in rest, "а: no long dash outside the consent texts")
            check(not page.is_checked(f"{DLG} #optin"), "а: the 90-day storage stays off by default")
            check(page.locator(PAY_LINK).count() == 0, "а: no pay link before the order")
            check(page.evaluate("() => getComputedStyle(document.documentElement).overflow === 'hidden'"),
                  "а: catalog scroll locked under the dialog")
            shot(page, "01-dialog-open.png")

            # --- б) no consent / bad email -> message, no request ---
            fill(page, consent=False)
            page.click(f"{DLG} #submitBtn")
            settle(page, 300)
            check(message(page) == "Нужно подтвердить согласие с офертой и политикой.", f"б: consent error ({message(page)!r})")
            check("bad" in page.get_attribute(f"{DLG} #message", "class"), "б: error state")
            page.fill(f"{DLG} #email", "bad-email")
            page.check(f"{DLG} #consent")
            page.click(f"{DLG} #submitBtn")
            settle(page, 300)
            check(message(page) == "Укажите корректный email.", f"б: bad email ({message(page)!r})")
            check(len(api.order_posts) == 0, "б: no /api/orders without consent or with a bad email")

            # --- в) one order, pay link, lock, bank, resume ---
            api.reset([AWAIT])
            page.fill(f"{DLG} #email", EMAIL)
            page.click(f"{DLG} #submitBtn")
            page.wait_for_selector(PAY_LINK, timeout=15000)
            check(len(api.order_posts) == 1 and api.upload_posts == 1, "в: one POST /api/orders and one /api/upload")
            body = api.order_posts[0] if api.order_posts else {}
            check(body.get("consent_version") == "vedomost-v3-2026-10" and "product" not in body
                  and body.get("email") == EMAIL and body.get("optin_extended_retention") is False,
                  f"в: order body ({body})")
            link = page.locator(PAY_LINK)
            check(link.get_attribute("href") == PAY_URL and link.inner_text().strip() == "Оплатить картой или через СБП",
                  "в: pay link to the allowed bank host")
            settle(page, 400)
            pb = page.locator(PAY_LINK).bounding_box()
            check(pb is not None and pb["y"] >= 0 and pb["y"] + pb["height"] <= 900, f"в: pay link scrolled into view ({pb})")
            shot(page, "02-pay-link.png")
            # the first click is held on the page: the dialog must lock and keep the token
            page.evaluate(f"() => document.querySelector('{PAY_LINK}').addEventListener('click', e => e.preventDefault(), {{ once: true }})")
            page.click(PAY_LINK)
            settle(page, 200)
            check(page.get_attribute(DLG, "data-locked") == "1", "в: dialog locked while going to the bank")
            check(stored(page) == "order_VD", "в: order token kept for the return from the bank")
            page.keyboard.press("Escape")
            settle(page, 200)
            check(dlg_open(page), "в: Esc does not close the locked dialog")
            page.mouse.click(5, 5)
            settle(page, 200)
            check(dlg_open(page), "в: backdrop click does not close the locked dialog")
            page.click(f"{DLG} .dlg-close")
            settle(page, 200)
            check(dlg_open(page), "в: close button does not close the locked dialog")
            api.reset([{"stage": "queued", "message": "Оплата получена."}, {"stage": "delivered", "message": "Готово.", "can_rate": True}])
            page.click(PAY_LINK)
            page.wait_for_url(re.compile(re.escape(PAY_HOST)), timeout=8000)
            check(len(bank_hits) == 1, "в: the bank page is reached")
            page.goto(base + PAGE)          # the bank sends the user back to the catalog in the same tab
            page.wait_for_function(f"() => document.querySelector('{DLG}').open", timeout=6000)
            check(True, "в: stored token opens the dialog by itself")
            check(page.get_attribute(DLG, "data-locked") is None, "в: dialog not locked after the return")
            # every stage label is listed from the start: wait for the last line to be the active one
            page.wait_for_function(f"() => {{ const l = document.querySelectorAll('{DLG} #status .line'); "
                                   f"return l.length > 0 && l[l.length - 1].classList.contains('on') "
                                   f"&& l[l.length - 1].innerText.includes('Готовая ведомость отправлена на email'); }}",
                                   timeout=20000)
            check(True, "в: status walks to delivered")
            settle(page, 300)
            check(stored(page) is None, "в: token dropped once the order is delivered")
            check(page.locator(f"{DLG} .inline-rating__open").count() == 1, "в: rating button after delivery")
            check(len(api.order_posts) == 0, "в: resume makes no new order")
            shot(page, "03-delivered.png")
            page.close()

            # foreign payment host -> no link
            api.reset([{"stage": "awaiting_payment", "message": "", "payment_url": "https://evil.example/pay"}])
            page = ctx.new_page()
            open_from_tile(page, base)
            fill(page)
            page.click(f"{DLG} #submitBtn")
            page.wait_for_function(f"() => document.querySelector('{DLG} #message').textContent.includes('Ссылка на оплату недоступна')",
                                   timeout=15000)
            check(page.locator(PAY_LINK).count() == 0, "в: a foreign payment host shows no link")
            page.close()

            # --- г) failed -> server text, submit usable again ---
            api.reset([{"stage": "failed", "message": "Не удалось разобрать файл."}])
            page = ctx.new_page()
            open_from_tile(page, base)
            fill(page)
            page.click(f"{DLG} #submitBtn")
            page.wait_for_function(f"() => document.querySelector('{DLG} #message').textContent.includes('Не удалось разобрать файл.')",
                                   timeout=15000)
            settle(page, 300)
            check("bad" in page.get_attribute(f"{DLG} #message", "class"), "г: failed shown in the error state")
            check(page.is_enabled(f"{DLG} #submitBtn"), "г: «Отправить заказ» usable again")
            check(page.locator(PAY_LINK).count() == 0, "г: no pay link after a failure")

            # --- д) Esc closes, focus back to the tile ---
            page.keyboard.press("Escape")
            settle(page, 300)
            check(not dlg_open(page), "д: Esc closes the dialog")
            check(page.evaluate(f"() => document.activeElement === document.querySelector('{TILE_BTN}')"),
                  "д: focus back on the tile button")
            check(page.evaluate("() => getComputedStyle(document.documentElement).overflow !== 'hidden'"),
                  "д: catalog scrolls again")
            page.close()

            # --- е) phone 375x812 ---
            phone = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
            phone.route(re.compile(r"^https://api\.ai-vibes\.ru/"), api.handle)
            phone.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net)/"), lambda r: r.abort())
            pg = phone.new_page()
            open_from_tile(pg, base)
            settle(pg, 300)
            box = pg.locator(f"{DLG} .dlg-in").bounding_box()
            check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 375, f"е: dialog fits 375 px ({box})")
            check(no_hscroll(pg), "е: no horizontal scroll at 375 px")
            check(pg.evaluate(f"() => document.querySelector('{DLG}').scrollWidth <= document.querySelector('{DLG}').clientWidth"),
                  "е: no horizontal scroll inside the dialog")
            shot(pg, "04-phone-375.png")
            phone.close()

            # --- ж) the old address forwards to the dialog ---
            page = ctx.new_page()
            page.goto(base + "/vedomost.html")
            page.wait_for_url(re.compile(r"/products\.html#vedomost$"), timeout=8000)
            page.wait_for_function(f"() => document.querySelector('{DLG}').open", timeout=6000)
            check(True, "ж: /vedomost.html lands on /products.html#vedomost with the dialog open")
            check(page.evaluate("() => !!document.querySelector('meta[name=robots][content*=noindex]')") is False,
                  "ж: the catalog itself is not noindex")
            page.keyboard.press("Escape")
            settle(page, 200)
            check(not page.url.endswith("#vedomost"), "ж: closing drops #vedomost from the address")
            page.close()

            # --- з) nakladnaya still runs on the shared engine ---
            api.reset([{"stage": "awaiting_payment", "message": "", "payment_url": PAY_URL}])
            page = ctx.new_page()
            naklad_console = []
            page.on("console", lambda m: naklad_console.append(m.text) if m.type == "error" else None)
            page.goto(base + "/nakladnaya.html")
            page.set_input_files("#file", str(PDF))
            page.fill("#email", EMAIL)
            page.check("#consent")
            page.click("#submitBtn")
            page.wait_for_selector("#status a.pay", timeout=15000)
            check(len(api.order_posts) == 1 and api.order_posts[0].get("product") == "nakladnaya-m15",
                  f"з: nakladnaya order on the shared engine ({api.order_posts[:1]})")
            check(not any("[order-flow]" in m for m in naklad_console), "з: no order-flow init error on nakladnaya")
            page.close()

            check(not errors, f"no page errors ({errors[:2]})")
            check(not any("[order-flow]" in m for m in console_errors), "no order-flow init error on the catalog")
            browser.close()

    ok = all(r for r, _ in RESULTS)
    for r, name in RESULTS:
        print(("OK   " if r else "FAIL ") + name)
    print(f"VD status={'ok' if ok else 'fail'} checks={sum(r for r, _ in RESULTS)}/{len(RESULTS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
