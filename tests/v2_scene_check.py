#!/usr/bin/env python
"""Scroll-scene gate (plan PLAN.md section 5 E2 + 4.5.3).

    python tests/v2_scene_check.py [base_url]

Widths 360x640, 390x844, 844x390 (landscape phone), 820x1180, 1440x900; Chromium and WebKit (Playwright's Safari engine).
Checks per engine and width on the home page `section[data-scene]` / `[data-scene-stage]` / `[data-sheet]`:
  a. movement: on each of the three thirds of the scene travel at least 60 % of the sheets present at this width
     changed their transform matrix (or box);                                     -> moved_min (worst ratio)
  b. at the end of the travel every sheet lies inside the stage box;
  c. smoothness: gaps longer than 50 ms between requestAnimationFrame callbacks during one scripted pass over the
     scene; Chromium additionally with the CPU slowed x4 through CDP (limit 5) and without it (limit 0);
  d. (Chromium) prefers-reduced-motion and no-JS: matrices do not change, `html.scene-live` is absent, the final
     frame is visible (sheets inside the stage, effective opacity >= 0.5);
  e. sticky: at 25/50/75 % of the travel the stage top is within +-2 px of its own sticky offset (CSS `top`, 0 by contract; guards against an
     `overflow-x:hidden` ancestor);
  f. anchors: loading /#tarify and clicking `a.chrome-cta` (menu opened first on phones) put the block top within
     +-40 px of the place under the fixed header; after the scene the page scrolls to the footer.
Last line: SCENE status=ok|fail engines=N moved_min=.. long_frames=.. long_frames_nothrottle=.. sticky_dev=.. [webkit=reason] [miss=..]
Exit 0 = ok. The numbers depend on the machine; the final judgement of smoothness is the owner's phone (plan, Э6).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import Served, block_metrika, settle   # noqa: E402

SIZES = [("360x640", 360, 640, True), ("390x844", 390, 844, True), ("844x390", 844, 390, True),
         ("820x1180", 820, 1180, True), ("1440x900", 1440, 900, False)]
LONG_MS = 50
MOVED_MIN = 0.6
LONG_LIMIT, LONG_LIMIT_NOTHROTTLE = 5, 0

INFO_JS = r"""() => {
  const s = document.querySelector('section[data-scene]'), st = document.querySelector('[data-scene-stage]');
  if (!s || !st) return {ok: false};
  const r = s.getBoundingClientRect();
  return {ok: true, top: r.top + scrollY, h: s.offsetHeight, H: innerHeight, live: document.documentElement.classList.contains('scene-live'),
          sticky: getComputedStyle(st).position};
}"""
SHEETS_JS = r"""() => [...document.querySelectorAll('[data-scene] [data-sheet], [data-sheet]')]
  .filter(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
  .map(e => { const r = e.getBoundingClientRect(); let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
              return {tf: getComputedStyle(e).transform, l: r.left, t: r.top, w: r.width, h: r.height, o}; })"""
INSIDE_JS = r"""() => {
  const st = document.querySelector('[data-scene-stage]'); if (!st) return {n: 0, outside: -1, faint: -1};
  const b = st.getBoundingClientRect(), tol = 2;
  const sh = [...document.querySelectorAll('[data-sheet]')].filter(e => e.getClientRects().length > 0);
  let outside = 0, faint = 0;
  for (const e of sh) { const r = e.getBoundingClientRect(); if (r.left < b.left - tol || r.right > b.right + tol || r.top < b.top - tol || r.bottom > b.bottom + tol) outside++;
    let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); if (o < 0.5) faint++; }
  return {n: sh.length, outside, faint, top: b.top, exp: parseFloat(getComputedStyle(st).top) || 0};
}"""
ANCHOR_JS = r"""() => {
  const t = document.querySelector('#tarify'); if (!t) return {found: false};
  const h = document.querySelector('header[data-chrome]'); let off = 0;
  if (h) { const cs = getComputedStyle(h); if (cs.position === 'fixed' || cs.position === 'sticky') off = h.getBoundingClientRect().bottom; }
  return {found: true, top: t.getBoundingClientRect().top, off, y: scrollY, H: innerHeight, atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2};
}"""
FOOT_JS = r"""() => { const f = document.querySelector('footer[data-chrome-foot], footer'); const r = f ? f.getBoundingClientRect() : null;
  return {foot: !!f, top: r ? r.top : -1, H: innerHeight, atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2}; }"""
PASS_JS = r"""({y0, y1, ms}) => new Promise(res => {
  const ts = [], t0 = performance.now(); window.scrollTo(0, y0);
  const f = t => { ts.push(t); const k = Math.min(1, (t - t0) / ms); window.scrollTo(0, y0 + (y1 - y0) * k); if (k < 1) requestAnimationFrame(f); else res(ts); };
  requestAnimationFrame(f);
})"""


def sig(sheets):
    return [(s["tf"], round(s["l"] * 2), round(s["t"] * 2)) for s in sheets]


def moved_ratio(a, b):
    n = min(len(a), len(b))
    if not n:
        return 0.0
    mv = 0
    for x, y in zip(a, b):
        if x["tf"] != y["tf"] or abs(x["l"] - y["l"]) > 1 or abs(x["t"] - y["t"]) > 1 or abs(x["w"] - y["w"]) > 1:
            mv += 1
    return mv / n


def stable_sheets(pg, limit_ms=2600):
    last, waited = None, 0
    while waited < limit_ms:
        cur = pg.evaluate(SHEETS_JS)
        if last is not None and sig(cur) == sig(last):
            return cur
        last = cur
        pg.wait_for_timeout(160)
        waited += 160
    return last or []


def ctx_args(w, h, mobile, **kw):
    a = dict(viewport={"width": w, "height": h}, locale="ru-RU", **kw)
    if mobile:
        a.update(is_mobile=True, has_touch=True)
    return a


def goto_home(ctx, base, path="/"):
    pg = ctx.new_page()
    resp = pg.goto(base + path, wait_until="load", timeout=45000)
    settle(pg, 700)
    return pg, (resp.status if resp else 0)


def frame_gaps(ts):
    return sum(1 for a, b in zip(ts, ts[1:]) if b - a > LONG_MS)


def run_engine(name, browser, base, log):
    """Returns dict(moved_min, long, long_nt, sticky_dev, miss[list], ran)."""
    R = dict(moved_min=1.0, long=0, long_nt=0, sticky_dev=0.0, miss=[], ran=True)
    for label, w, h, mobile in SIZES:
        tag = f"{name}:{label}"
        ctx = browser.new_context(**ctx_args(w, h, mobile))
        block_metrika(ctx)
        try:
            pg, status = goto_home(ctx, base)
            info = pg.evaluate(INFO_JS) if status == 200 else {"ok": False}
            if not info.get("ok"):
                R["miss"].append(f"{tag}:no_scene(status={status})")
                R["moved_min"] = 0.0
                ctx.close()
                continue
            if not info["live"]:
                R["miss"].append(f"{tag}:scene-live_class_missing")
            rng = info["h"] - info["H"]
            if rng < 50:
                R["miss"].append(f"{tag}:scene_travel_too_short({rng}px)")
            ys = [info["top"] + rng * p for p in (0, 1 / 3, 2 / 3, 1)]
            snaps = []
            for y in ys:
                pg.evaluate("y => window.scrollTo(0, y)", y)
                pg.wait_for_timeout(250)
                snaps.append(stable_sheets(pg))
            ratios = [moved_ratio(a, b) for a, b in zip(snaps, snaps[1:])]
            R["moved_min"] = min(R["moved_min"], min(ratios))
            for i, r in enumerate(ratios):
                if r < MOVED_MIN:
                    R["miss"].append(f"{tag}:moved_part{i + 1}={r:.2f}")
            ins = pg.evaluate(INSIDE_JS)                         # (b) at the end of the travel
            if ins["n"] == 0 or ins["outside"] != 0:
                R["miss"].append(f"{tag}:end_outside={ins['outside']}/{ins['n']}")
            for p in (0.25, 0.5, 0.75):                          # (e) sticky stage stays in the window
                pg.evaluate("y => window.scrollTo(0, y)", info["top"] + rng * p)
                pg.wait_for_timeout(300)
                r_ = pg.evaluate(INSIDE_JS)
                dev = abs(r_.get("top", 999) - r_.get("exp", 0))          # the stage must stand where its own `top` pins it
                R["sticky_dev"] = max(R["sticky_dev"], dev)
                if dev > 2:
                    R["miss"].append(f"{tag}:sticky_dev@{p}={dev:.1f}px")
            # (c) smoothness: one scripted pass over the scene, without and (Chromium) with CPU x4
            pg.evaluate("window.scrollTo(0, 0)")
            pg.wait_for_timeout(400)
            ts = pg.evaluate(PASS_JS, {"y0": max(0, info["top"] - info["H"] * 0.5), "y1": info["top"] + rng + info["H"] * 0.3, "ms": 3000})
            nt = frame_gaps(ts)
            R["long_nt"] = max(R["long_nt"], nt)
            line = f"  {tag} moved={['%.2f' % r for r in ratios]} end_outside={ins['outside']}/{ins['n']} sticky={R['sticky_dev']:.1f} long_nothrottle={nt}"
            if name == "chromium":
                cdp = ctx.new_cdp_session(pg)
                cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                pg.evaluate("window.scrollTo(0, 0)")
                pg.wait_for_timeout(500)
                ts = pg.evaluate(PASS_JS, {"y0": max(0, info["top"] - info["H"] * 0.5), "y1": info["top"] + rng + info["H"] * 0.3, "ms": 3000})
                th = frame_gaps(ts)
                R["long"] = max(R["long"], th)
                cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
                line += f" long_cpu4={th}"
            log(line)
            # (f) anchors and the footer
            for how in ("load", "cta", "cta_from_end"):
                pg2 = pg
                try:
                    if how == "load":
                        pg.goto("about:blank")
                        pg.goto(base + "/#tarify", wait_until="load", timeout=45000)      # a cold load with the fragment
                    elif how == "cta":
                        pg.goto(base + "/", wait_until="load", timeout=45000)
                        settle(pg, 500)
                        click_cta(pg)
                    else:
                        pg.goto(base + "/", wait_until="load", timeout=45000)
                        settle(pg, 500)
                        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                        pg.wait_for_timeout(500)
                        click_cta(pg)
                    pg.wait_for_timeout(1800)
                    a = pg.evaluate(ANCHOR_JS)
                    # the block top must sit under the header (+-40 px); at the very end of a short page it may only be inside the window
                    good = a["found"] and (-40 <= a["top"] <= a["off"] + 40 or (a["atEnd"] and 0 <= a["top"] < a["H"]))
                    if not good:
                        R["miss"].append(f"{tag}:anchor_{how}(top={a.get('top')},off={a.get('off')})")
                except Exception as e:
                    R["miss"].append(f"{tag}:anchor_{how}:{type(e).__name__}")
            pg.goto(base + "/", wait_until="load", timeout=45000)
            settle(pg, 500)
            pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
            pg.wait_for_timeout(500)
            f = pg.evaluate(FOOT_JS)
            if not (f["foot"] and f["atEnd"] and f["top"] < f["H"]):
                R["miss"].append(f"{tag}:footer_not_reached")
        except Exception as e:
            R["miss"].append(f"{tag}:{type(e).__name__}:{str(e)[:60]}")
        finally:
            ctx.close()
    return R


def click_cta(pg):
    cta = pg.locator("a.chrome-cta").first
    if not cta.is_visible():
        tg = pg.locator("button[data-menu-toggle]").first
        if tg.count():
            tg.click()
            pg.wait_for_timeout(350)
    cta.click(timeout=5000)


def run_static(browser, base, log):
    """(d) reduced motion and no scripts, Chromium only."""
    miss = []
    for mode in ("reduced_motion", "no_js"):
        for label, w, h, mobile in SIZES:
            kw = dict(reduced_motion="reduce") if mode == "reduced_motion" else dict(java_script_enabled=False)
            ctx = browser.new_context(**ctx_args(w, h, mobile, **kw))
            block_metrika(ctx)
            tag = f"{mode}:{label}"
            try:
                pg, status = goto_home(ctx, base)
                info = pg.evaluate(INFO_JS) if status == 200 else {"ok": False}
                if not info.get("ok"):
                    miss.append(f"{tag}:no_scene"); ctx.close(); continue
                if info["live"]:
                    miss.append(f"{tag}:scene-live_present")
                ys = [0, info["top"], info["top"] + info["h"] / 2, info["top"] + info["h"]]
                sigs = []
                for y in ys:
                    pg.evaluate("y => window.scrollTo(0, y)", y)
                    pg.wait_for_timeout(300)
                    sigs.append(pg.evaluate(SHEETS_JS))
                ratios = [moved_ratio(sigs[0], s) for s in sigs[1:]]
                # a sticky/static stage may shift boxes with scrolling; only the matrices must stay equal
                if any(a["tf"] != b["tf"] for s in sigs[1:] for a, b in zip(sigs[0], s)):
                    miss.append(f"{tag}:matrix_changed")
                pg.evaluate("y => window.scrollTo(0, y)", info["top"])
                pg.wait_for_timeout(300)
                ins = pg.evaluate(INSIDE_JS)
                if ins["n"] == 0 or ins["outside"] or ins["faint"]:
                    miss.append(f"{tag}:final_frame(n={ins['n']},outside={ins['outside']},faint={ins['faint']})")
                log(f"  {tag} sheets={ins['n']} outside={ins['outside']} faint={ins['faint']}")
            except Exception as e:
                miss.append(f"{tag}:{type(e).__name__}:{str(e)[:60]}")
            finally:
                ctx.close()
    return miss


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    a = ap.parse_args(argv)
    from playwright.sync_api import sync_playwright
    miss, engines, webkit_reason = [], 0, ""
    agg = dict(moved_min=1.0, long=0, long_nt=0, sticky_dev=0.0)
    try:
        with Served(a.base) as srv, sync_playwright() as p:
            log = lambda s: print(s, flush=True)
            for name in ("chromium", "webkit"):
                try:
                    br = getattr(p, name).launch()
                except Exception as e:
                    reason = re.sub(r"\s+", "_", str(e).strip().splitlines()[0])[:80] if str(e).strip() else type(e).__name__
                    if name == "webkit":
                        webkit_reason = reason
                    else:
                        miss.append(f"chromium_launch:{reason}")
                    continue
                R = run_engine(name, br, srv.base, log)
                engines += 1
                agg["moved_min"] = min(agg["moved_min"], R["moved_min"])
                agg["long"] = max(agg["long"], R["long"])
                agg["long_nt"] = max(agg["long_nt"], R["long_nt"])
                agg["sticky_dev"] = max(agg["sticky_dev"], R["sticky_dev"])
                miss += R["miss"]
                if name == "chromium":
                    miss += run_static(br, srv.base, log)
                br.close()
    except Exception as e:
        miss.append(f"gate_error:{type(e).__name__}:{str(e)[:80]}")
    if engines < 2:
        miss.append(f"engines={engines}_need_2")
    if agg["long"] > LONG_LIMIT:
        miss.append(f"long_frames>{LONG_LIMIT}")
    if agg["long_nt"] > LONG_LIMIT_NOTHROTTLE:
        miss.append(f"long_frames_nothrottle>{LONG_LIMIT_NOTHROTTLE}")
    for m in miss[:40]:
        print("  FAIL", m)
    ok = not miss
    extra = (f" webkit={webkit_reason}" if webkit_reason else "") + ("" if ok else " miss=" + ",".join(m.replace(" ", "_") for m in miss[:12]))
    print(f"SCENE status={'ok' if ok else 'fail'} engines={engines} moved_min={agg['moved_min']:.2f} long_frames={agg['long']} "
          f"long_frames_nothrottle={agg['long_nt']} sticky_dev={agg['sticky_dev']:.1f}{extra}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
