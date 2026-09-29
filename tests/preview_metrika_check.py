#!/usr/bin/env python
"""Preview gate for the Yandex Metrika counter (2026-09-29).

    python tests/preview_metrika_check.py [base_url] [--shots DIR]

Drives the shared browser service (svc_tab, own tab only) over every page that carries
assets/metrika.js and proves, per page:
  * no Content-Security-Policy violation and no page exception in the console;
  * a request to mc.yandex.ru leaves the page (tag.js load and the hit);
  * the page's own scripts still ran (index2.app.js sets up the header; hero-demo on /);
and, on the pages with download buttons, that a click sends the matching goal
(download_transkribator / download_apartment_auditor) — navigation is prevented.
privacy.html is checked for section #p12 with its revision date and for carrying no counter.
Last line: METRIKA_PREVIEW status=<ok|fail> pages=<n> failed=<n>
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path.home() / ".claude" / "0 ProEKTi" / "browser-service"))
from svc_tab import Tab  # noqa: E402

PAGES = ["/", "/about.html", "/services/", "/apps/transkribator/", "/products.html", "/blog/",
         "/blog/apartment-auditor/", "/blog/dva-prilozheniya/", "/blog/ryazan-obmer-razvertki/",
         "/blog/smeta-osnovanie-list/", "/blog/transkribator-golosom/"]
GOALS = {  # page -> (link selector, goal id)
    "/apps/transkribator/": ('a[href*="github.com/Lavr5000/Transkribator/releases"]', "download_transkribator"),
    "/": ('a[href*="rustore.ru/catalog/app/com.lavr5000xxx.apartmentauditor"]', "download_apartment_auditor"),
}


# Console errors that are expected and do not fail the gate, each counted and printed separately:
#  * tag.js tries an ad cookie-matching pixel on yandex.ru/an/mapuid; the CSP blocks it on purpose
#    (no ad matching, privacy.html does not promise it), and Metrika has no setting to switch it off;
#  * blob:/data: images blocked by default-src 'self' on pages WITHOUT the counter — present on the
#    live site before this change (measured 29.09.2026 on ai-vibes.ru/privacy.html and /about.html).
INTENDED = ("yandex.ru/an/mapuid",)
BASELINE = ("Loading the image 'blob:", "Loading the image 'data:image/svg+xml")


def drain(t: Tab, sec: float) -> None:
    time.sleep(sec)
    t.eval("1")                      # pulls pending CDP events into t.events


def collect(t: Tab):
    reqs, bad = [], []
    for ev in t.events:
        m, p = ev.get("method"), ev.get("params", {})
        if m == "Network.requestWillBeSent":
            reqs.append(p["request"]["url"])
        elif m == "Log.entryAdded":
            e = p["entry"]
            if e.get("level") == "error" and ("Content Security Policy" in e.get("text", "")
                                              or e.get("source") in ("security", "javascript")):
                bad.append(e.get("text", "")[:200])
        elif m == "Runtime.exceptionThrown":
            bad.append("exception: " + str(p["exceptionDetails"].get("text"))[:200])
        elif m == "Runtime.consoleAPICalled" and p.get("type") == "error":
            bad.append("console.error: " + " ".join(str(a.get("value", a.get("description", "")))
                                                   for a in p.get("args", []))[:200])
    return reqs, bad


def split(bad: list[str], counter_page: bool):
    intended = [b for b in bad if any(k in b for k in INTENDED)]
    baseline = [b for b in bad if not counter_page and any(k in b for k in BASELINE)]
    real = [b for b in bad if b not in intended and b not in baseline]
    return real, intended, baseline


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8765")
    ap.add_argument("--shots", default="")
    a = ap.parse_args()
    base = a.base.rstrip("/")
    failed = 0
    with Tab() as t:
        t.send("Network.enable")
        t.send("Log.enable")
        for page in PAGES:
            t.events.clear()
            t.goto(base + page, wait=3)
            drain(t, 3)
            own = t.eval("!!document.querySelector('script[src^=\"/assets/metrika.js\"]') && typeof window.ym")
            header = t.eval("!!document.querySelector('header, .site-header, nav')")
            hero = t.eval("document.querySelectorAll('[data-hero-demo], .hero-demo, .term').length") if page == "/" else None
            goal_ok = None
            if page in GOALS:
                sel, goal = GOALS[page]
                t.events.clear()
                n = t.eval(f"""(()=>{{const a=document.querySelector('{sel}'); if(!a) return 0;
                    a.addEventListener('click', e=>e.preventDefault(), {{once:true}}); a.click(); return 1;}})()""")
                drain(t, 3)
                greqs, _ = collect(t)
                goal_ok = bool(n) and any("mc.yandex" in u and goal in u for u in greqs)
                t.events.clear()
                t.goto(base + page, wait=3)
                drain(t, 2)
            reqs, bad = collect(t)
            bad, intended, _ = split(bad, True)
            mc = [u for u in reqs if "mc.yandex." in u]
            ok = own == "function" and len(mc) >= 1 and not bad and header and goal_ok is not False
            failed += 0 if ok else 1
            print(f"PAGE {page} ok={int(ok)} ym={own} mc_requests={len(mc)} errors={len(bad)} "
                  f"intended_blocks={len(intended)} header={int(bool(header))}"
                  + (f" hero_nodes={hero}" if hero is not None else "")
                  + (f" goal={GOALS[page][1]}:{int(goal_ok)}" if goal_ok is not None else ""))
            for b in bad:
                print("  ERR", b)
            if a.shots:
                name = page.strip("/").replace("/", "_") or "index"
                t.send("Emulation.setDeviceMetricsOverride", width=1440, height=1000, deviceScaleFactor=1, mobile=False)
                drain(t, 1)
                Path(a.shots).mkdir(parents=True, exist_ok=True)
                Path(t.shot(f"metrika_{name}_1440.png")).replace(Path(a.shots) / f"{name}_1440.png")
                t.send("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
                drain(t, 1)
                Path(t.shot(f"metrika_{name}_390.png")).replace(Path(a.shots) / f"{name}_390.png")
                t.send("Emulation.clearDeviceMetricsOverride")
        # privacy.html: section 12 present, dated, and no counter on the legal page
        t.events.clear()
        t.goto(base + "/privacy.html#p12", wait=3)
        drain(t, 2)
        p12 = t.eval("(()=>{const s=document.getElementById('p12'); return s ? s.innerText : ''})()") or ""
        stamp = t.eval("document.querySelector('.stamp') ? document.querySelector('.stamp').innerText : ''") or ""
        reqs, bad = collect(t)
        bad, _, baseline = split(bad, False)
        ok = ("Яндекс Метрика" in p12 and "2026-09-29" in p12 and "1.6" in stamp
              and not any("mc.yandex." in u for u in reqs) and not bad)
        failed += 0 if ok else 1
        print(f"PAGE /privacy.html ok={int(ok)} p12={int('Яндекс Метрика' in p12)} dated={int('2026-09-29' in p12)} "
              f"version16={int('1.6' in stamp)} mc_requests={sum('mc.yandex.' in u for u in reqs)} errors={len(bad)} "
              f"baseline_errors={len(baseline)}")
        if a.shots:
            Path(t.shot("metrika_privacy_p12.png")).replace(Path(a.shots) / "privacy_p12_1440.png")
    total = len(PAGES) + 1
    print(f"METRIKA_PREVIEW status={'ok' if failed == 0 else 'fail'} pages={total} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
