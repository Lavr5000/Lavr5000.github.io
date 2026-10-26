#!/usr/bin/env python
"""Gated catalog tile on products.html (PLAN-7 Э7b). Playwright route-mock, no real API is ever called.

    python tests/products_tile_check.py [--shots DIR]

Serves the working tree on 127.0.0.1 (same helper as tests/v2_gate.py) and intercepts every request to
https://api.ai-vibes.ru/**. The tile «Таблицы из PDF → Excel» ships hidden in products.js
(visible:false + gate "pdf_tables"); products.render.js asks GET /api/products/status:

  * {"pdf_tables":"hidden"} -> no tile, the static catalog is intact (6 cards, 2 product tiles);
  * {"pdf_tables":"public"} -> the tile appears as article.card[data-product="pdf-tables"] at its registry
    order (after nakladnaya-m15), links /pdf-tables.html and shows «499 ₽»;
  * network failure / HTTP 500 -> the tile stays hidden, the catalog is intact;
  * an answer that arrives later than the client's 4 s timeout -> the tile stays hidden.

In every scenario the rest of the page must stay clean: no console error and no page exception except the
resource lines of the request this very test blocks or fails on purpose.
Last line: PTILE status=ok|fail checks=<n>/<n>
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, settle, block_metrika  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.ai-vibes.ru"
PAGE = "/products.html"
STATIC_CARDS = 6          # material-takeoff, nakladnaya-m15 + 2 document services + 2 free apps
STATIC_PRODUCT_TILES = 2  # material-takeoff (order 10), nakladnaya-m15 (order 60)
# fetch shim for the timeout scenario: the answer arrives after the client has already given up
SLOW_FETCH = """
(() => { const o = window.fetch; window.fetch = (i, n) => o(i, n)
  .then(r => new Promise(res => setTimeout(() => res(r), 4600))); })();
"""

RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, name: str) -> bool:
    RESULTS.append((bool(ok), name))
    return bool(ok)


def run_scenario(browser, served, mode: str, shots=None):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    # the catalog page carries the Metrika counter; this gate is about the tile, so the counter
    # (and its intentionally CSP-blocked yandex.ru pixel) stays out of the run
    block_metrika(ctx)

    def handle(route, request):
        if mode == "hidden":
            return route.fulfill(status=200, content_type="application/json", body='{"pdf_tables":"hidden"}')
        if mode == "public":
            return route.fulfill(status=200, content_type="application/json", body='{"pdf_tables":"public"}')
        if mode == "netfail":
            return route.abort()
        if mode == "http500":
            return route.fulfill(status=500, content_type="application/json", body='{"error":"boom"}')
        return route.fulfill(status=200, content_type="application/json", body='{"pdf_tables":"public"}')

    ctx.route(f"{API}/**", handle)
    if mode == "timeout":
        ctx.add_init_script(SLOW_FETCH)
    page = ctx.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(f"pageerror {e}"))

    def on_console(m):
        if m.type != "error":
            return
        # the api.ai-vibes.ru line is the request this very test blocks or fails on purpose;
        # "yandex" is the blocked Metrika loader (see block_metrika above)
        url = (m.location or {}).get("url", "") or ""
        if "api.ai-vibes.ru" in m.text or "yandex" in m.text or "yandex" in url:
            return
        if mode in ("netfail", "http500") and m.text.startswith("Failed to load resource"):
            return
        errors.append(m.text)
    page.on("console", on_console)
    page.goto(served.base + PAGE)
    settle(page, 700 if mode != "timeout" else 5500)

    tile = page.locator('[data-product="pdf-tables"]')
    n = tile.count()
    if mode == "public":
        check(n == 1, f"public: tile present ({n})")
        check(tile.get_attribute("class") == "card", "public: tile is article.card")
        check(page.locator("article.card").count() == STATIC_CARDS + 1,
              f"public: {STATIC_CARDS + 1} cards ({page.locator('article.card').count()})")
        check(page.locator('[data-product]').count() == STATIC_PRODUCT_TILES + 1,
              "public: product tiles 2+1")
        check(tile.locator("h3").inner_text() == "Таблицы из PDF → Excel", "public: title")
        check(tile.locator(".card-price").inner_text() == "499 ₽", "public: price 499 ₽")
        check(tile.locator(".tag").inner_text() == "доступен", "public: tag доступен")
        href = tile.locator("a.btn-pay").get_attribute("href")
        check(href == "/pdf-tables.html", f"public: link /pdf-tables.html ({href})")
        bullets = tile.locator(".bullets li").all_inner_texts()
        check(len(bullets) == 2 and bullets[0].startswith("Вход: PDF до 25 листов")
              and bullets[1].startswith("Выход: Excel"), f"public: bullets ({bullets})")
        pos = page.evaluate(
            """() => { const a = document.querySelector('[data-product="nakladnaya-m15"]');
                 const b = document.querySelector('[data-product="pdf-tables"]');
                 return !a || !b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }""")
        check(pos, "public: tile after nakladnaya-m15 (order 70)")
        if shots:
            page.screenshot(path=str(shots / f"tile-{mode}.png"), full_page=True)
    else:
        expect = "no tile"
        check(n == 0, f"{mode}: {expect} ({n})")
        check(page.locator("article.card").count() == STATIC_CARDS,
              f"{mode}: static catalog intact {STATIC_CARDS} ({page.locator('article.card').count()})")
        check(page.locator('[data-product]').count() == STATIC_PRODUCT_TILES,
              f"{mode}: product tiles still {STATIC_PRODUCT_TILES}")
        if shots:
            page.screenshot(path=str(shots / f"tile-{mode}.png"), full_page=True)
    check(not errors, f"{mode}: console/page errors {errors[:2]}")
    ctx.close()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=None)
    args = ap.parse_args()
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    with Served(None) as served:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for mode in ("hidden", "public", "netfail", "http500", "timeout"):
                run_scenario(browser, served, mode, shots)
            browser.close()

    ok = sum(1 for r, _ in RESULTS if r)
    for r, name in RESULTS:
        if not r:
            print(f"FAIL {name}")
    print(f"PTILE status={'ok' if ok == len(RESULTS) else 'fail'} checks={ok}/{len(RESULTS)}")
    return 0 if ok == len(RESULTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
