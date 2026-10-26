#!/usr/bin/env python
"""Preview gate for the Yandex Metrika counter (2026-09-29).

    python tests/preview_metrika_check.py [base_url] [--shots DIR]

Drives the shared browser service (svc_tab, own tab only) over every page that carries
assets/metrika.js and proves, per page:
  * no Content-Security-Policy violation and no page exception in the console;
  * a request to mc.yandex.ru leaves the page (tag.js load and the hit);
  * the page's own scripts still ran (the shared header is present);
and, on the pages with download, order or contact buttons, that a click sends the matching goal
(download_transkribator / download_apartment_auditor / order_click / contact_max). An order trigger
`[data-order]` (a[data-pay] or a[data-request]) must open `dialog#order-dialog` in place (navigation is
prevented; a pay button whose payment is on opens `dialog#pay-dialog` instead), and the goal call must carry the trigger's own service id and a `place` equal to the id of the
nearest section (the dialog is closed afterwards). Contact clicks inside the order dialog report the
dialog id as `place`.
On every page with a payment link `a[data-pay]` the payment window is closed to Metrika:
`dialog#pay-dialog.ym-hide-content`, `form#pay-form.ym-disable-keys` and the input fields
`input.ym-disable-keys` (email, contact) must be there.
privacy.html is checked for section #p12 with its revision date and for carrying no counter;
spasibo/ (noindex) must carry neither the counter script nor a request to mc.yandex.
Last line: METRIKA_PREVIEW status=<ok|fail> pages=<n> failed=<n>
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path.home() / ".claude" / "0 ProEKTi" / "browser-service"))
from svc_tab import Tab  # noqa: E402

PAGES = ["/", "/about.html", "/services/", "/apps/transkribator/", "/products.html", "/blog/",
         "/blog/apartment-auditor/", "/blog/dva-prilozheniya/", "/blog/ryazan-obmer-razvertki/",
         "/blog/smeta-osnovanie-list/", "/blog/transkribator-golosom/"]
GOALS = {  # page -> [(selector, goal id, kind)]; kind "order" = order trigger that opens the order dialog
    "/apps/transkribator/": [('a[href*="github.com/Lavr5000/Transkribator/releases"]', "download_transkribator", "link")],
    "/": [("[data-order]", "order_click", "order"),
          ('#contact a[href^="https://max.ru/"]', "contact_max", "link")],
    "/services/": [("[data-order]", "order_click", "order"),
                   ('#contact a[href^="https://max.ru/"]', "contact_max", "link")],
    # the RuStore link of Apartment Auditor moved from the home page to the builders page with layout v2
    "/products.html": [('a[href*="rustore.ru/catalog/app/com.lavr5000xxx.apartmentauditor"]', "download_apartment_auditor", "link"),
                       ("[data-order]", "order_click", "order"),
                       ('#contact a[href^="https://max.ru/"]', "contact_max", "link")],
}
PAY_PAGES = ["/", "/services/", "/products.html"]  # pages that carry the payment window


# Console errors that are expected and do not fail the gate, each counted and printed separately:
#  * tag.js tries an ad cookie-matching pixel on yandex.ru/an/mapuid; the CSP blocks it on purpose
#    (no ad matching, privacy.html does not promise it), and Metrika has no setting to switch it off;
#  * blob:/data: images blocked by default-src 'self' on pages WITHOUT the counter — present on the
#    live site before this change (measured 29.09.2026 on ai-vibes.ru/privacy.html and /about.html).
INTENDED = ("yandex.ru/an/mapuid",)
BASELINE = ("Loading the image 'blob:", "Loading the image 'data:image/svg+xml")

# products.html probes the gated catalog tile (GET /api/products/status) at page load; a preview on
# 127.0.0.1 must not call the production API (the CORS refusal fills the log with security errors).
# This CDP harness has no route interception, so fetch is shimmed in the page before any script runs.
API_SHIM = """
(() => {
  const orig = window.fetch;
  if (!orig) return;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/products/status') !== -1) {
      return Promise.resolve(new Response('{"pdf_tables":"hidden"}',
        {status: 200, headers: {'content-type': 'application/json'}}));
    }
    return orig(input, init);
  };
})();
"""


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
        t.send("Page.enable")
        t.send("Page.addScriptToEvaluateOnNewDocument", source=API_SHIM)
        for page in PAGES:
            t.events.clear()
            t.goto(base + page, wait=3)
            drain(t, 3)
            own = t.eval("!!document.querySelector('script[src^=\"/assets/metrika.js\"]') && typeof window.ym")
            header = t.eval("!!document.querySelector('header, .site-header, nav')")
            hero = t.eval("document.querySelectorAll('[data-hero-demo], .hero-demo, .term').length") if page == "/" else None
            if page in PAY_PAGES:
                pay_ym = t.eval("""(()=>{const d=document.querySelector('dialog#pay-dialog'), f=document.querySelector('form#pay-form');
                    const ins=[...document.querySelectorAll('#pay-email, #pay-contact')];
                    return !!d && d.classList.contains('ym-hide-content') && !!f && f.classList.contains('ym-disable-keys')
                      && ins.length === 2 && ins.every(i => i.classList.contains('ym-disable-keys')) ? 1 : 0;})()""")
            else:
                pay_ym = None
            goal_res = []
            for sel, goal, kind in GOALS.get(page, []):
                t.events.clear()
                if kind == "order":
                    before = t.eval("location.href")
                    want = t.eval(f"""(()=>{{const b=document.querySelector('{sel}'); if(!b) return null;
                        const s = b.closest('section[id], [role="dialog"][id]');
                        return JSON.stringify({{service: b.getAttribute('data-service-id'), place: s ? s.id : ''}});}})()""")
                    # a request button opens #order-dialog; a pay button opens #pay-dialog while the payment of its
                    # service is on (setup-start is sold directly since the services went live), else #order-dialog
                    dlg = t.eval(f"""(()=>{{const b=document.querySelector('{sel}'); if(!b) return '';
                        const allowed = b.hasAttribute('data-pay') ? ['order-dialog', 'pay-dialog'] : ['order-dialog'];
                        b.click();
                        const d = allowed.map(id => document.getElementById(id)).find(x => x && x.open);
                        return d ? d.id : '';}})()""")
                    n = 1 if dlg else 0
                    drain(t, 3)
                    n = bool(n) and t.eval("location.href") == before
                    # The goal hit carries its params as site-info={"service":..,"place":..}: they must be this
                    # trigger's own service id and the id of its nearest section.
                    sent = [unquote(u) for u in collect(t)[0] if "goal://" in unquote(u) and "/order_click" in unquote(u)]
                    got = None
                    if sent and "site-info=" in sent[0]:
                        try:
                            got = json.loads(sent[0].split("site-info=", 1)[1].split("&", 1)[0])
                        except ValueError:
                            got = None
                    exp = json.loads(want) if want else None
                    n = n and got is not None and exp is not None and bool(got.get("place"))                         and got.get("service") == exp["service"] and got.get("place") == exp["place"]
                    if dlg:
                        t.eval(f"document.getElementById('{dlg}').close()")
                    n = n and not t.eval("!!document.querySelector('#order-dialog[open], #pay-dialog[open]')")
                else:
                    n = t.eval(f"""(()=>{{const a=document.querySelector('{sel}'); if(!a) return 0;
                        a.addEventListener('click', e=>e.preventDefault(), {{once:true}}); a.click(); return 1;}})()""")
                    drain(t, 3)
                greqs, _ = collect(t)
                goal_res.append((goal, bool(n) and any("mc.yandex" in u and goal in u for u in greqs)))
            goal_ok = all(r for _, r in goal_res) if goal_res else None
            if goal_res:
                t.events.clear()
                t.goto(base + page, wait=3)
                drain(t, 2)
            reqs, bad = collect(t)
            bad, intended, _ = split(bad, True)
            mc = [u for u in reqs if "mc.yandex." in u]
            ok = own == "function" and len(mc) >= 1 and not bad and header and goal_ok is not False \
                and pay_ym in (None, 1)
            failed += 0 if ok else 1
            print(f"PAGE {page} ok={int(ok)} ym={own} mc_requests={len(mc)} errors={len(bad)} "
                  f"intended_blocks={len(intended)} header={int(bool(header))}"
                  + (f" hero_nodes={hero}" if hero is not None else "")
                  + (f" pay_window_hidden_from_ym={pay_ym}" if pay_ym is not None else "")
                  + "".join(f" goal={g}:{int(r)}" for g, r in goal_res))
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
        # spasibo/: noindex thank-you page, no counter at all
        t.events.clear()
        t.goto(base + "/spasibo/?n=AV-00000000", wait=3)
        drain(t, 2)
        has_script = t.eval("!!document.querySelector('script[src*=\"metrika\"]')")
        noindex = t.eval("!!document.querySelector('meta[name=robots][content*=noindex]')")
        reqs, bad = collect(t)
        bad, _, _ = split(bad, False)
        ok = not has_script and noindex and not any("mc.yandex." in u for u in reqs) and not bad
        failed += 0 if ok else 1
        print(f"PAGE /spasibo/ ok={int(ok)} counter_script={int(bool(has_script))} noindex={int(bool(noindex))} "
              f"mc_requests={sum('mc.yandex.' in u for u in reqs)} errors={len(bad)}")
    total = len(PAGES) + 2
    print(f"METRIKA_PREVIEW status={'ok' if failed == 0 else 'fail'} pages={total} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
