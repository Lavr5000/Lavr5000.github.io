#!/usr/bin/env python
"""Idempotency-Key of the order forms (13.11). Playwright route-mock: no real API, no bank.

    python tests/order_idem_check.py

Serves the working tree on 127.0.0.1 (tests/v2_gate.py helper) and answers https://api.ai-vibes.ru/** from a
script. Scenarios:
  а) nakladnaya (shared engine assets/order-flow.js): POST /api/orders carries an Idempotency-Key that is a UUIDv4;
     a network failure keeps it -> the user's retry sends the SAME key; after a 200 the next order gets a NEW key;
  б) 409 order_duplicate -> «Заявка уже отправлена. Подождите N сек.»; the 4xx ends the key (next one is new);
     413 from nginx ({error:{...}}) -> «Слишком большой запрос»; 429 rate_limited + Retry-After -> «Слишком много
     запросов. Повторите через N сек.»;
  в) the «Таблицы из PDF» dialog: UUIDv4 key, a network failure keeps it for the retry of the same file.
Last line: IDEM status=ok|fail checks=<n>/<n>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, settle  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

API = "https://api.ai-vibes.ru"
PAY_URL = "https://pay.tbank-online.com/new/idem"
PDF = Path(__file__).resolve().parent / "fixtures" / "text.pdf"
EMAIL = "check@example.com"
UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
PT_DLG = "#pt-dialog"
PT_TILE = '[data-product="pdf-tables"] a[data-pt-open]'
RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    print(("OK   " if ok else "FAIL ") + name)
    return bool(ok)


class Api:
    def __init__(self):
        self.keys: list[str | None] = []
        self.queue: list = []        # per POST /api/orders: "abort" | (status, body, extra_headers)

    def handle(self, route, request):
        origin = request.headers.get("origin", "*")
        cors = {"access-control-allow-origin": origin,
                "access-control-allow-headers": request.headers.get("access-control-request-headers",
                                                                    "content-type, authorization, idempotency-key"),
                "access-control-allow-methods": "POST, GET, OPTIONS",
                "access-control-expose-headers": "X-Request-ID, Retry-After", "vary": "Origin"}
        url = request.url

        def js(body, status=200, extra=None):
            return route.fulfill(status=status, headers={**cors, **(extra or {})},
                                 content_type="application/json", body=json.dumps(body))

        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "GET" and url.startswith(f"{API}/api/products/status"):
            return js({"pdf_tables": "public"})
        if request.method == "POST" and url.startswith(f"{API}/api/orders") and "/pay" not in url:
            self.keys.append(request.headers.get("idempotency-key"))
            step = self.queue.pop(0) if self.queue else (200, None, None)
            if step == "abort":
                return route.abort("connectionreset")
            status, body, extra = step
            if body is None:
                n = len(self.keys)
                body = {"order_id": f"id{n:026d}", "order_token": "order_TEST", "upload_token": "upload_TEST",
                        "payment_required": True, "payment_stage": "after_check"}
            return js(body, status, extra)
        if request.method == "POST" and url.startswith(f"{API}/api/upload"):
            return js({"ok": True})
        if request.method == "GET" and url.startswith(f"{API}/api/status"):
            return js({"stage": "awaiting_payment", "message": "", "payment_url": PAY_URL,
                       "precheck": "pending", "precheck_message": "Проверяем файл…"})
        return js({"error": "not_found"}, 404)


def naklad_msg(page) -> str:
    return page.locator("#message").inner_text().strip()


def naklad_submit(page, api, n_before):
    page.click("#submitBtn")
    page.wait_for_function(f"() => true", timeout=1000)
    for _ in range(60):
        if len(api.keys) > n_before and not page.locator("#submitBtn").is_disabled():
            return
        settle(page, 250)


def main() -> int:
    with Served(None) as served:
        base = served.base
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            api = Api()
            ctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), api.handle)
            ctx.route(re.compile(r"^https://(mc\.yandex\.(ru|com)|yastatic\.net|pay\.tbank-online\.com)/"),
                      lambda r: r.abort())
            errors: list[str] = []
            ctx.on("weberror", lambda e: errors.append(str(e.error)))

            # --- а) nakladnaya: UUIDv4, same key after a network failure, new key after a 200 ---
            page = ctx.new_page()
            page.goto(base + "/nakladnaya.html")
            page.set_input_files("#file", str(PDF))
            page.fill("#email", EMAIL)
            page.check("#consent")
            api.queue = ["abort", (200, None, None)]
            naklad_submit(page, api, 0)
            check(len(api.keys) == 1 and bool(api.keys[0]) and bool(UUID4.match(api.keys[0] or "")),
                  f"а: first POST carries a UUIDv4 Idempotency-Key ({api.keys[:1]})")
            naklad_submit(page, api, 1)
            check(len(api.keys) == 2 and api.keys[1] == api.keys[0],
                  "а: the retry after a network failure sends the SAME key")
            page.wait_for_selector("#status a.pay", timeout=15000)
            check(True, "а: the retried order went through (pay link shown)")
            api.queue = [(200, None, None)]
            naklad_submit(page, api, 2)
            check(len(api.keys) == 3 and api.keys[2] != api.keys[0] and bool(UUID4.match(api.keys[2] or "")),
                  "а: after a 200 the next order of the same form gets a NEW key")

            # --- б) messages for 409 / 413 / 429; a 4xx ends the key ---
            api.queue = [(409, {"error_code": "order_duplicate",
                                "message": "Такая заявка уже отправлена. Подождите и обновите страницу.",
                                "retry_after": 10}, None)]
            naklad_submit(page, api, 3)
            msg = naklad_msg(page)
            check("Заявка уже отправлена" in msg and "10 сек" in msg, f"б: 409 order_duplicate message ({msg!r})")
            api.queue = [(413, {"ok": False, "error": {"code": "payload_too_large",
                                                       "message": "Файл превышает лимит загрузки.", "status": 413}},
                          None)]
            naklad_submit(page, api, 4)
            msg = naklad_msg(page)
            check(api.keys[4] != api.keys[3], "б: a 409 ended the key (the next request has a new one)")
            check("Слишком большой запрос" in msg, f"б: 413 from nginx -> «Слишком большой запрос» ({msg!r})")
            api.queue = [(429, {"ok": False, "error": {"code": "rate_limited",
                                                       "message": "Слишком много запросов, повторите позже.",
                                                       "status": 429}}, {"retry-after": "7"})]
            naklad_submit(page, api, 5)
            msg = naklad_msg(page)
            check("Слишком много запросов" in msg and "7 сек" in msg, f"б: 429 rate_limited + Retry-After ({msg!r})")
            page.close()

            # --- в) «Таблицы из PDF» dialog: UUIDv4, same key on the retry of the same file ---
            n0 = len(api.keys)
            api.queue = ["abort", (200, None, None)]
            page = ctx.new_page()
            page.goto(base + "/products.html")
            page.wait_for_selector(PT_TILE, timeout=8000)
            page.click(PT_TILE)
            page.wait_for_function(f"() => document.querySelector('{PT_DLG}').open", timeout=4000)
            page.fill(f"{PT_DLG} [data-pt=email]", EMAIL)
            page.check(f"{PT_DLG} [data-pt=consent]")
            page.set_input_files(f"{PT_DLG} [data-pt=file]", str(PDF))
            for _ in range(40):
                if len(api.keys) > n0 and page.locator(f"{PT_DLG} [data-pt=message]").get_attribute("data-state") == "bad":
                    break
                settle(page, 250)
            check(len(api.keys) == n0 + 1 and bool(UUID4.match(api.keys[n0] or "")),
                  f"в: pdf-tables POST carries a UUIDv4 key ({api.keys[n0:]})")
            page.uncheck(f"{PT_DLG} [data-pt=consent]")      # the user's retry: the form is touched again
            page.check(f"{PT_DLG} [data-pt=consent]")
            for _ in range(40):
                if len(api.keys) > n0 + 1:
                    break
                settle(page, 250)
            check(len(api.keys) == n0 + 2 and api.keys[n0 + 1] == api.keys[n0],
                  "в: the retry of the same file after a network failure sends the SAME key")
            page.close()

            check(not errors, f"no page errors ({errors[:2]})")
            browser.close()

    ok = all(r for r, _ in RESULTS)
    print(f"IDEM status={'ok' if ok else 'fail'} checks={sum(r for r, _ in RESULTS)}/{len(RESULTS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
