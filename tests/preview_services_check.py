"""Preview gate for the home page, the tariffs page and the builders page (v2 layout).

Serves nothing itself: point it at a running preview (default http://127.0.0.1:8901) and it drives
a real Chromium. What it proves, per the ai-vibes-deploy TESTING-AND-UAT preview layer:

  * the three pages load with zero console errors at 1440x1000, 768x1024 and 390x844;
  * no horizontal scroll at any of the three;
  * EVERY order trigger is enumerated by selector [data-order] (links <a data-pay> and <a data-request>,
    never an assumed count) and clicked in turn. While AI_PAY.enabled is false (and always for
    data-request) the request dialog `dialog#order-dialog` must open showing that trigger's own title and
    its own price label, its generated mailto: must carry both after percent-decoding, and its links must
    run MAX -> Telegram -> e-mail; when AI_PAY.enabled is true a data-pay trigger must open
    `dialog#pay-dialog` with the same title and price. The failure this catches is a card that quietly
    keeps another service's price. The set of service ids found per page must contain the expected ones;
  * the same triggers work without a pointer: focus + Enter opens the dialog, Escape closes it;
  * a data-pay link has a non-empty href (works without scripts) and its text carries its own price;
  * the home page scene: with motion allowed `html.scene-live` is set; with prefers-reduced-motion it is
    not, the scene container is of ordinary height and every trigger still opens its dialog.

The v1 "panel disclosure by :focus-within" step is gone with the panels; the keyboard step above is its
replacement. Usage: python tests/preview_services_check.py [base_url] [--shots DIR]
Exit 0 = all checks passed. Any failure prints "FAIL <check>" and exits 1.
"""
import sys
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

# products.html probes the gated catalog tile at page load; a preview must not call the production API
sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import preview_api_stub  # noqa: E402

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

PAGES = ["/", "/services/", "/products.html"]
EXPECTED_IDS = {  # service ids that must be reachable by a trigger on the page
    "/": {"setup-start", "setup-vip"},
    "/services/": {"setup-start", "setup-vip", "support-monthly"},
    "/products.html": {"extract-drawings-data", "as-built-package"},
}
MAX_URL = "https://max.ru/u/f9LHodD0cOJVteiYLPGUodY6uw7J5k_M_QzRJTDzXbK31nlTIokaEh5ebeM"
TG_URL = "https://t.me/lavr5000"
VIEWPORTS = [(1440, 1000), (768, 1024), (390, 844)]
NBSP = {" ": " ", " ": " ", " ": " "}

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


def shot_name(path, w, h):
    stem = {"/": "home", "/services/": "services", "/products.html": "products"}[path]
    return f"{stem}-{w}x{h}.png"


def dialog_ids(page, enabled, trigger):
    """(dialog selector, title selector, price selector) the trigger is expected to open."""
    is_pay = trigger.get_attribute("data-pay") is not None
    # a held service keeps the request window even when payment is on (services.config.js heldServices)
    held = page.evaluate("(id) => ((window.AI_PAY && window.AI_PAY.heldServices) || []).includes(id)",
                         trigger.get_attribute("data-service-id"))
    if is_pay and enabled and not held:
        return "#pay-dialog", "#pay-service", "#pay-price"
    return "#order-dialog", "#order-service", "#order-price"


def check_trigger(page, where, trigger, enabled, via_keyboard):
    title = trigger.get_attribute("data-order")
    label = trigger.get_attribute("data-price-label")
    sid = trigger.get_attribute("data-service-id")
    tag = f"{where} [{sid}]" + (" kbd" if via_keyboard else "")
    check(bool(label) and bool(title), f"{tag}: trigger has no data-order or data-price-label")
    dlg, t_sel, p_sel = dialog_ids(page, enabled, trigger)
    trigger.scroll_into_view_if_needed()
    if via_keyboard:
        trigger.focus()
        page.keyboard.press("Enter")
    else:
        trigger.click()
    page.wait_for_selector(f"{dlg}[open]", timeout=3000)
    check(norm(page.locator(t_sel).inner_text()) == norm(title),
          f"{tag}: dialog title '{page.locator(t_sel).inner_text()}' != '{title}'")
    check(norm(page.locator(p_sel).inner_text()) == norm(label),
          f"{tag}: dialog price '{page.locator(p_sel).inner_text()}' != '{label}'")
    if dlg == "#order-dialog":
        mail = unquote(page.locator("#order-mail").get_attribute("href") or "")
        check(norm(title) in norm(mail), f"{tag}: mailto misses the service name")
        check(norm(label) in norm(mail), f"{tag}: mailto misses the price label")
        hrefs = page.locator("#order-dialog .dlg-channels a").evaluate_all("els => els.map(e => e.getAttribute('href'))")
        ok = (MAX_URL in hrefs and any(h.startswith(TG_URL) for h in hrefs) and any(h.startswith("mailto:") for h in hrefs)
              and hrefs.index(MAX_URL) < next(i for i, h in enumerate(hrefs) if h.startswith(TG_URL))
              < next(i for i, h in enumerate(hrefs) if h.startswith("mailto:")))
        check(ok, f"{tag}: links in the order dialog are not MAX -> Telegram -> e-mail: {hrefs}")
    page.keyboard.press("Escape")
    page.wait_for_selector(f"{dlg}[open]", state="detached", timeout=3000)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for path in PAGES:
        for w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            preview_api_stub(ctx, BASE)
            page = ctx.new_page()
            errors = []
            # Metrika's tag.js tries an ad cookie-matching pixel (yandex.ru/an/mapuid); the page CSP
            # blocks it on purpose since 2026-09-29 — the only console error tolerated here.
            page.on("console", lambda m: errors.append(m.text)
                    if m.type == "error" and "yandex.ru/an/mapuid" not in m.text else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + path, wait_until="networkidle")
            where = f"{path} @{w}x{h}"

            check(not errors, f"{where}: console errors {errors[:2]}")
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            check(overflow <= 0, f"{where}: horizontal scroll +{overflow}px")

            if SHOTS:
                # Reveal-on-scroll leaves off-screen blocks at opacity 0, so a full-page shot of an
                # unscrolled page can be a picture of nothing: mark everything as revealed first.
                page.evaluate(
                    "() => { document.querySelectorAll('[data-reveal], .reveal, .step')"
                    ".forEach(el => { el.style.transitionDelay = '0ms'; el.classList.add('in', 'is-in'); }); }")
                page.wait_for_timeout(600)
                page.screenshot(path=str(SHOTS / shot_name(path, w, h)), full_page=(w == 1440))

            enabled = bool(page.evaluate("() => !!(window.AI_PAY && window.AI_PAY.enabled)"))
            # Every order trigger, found by selector, not by count.
            triggers = page.locator("[data-order]")
            n = triggers.count()
            ids = {triggers.nth(i).get_attribute("data-service-id") for i in range(n)}
            missing = EXPECTED_IDS[path] - ids
            check(not missing, f"{where}: no order trigger for {sorted(missing)} (found {sorted(ids)})")
            for i in range(n):
                t = triggers.nth(i)
                if t.get_attribute("data-pay") is not None:
                    href = t.get_attribute("href") or ""
                    check(bool(href.strip()), f"{where}: data-pay trigger {i} has an empty href")
                    check(norm(t.get_attribute("data-price-label")) in norm(t.inner_text()),
                          f"{where}: data-pay trigger {i} text '{t.inner_text()}' lacks its price label")
                check_trigger(page, where, t, enabled, via_keyboard=False)

            # Without a pointer: focus + Enter on every trigger (once, at the desktop width).
            if w == 1440:
                for i in range(n):
                    check_trigger(page, where, triggers.nth(i), enabled, via_keyboard=True)

            # The scene of the home page runs when motion is allowed.
            if path == "/" and w == 1440:
                live = page.evaluate("() => document.documentElement.classList.contains('scene-live')")
                check(live, f"{where}: scene did not start (no html.scene-live)")
            ctx.close()

    # prefers-reduced-motion: the scene stays off, the page is ordinary, the triggers still work.
    for path in PAGES:
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        preview_api_stub(ctx, BASE)
        page = ctx.new_page()
        page.goto(BASE + path, wait_until="networkidle")
        where = f"{path} reduced-motion"
        if path == "/":
            live = page.evaluate("() => document.documentElement.classList.contains('scene-live')")
            check(not live, f"{where}: scene is live although motion is reduced")
            ratio = page.evaluate(
                "() => { const s = document.querySelector('section[data-scene]'); "
                "return s ? s.getBoundingClientRect().height / window.innerHeight : -1; }")
            check(0 <= ratio <= 2.5, f"{where}: scene container is {ratio:.2f} viewports high, not ordinary")
        overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check(overflow <= 0, f"{where}: horizontal scroll +{overflow}px")
        enabled = bool(page.evaluate("() => !!(window.AI_PAY && window.AI_PAY.enabled)"))
        triggers = page.locator("[data-order]")
        for i in range(triggers.count()):
            check_trigger(page, where, triggers.nth(i), enabled, via_keyboard=False)
        if SHOTS:
            page.screenshot(path=str(SHOTS / (shot_name(path, 1440, 1000).replace("1440x1000", "reduced-motion"))),
                            full_page=True)
        ctx.close()
    browser.close()

print(f"\npreview gate: {checks - len(failures)}/{checks} checks passed")
sys.exit(1 if failures else 0)
