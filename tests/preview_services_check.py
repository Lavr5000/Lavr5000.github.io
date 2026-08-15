"""Preview gate for the services page and the home teaser.

Serves nothing itself: point it at a running preview (default http://127.0.0.1:8901) and it drives
a real Chromium. What it proves, per the ai-vibes-deploy TESTING-AND-UAT preview layer:

  * both pages load with zero console errors at 1440x1000, 768x1024 and 390x844;
  * no horizontal scroll at any of the three;
  * EVERY order trigger is enumerated by selector [data-order] (never by an assumed count) and
    clicked in turn: the modal must show that service's own title and its own price label, and the
    generated mailto: must carry both after percent-decoding — the failure this catches is a card
    that quietly keeps another service's price;
  * the panel disclosure works by its actual mechanism (:focus-within in assets/site2.css), i.e.
    the inside content is reachable without a pointer;
  * prefers-reduced-motion keeps the panels open.

Usage: python tests/preview_services_check.py [base_url] [--shots DIR]
Exit 0 = all checks passed. Any failure prints "FAIL <check>" and exits 1.
"""
import sys
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

# Failure lines quote prices ("3 500 ₽"); a cp1251 console would raise UnicodeEncodeError and hide
# the very failure we are here to see.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

BASE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "http://127.0.0.1:8901"
SHOTS = None
if "--shots" in sys.argv:
    SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1])
    SHOTS.mkdir(parents=True, exist_ok=True)

PAGES = ["/", "/services/"]
VIEWPORTS = [(1440, 1000), (768, 1024), (390, 844)]
NBSP = {" ": " ", " ": " ", " ": " "}

failures = []
checks = 0


def norm(s):
    for bad, good in NBSP.items():
        s = (s or "").replace(bad, good)
    return s.strip()


def check(ok, label):
    global checks
    checks += 1
    if not ok:
        failures.append(label)
        print(f"FAIL {label}")


with sync_playwright() as p:
    browser = p.chromium.launch()
    for path in PAGES:
        for w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + path, wait_until="networkidle")

            check(not errors, f"{path} @{w}x{h}: console errors {errors[:2]}")
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            check(overflow <= 0, f"{path} @{w}x{h}: horizontal scroll +{overflow}px")

            if SHOTS:
                # Reveal-on-scroll leaves off-screen blocks at opacity 0, so a full-page shot of an
                # unscrolled page is a picture of nothing. Mark everything as revealed first.
                page.evaluate(
                    "() => { document.querySelectorAll('[data-reveal], .step')"
                    ".forEach(el => { el.style.transitionDelay = '0ms'; el.classList.add('in'); }); }")
                page.wait_for_timeout(600)
                name = ("home" if path == "/" else "services") + f"-{w}x{h}.png"
                page.screenshot(path=str(SHOTS / name), full_page=(w == 1440))

            # Every order trigger, found by selector, not by count.
            triggers = page.locator("[data-order]")
            n = triggers.count()
            if path == "/services/":
                check(n >= 4, f"{path} @{w}x{h}: only {n} order triggers found")
            for i in range(n):
                b = triggers.nth(i)
                title = b.get_attribute("data-order")
                label = b.get_attribute("data-price-label")
                check(bool(label), f"{path} @{w}x{h}: trigger {i} has no data-price-label")
                b.scroll_into_view_if_needed()
                b.click()
                page.wait_for_selector("#order-modal.is-open", timeout=3000)
                shown_title = norm(page.locator("#order-service").inner_text())
                shown_price = norm(page.locator("#order-price").inner_text())
                mail = unquote(page.locator("#order-mail").get_attribute("href") or "")
                check(shown_title == norm(title), f"{path} @{w}x{h}: modal title '{shown_title}' != '{title}'")
                check(shown_price == norm(label), f"{path} @{w}x{h}: modal price '{shown_price}' != '{label}'")
                check(norm(title) in norm(mail), f"{path} @{w}x{h}: mailto misses the service name")
                check(norm(label) in norm(mail), f"{path} @{w}x{h}: mailto misses the price label")
                page.locator("#order-modal .modal-close").click()
                page.wait_for_selector("#order-modal.is-open", state="detached", timeout=3000) if False else page.wait_for_timeout(150)

            # Panel disclosure without a pointer: focus a control inside the panel (:focus-within).
            if path == "/services/" and w == 1440:
                for pid in ("service-1", "service-2", "service-3", "service-4"):
                    btn = page.locator(f"#{pid} .panel-buy button")
                    btn.focus()
                    page.wait_for_timeout(700)  # .panel-inside opacity is a CSS transition
                    opened = page.evaluate(
                        "id => { const el = document.querySelector('#' + id + ' .panel-inside');"
                        " return getComputedStyle(el).opacity; }", pid)
                    check(float(opened) > 0.9, f"panel {pid}: not disclosed on keyboard focus (opacity {opened})")
            ctx.close()

    # prefers-reduced-motion: panels stay open, page still usable.
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(BASE + "/services/", wait_until="networkidle")
    op = page.evaluate("() => getComputedStyle(document.querySelector('#service-4 .panel-inside')).opacity")
    check(float(op) > 0.9, f"reduced-motion: panel content hidden (opacity {op})")
    if SHOTS:
        page.screenshot(path=str(SHOTS / "services-reduced-motion.png"), full_page=True)
    ctx.close()
    browser.close()

print(f"\npreview gate: {checks - len(failures)}/{checks} checks passed")
sys.exit(1 if failures else 0)
