#!/usr/bin/env python
"""Public-address gate (plan PLAN.md section 5 E4, invariant 5; DoD 4).

    python tests/v2_links_check.py [base_url]

The baseline `tests/fixtures/v2_legacy_urls.json` was taken from the live site on 2026-10-11 (every sitemap page + rate.html:
all internal links, the ids that are linked or named by the plan, links to the site from published posts). For every entry:
  * the page answers 200;
  * for an address with a fragment: after a cold load the target element exists, is rendered and its top lies inside the
    window (-2 px .. window height) at 390x844 and at 1440x900. Entries marked `label_only` (addresses that become a label
    next to the new tariff block, plan 4.1) only need the id to exist.
Legal text: sha256 of the normalised innerText of `<main>` of /oferta.html and /privacy.html (CRLF -> LF, trailing spaces
stripped per line, outer newlines stripped, Chromium 1440x900) must equal `tests/fixtures/v2_legal_text.json`.
After the owner approves offer 1.6 (plan Э7.2) the oferta hash is replaced in a separate commit (`oferta=approved-1.6`).
`python scripts/build_chrome.py --check` must pass; a missing script is `chrome_check=missing` and a failure.
Last line: LINKS status=ok|fail legacy=N/N legal_text=same|changed chrome_check=ok|missing|fail
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import ROOT, Served, block_metrika, http_get, settle   # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures"
VIEWS = [("390x844", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)),
         ("1440x900", dict(viewport={"width": 1440, "height": 900}))]
TARGET_JS = r"""(frag) => {
  const el = document.getElementById(frag) || document.getElementsByName(frag)[0];
  if (!el) return {found: false};
  const r = el.getBoundingClientRect();
  return {found: true, rendered: el.getClientRects().length > 0,
          top: r.top, h: r.height, H: innerHeight};
}"""
MAIN_JS = "() => { const m = document.querySelector('main'); return m ? m.innerText : null; }"


def norm_legal(t: str) -> str:
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in t.split("\n")).strip("\n")


def scroll_settled(pg, max_ms=5000):
    """Wait until the scroll position stops changing (smooth scrolling, late layout) for three polls in a row."""
    last, same, waited = None, 0, 0
    while waited < max_ms:
        y = pg.evaluate("Math.round(window.scrollY)")
        same = same + 1 if y == last else 0
        if same >= 3:
            return
        last = y
        pg.wait_for_timeout(150)
        waited += 150


def check_anchor(pg, base, url, label_only):
    """Returns '' when fine, otherwise the reason."""
    pg.goto("about:blank")                      # a fragment-only change would not reload the page: always a cold load
    resp = pg.goto(base + url, wait_until="load", timeout=45000)
    if not resp or resp.status != 200:
        return f"status {resp.status if resp else 0}"
    frag = url.split("#", 1)[1]
    pg.wait_for_timeout(300)
    scroll_settled(pg)
    why = ""
    for attempt in range(2):
        t = pg.evaluate(TARGET_JS, frag)
        if not t["found"]:
            return "id not found"
        if label_only:
            return ""
        if not t["rendered"]:
            why = "target not rendered"
        elif t["top"] < -2 or t["top"] >= t["H"]:
            why = f"top={t['top']:.0f}px outside the window (H={t['H']})"
        else:
            return ""
        if attempt == 0:
            pg.wait_for_timeout(1200)        # late layout (scene refresh, fonts) may still move the page
            scroll_settled(pg)
    return why


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    a = ap.parse_args(argv)
    from playwright.sync_api import sync_playwright
    legacy = json.loads((FIX / "v2_legacy_urls.json").read_text(encoding="utf-8"))["entries"]
    legal = json.loads((FIX / "v2_legal_text.json").read_text(encoding="utf-8"))["pages"]
    failed: dict[str, list[str]] = {}
    legal_same, chrome = True, "missing"
    try:
        with Served(a.base) as srv, sync_playwright() as p:
            base = srv.base
            br = p.chromium.launch()
            # 1. status of every distinct page
            page_status = {}
            for e in legacy:
                path = e["url"].split("#")[0]
                if path not in page_status:
                    page_status[path] = http_get(base + path)[0]
            for e in legacy:
                st = page_status[e["url"].split("#")[0]]
                if st != 200:
                    failed.setdefault(e["url"], []).append(f"status {st}")
            # 2. anchors in the browser, two widths
            anchors = [e for e in legacy if "#" in e["url"] and page_status[e["url"].split("#")[0]] == 200]
            for vname, vkw in VIEWS:
                ctx = br.new_context(locale="ru-RU", **vkw)
                block_metrika(ctx)
                pg = ctx.new_page()
                for e in anchors:
                    try:
                        why = check_anchor(pg, base, e["url"], bool(e.get("label_only")))
                    except Exception as ex:
                        why = f"{type(ex).__name__}: {str(ex)[:60]}"
                    if why:
                        failed.setdefault(e["url"], []).append(f"{vname}: {why}")
                pg.close(); ctx.close()
            # 3. legal text
            ctx = br.new_context(locale="ru-RU", viewport={"width": 1440, "height": 900})
            block_metrika(ctx)
            for path, want in legal.items():
                pg = ctx.new_page()
                try:
                    pg.goto(base + path, wait_until="load", timeout=45000)
                    settle(pg, 300)
                    txt = pg.evaluate(MAIN_JS)
                    got = hashlib.sha256(norm_legal(txt).encode("utf-8")).hexdigest() if txt is not None else "no-main"
                except Exception as ex:
                    got = f"error:{type(ex).__name__}"
                if got != want:
                    legal_same = False
                    print(f"  LEGAL {path}: sha256 {got[:16]} != baseline {want[:16]}")
                pg.close()
            ctx.close(); br.close()
    except Exception as ex:
        failed["gate_error"] = [f"{type(ex).__name__}: {str(ex)[:100]}"]
        legal_same = False
    script = ROOT / "scripts" / "build_chrome.py"
    if script.exists():
        try:
            r = subprocess.run([sys.executable, str(script), "--check"], cwd=str(ROOT), capture_output=True, text=True, timeout=180)
            chrome = "ok" if r.returncode == 0 else "fail"
            if r.returncode:
                print("  build_chrome --check:", (r.stdout + r.stderr).strip().splitlines()[-1:] or r.returncode)
        except Exception as ex:
            chrome = "fail"
            print("  build_chrome --check error:", type(ex).__name__)
    for url, why in list(failed.items())[:60]:
        print(f"  FAIL {url}: {'; '.join(why)}")
    n = len(legacy)
    good = n - len([u for u in failed if u != "gate_error"])
    ok = not failed and legal_same and chrome == "ok"
    print(f"LINKS status={'ok' if ok else 'fail'} legacy={good}/{n} legal_text={'same' if legal_same else 'changed'} chrome_check={chrome}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
