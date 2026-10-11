#!/usr/bin/env python
"""Scroll-scene gate: the city behind the whole page (PLAN-3.md 5.2 as changed by PLAN-4.md 4.1).

    python tests/v2_scene_check.py [base_url] [--dod] [--only a,b,...]

Contract: `section[data-scene] > [data-scene-stage] > ([data-scene-bg] > picture > img[data-scene-base],
canvas[data-scene-canvas], noscript > picture > img[data-scene-static]) + section#hero + 3 x [data-scene-cap]`.
The backdrop `[data-scene-bg]` is fixed in the window under the header for the whole page; the first screen, the
captions and the sections scroll over it. `html.scene-live` = motion is on, `html.scene-failed` = the engine gave up,
`html.scene-plain` = the watchdog has unpinned the backdrop on a device that does not keep up; `window.__sceneState` =
{p, target, spark:[x,y]|null (CSS px inside the canvas), frames, paints, rebuilds, ready, failed, live, plain, slow,
scale, lite}. Travel: P = 0.03 + 0.97 * scrollY / (document height - window height). After every scroll the gate
waits for p === target and a stopped loop.
Windows: full set (both engines) 360x640, 390x844, 844x390, 820x1180, 1440x900; geometry set (Chromium; a, b, e, k)
344x882, 960x950, 1000x1190, 1000x1210, 1024x768, 1920x1080, 2560x1440, 390x844@2; low window 667x375 (both engines).
Checks (latin letter = letter of the plan: a=а b=б c=в d=г e=д f=е g=ж h=з i=и k=к l=л m=м n=н):
  a. state: the canvas against two references the gate draws itself (files before/after of the current orientation,
     "cover" into the backdrop box); 64x64 grid, points inside 170 px around the spark and points where the
     references differ by < 24 (sum of channels) are skipped; share of points closer to "after": start <= 0.12,
     +>= 0.05 on each of 0-25, 25-50, 50-75 % of the page, end >= 0.98 (lite mode: mean blend share); start equals
     "before" (mean <= 12), end equals "after" (<= 12) and differs from "before" (>= 15); the base picture is the
     `before` file; sha256 of the eight scene files equals fixtures/v2_scene_files.json; `tree=` is the sha256 of
     the served index.html, scene3.js, site3.css, metrika.js (with `--dod` on a local address it must equal the
     working tree);
  b. spark: at 0/25/50/75 % the point of the state is inside the backdrop window (8 px inset) and the canvas there is
     lighter than both references by >= 30 with luminance >= 200, or luminance >= 245; at the end there is no spark
     and every grid point equals "after";
  c. smoothness, **Chromium with the video card only** (PO decision 2026-10-11, DECISIONS.md): gaps > 50 ms between
     requestAnimationFrame callbacks, a 3 s pass over the whole page, twice, the worse counts; valid only with >= 60
     frames, the end reached, P from <= 0.1 to >= 0.98; two kinds of pass: scrollTo from the page script and the wheel
     gesture of the browser (Input.synthesizeScrollGesture); 1440x900, 1920x1080, 390x844, 390x844@2; limit 0 without
     throttling, <= 5 with CPU x4 (`--dod`: 0); without throttling also frames >= 150, scene repaints >= 120, 95th
     percentile of the gap <= 34 ms; repaints during a x4 pass >= 30 (paints_cpu4); the watchdog must stay asleep
     (plain=false, slow <= 2), also when the page is scrolled before it has loaded on a slow network. Validity,
     otherwise the verdict is `invalid`, never `ok`: the WebGL renderer is not a software one and the GPU process
     reports gpu_compositing, 2d_canvas and rasterization enabled; the same pass over an empty long page gives 0 long
     frames before and after; a fixed script workload runs >= 2.5 times slower under CPU x4. For reference only (no
     effect on the verdict) the scripted passes are printed for software Chromium and WebKit with the watchdog
     switched off in flight: ref_sw, ref_webkit = worst long frames without throttling / with CPU x4; ref_slow_* =
     long gaps the watchdog has counted there; ref_regress=yes when they exceed twice the base;
  d. reduced motion, no scripts (both engines, five windows) and `data-scene-mode="still"` (Chromium): no scene-live, canvas not displayed, the picture
     (base / static) is the loaded `after` file, covers the backdrop window and is the top backdrop layer, the
     backdrop is fixed under the header, the first screen and three captions are visible, in order and do not
     overlap; scrolling (three positions) changes nothing of that;
  e. pin: at 25/50/75 % of the page the backdrop is `position: fixed` with its top under the header (+-2 px), the
     canvas is visible (display, visibility, opacity 1), covers the window from the header to the bottom and is the
     top backdrop layer (elementsFromPoint); the city is really seen: city_open_d / city_open_m = mean over nine
     scroll positions of the share of the window with nothing of opacity >= 0.05 over the scene, >= 0.35 at
     1440x900, >= 0.15 at 390x844 (and >= 0.15 at its top position);
  f. anchors: /#tarify and `a.chrome-cta` put the block under the header (+-40 px); the page scrolls to the footer;
  g. text over the scene: the first screen, the captions and every text of the page whose backdrop chain is not
     opaque before the scene (dark glass sections): colour of the chain laid over pure white (the worst case,
     independent of the pictures and the spark) against the text colour >= 4.5 (3.0 large)     -> contrast_fail;
  h. blocks in the flow (five windows, 667x375 and 720x450@2 = 200 % zoom): the first screen and the three captions are opaque (>= 0.99),
     inside the document and the window width, in the order of the markup, do not overlap, and each can be brought
     under the header;
  i. rest: frames do not grow for 1 s (idle_frames); back from the end to 50 % the share returns (+-0.05) and the
     spark is there; a cold load of /#tarify shows the state of that place: the share equals the share after
     scrolling there from the top (+-0.05), the spark is there; an answer of the FAQ opened at 60 %: P follows the
     new height; a scroll past the end: P = 1; a page shorter than the window: P is finite, nothing fails;
  k. canvas scale at rest >= 1.0 up to 1920x1080, >= 0.8 at 2560x1440, >= 1.5 at density 2 (scale_min); on phone
     windows +-80 px of window height at the same width in the middle of the page does not rebuild the buffers, does
     not wake the watchdog and moves P by <= 0.02; canvas area <= 2.45 Mpx; the phone turned in the middle of the
     page: the landscape pair, P of the new geometry, the pin holds;
  l. errors: page errors, console errors, failed requests = 0 (Metrika is blocked) on every ordinary load; "after"
     delayed by 3 s: until it arrives the top layer is the base `before` picture and there is no spark, then the
     state follows P; "after" answers 404: scene-failed, static backdrop, the visible base picture is the loaded
     `before` file and covers the window; a throw inside the frame (scene3.js patched in flight): scene-failed, the
     visible base picture is the loaded `after` file;
  m. lite mode (Chromium 390x844, `data-scene-mode="lite"` patched into the page in flight): a, b, c, h;
  n. watchdog (1440x900 and 390x844@2; a 70 ms busy loop patched into scene3.js in flight, the patch must apply
     exactly once or the verdict is `invalid`): in every frame -> plain after one pass, in every 20th frame -> plain
     within three passes (both engines); in every 70th frame, three passes, Chromium with the video card -> stays
     live, slow <= 2. Once plain: `html.scene-plain`, no scene-live, the canvas is not displayed, the backdrop is no
     longer fixed, the visible base picture is the loaded `after` file, no script errors, the four blocks stand
     where they stood (+-1 px), text contrast holds over the opaque body, the footer is reachable, plainAt /
     slowTotal >= 8 / maxGap >= 50 are filled, the event `scene:plain` has fired once and the queue of the Metrika
     counter holds exactly one reachGoal `scene_plain`; the key in sessionStorage carries the build and the mode;
     after a reload of the tab the page is plain at once, draws nothing and sends no second goal. Everywhere else
     stepwise scrolling leaves the watchdog counter at 0;
  o. no backdrop blur: computed backdrop-filter is `none` for every node inside `main`.
Last line: SCENE status=ok|fail|invalid engines=N gpu=.. after_start=.. after_end=.. p_range=.. long_frames=..
           long_frames_nothrottle=.. paints_cpu4=.. pin_dev=.. contrast_fail=.. idle_frames=.. errors=.. scale_min=..
           ref_sw=.. ref_webkit=.. [only=..] [calib=..] [webkit=reason] [miss=..]
Exit 0 = ok, 1 = fail, 2 = invalid. Frame numbers depend on the machine; the last word on smoothness is the phone.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import ROOT, Served, block_metrika, http_get, settle   # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "v2_scene_files.json"
SCENE_DIR = "/assets/scene/"
SCENE_FILES = [f"gorodmost_{k}_{o}.{e}" for k in ("before", "after") for o in ("pc", "tel") for e in ("webp", "jpg")]
# (label, width, height, mobile, density)
FULL = [("360x640", 360, 640, True, 1), ("390x844", 390, 844, True, 1), ("844x390", 844, 390, True, 1),
        ("820x1180", 820, 1180, True, 1), ("1440x900", 1440, 900, False, 1)]
GEOM = [("344x882", 344, 882, True, 1), ("960x950", 960, 950, False, 1), ("1000x1190", 1000, 1190, False, 1),
        ("1000x1210", 1000, 1210, False, 1), ("1024x768", 1024, 768, False, 1), ("1920x1080", 1920, 1080, False, 1),
        ("2560x1440", 2560, 1440, False, 1), ("390x844@2", 390, 844, True, 2)]
LOWS = [("667x375", 667, 375, True, 1), ("720x450@2", 720, 450, False, 2)]   # the second = 1440x900 at 200 % zoom
SMOOTH = [("1440x900", 1440, 900, False, 1), ("1920x1080", 1920, 1080, False, 1), ("390x844", 390, 844, True, 1), ("390x844@2", 390, 844, True, 2)]
FAULT = [("390x844", 390, 844, True, 1), ("1440x900", 1440, 900, False, 1)]
LITE = ("390x844", 390, 844, True, 1)
LETTERS = "abcdefghiklmno"
# thresholds (PLAN-3 5.2; not to be loosened)
LONG_MS, LONG_LIMIT, LONG_LIMIT_NOTHROTTLE, PASS_MS, MIN_FRAMES, MIN_PAINTS = 50, 5, 0, 3000, 60, 30
START_MAX, STEP_MIN, END_MIN, RETURN_TOL = 0.12, 0.05, 0.98, 0.05
RGB_MAX, REF_DELTA_MIN, END_POINT_MAX, MIN_POINTS = 12.0, 15.0, 40.0, 400
SPARK_LUM, SPARK_GAIN, SPARK_WHITE, SPARK_INSET = 200, 30, 245, 8
PIN_TOL, ANCHOR_TOL, VISIBLE_MIN = 2.0, 40, 0.99
P0, P_SPAN, P_TOL = 0.03, 0.97, 0.004                       # engine: P = 0.03 + 0.97 * share of the travel
# (c) is measured in Chromium with the video card (PO decision 2026-10-11); a software renderer makes the verdict `invalid`
GPU_ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
SOFT_GPU = re.compile(r"swiftshader|llvmpipe|software|basic render|^none", re.I)
SLOW_OK = 2                                                 # watchdog counter allowed after the passes with the video card
# with the video card, without throttling (PLAN-4 4.1, from the base of section 2: 180 frames, 179 repaints, 17 ms)
GPU_FRAMES, GPU_PAINTS, GPU_P95 = 150, 120, 34.0
GPU_FEATURES = ("gpu_compositing", "2d_canvas", "rasterization")
# reference runs, a flag only: twice the base (PLAN-4 section 2; WebKit: 31 at 1920x1080, the window added by the review,
# first measured 2026-10-11 on the draft)
REF_MAX = {"sw_nt": 2, "sw_cpu4": 6, "webkit_nt": 62}
CITY_MIN = {"d": 0.35, "m": 0.15}                           # (e) mean share of the window where the city is open
CITY_TOP_M, CANVAS_MAX_PX, HEIGHT_P_TOL = 0.15, 2450000, 0.02
TREE_FILES = [("/", "index.html"), ("/assets/scene3.js", "assets/scene3.js"), ("/assets/site3.css", "assets/site3.css"),
              ("/assets/metrika.js", "assets/metrika.js")]
WATCH_OFF_AT = re.compile(r"\bSLOW = 8\b")                  # reference runs: the watchdog never trips, it only counts
BUSY_AT = re.compile(r"S\.frames\+\+;")                      # (n) a 70 ms busy loop goes into the frame here
BUSY_CODE = " if (S.frames %% %d === 0) { var __b = performance.now(); while (performance.now() - __b < 70) {} }"
WATCHES = [("1440x900", 1440, 900, False, 1), ("390x844@2", 390, 844, True, 2)]
METRIKA = re.compile(r"mc\.yandex|yandex\.ru/an|yastatic")

# ---------------------------------------------------------------- in-page helpers (prepended to every snippet)
LIB = r"""
const root = document.documentElement, N = 64;
const scene = document.querySelector('section[data-scene]'), stage = scene && scene.querySelector('[data-scene-stage]');
const bg = stage && stage.querySelector('[data-scene-bg]');
const base = bg && bg.querySelector('img[data-scene-base]'), cv = bg && bg.querySelector('canvas[data-scene-canvas]');
const stat = bg && bg.querySelector('img[data-scene-static]');
const hero = stage && stage.querySelector('#hero'), caps = stage ? [...stage.querySelectorAll('[data-scene-cap]')] : [];
const blocks = (hero ? [hero] : []).concat(caps);
const S = window.__sceneState || null;
const tall = matchMedia('(max-aspect-ratio: 5/6)').matches;
const rc = e => { const r = e.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; };
const opac = e => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
/* hidden = visibility:hidden, or (the first screen, which stays focusable for the keyboard) fully transparent and deaf to the pointer */
const shown = e => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e);
  return cs.visibility === 'visible' && !(parseFloat(cs.opacity) <= 0.01 && cs.pointerEvents === 'none'); };
const file = u => (u || '').split('?')[0].split('/').pop();
const headB = () => { const h = document.querySelector('header[data-chrome]'); if (!h) return 0; const p = getComputedStyle(h).position; return p === 'fixed' || p === 'sticky' ? h.getBoundingClientRect().bottom : 0; };
/* the window of the backdrop: from the header down to the bottom of the viewport */
const view = () => ({l: 0, t: headB(), r: innerWidth, b: innerHeight});
const covers = e => { if (!e) return false; const a = rc(e), b = view(); return a.l <= b.l + 2 && a.t <= b.t + 2 && a.r >= b.r - 2 && a.b >= b.b - 2; };
const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const state = () => S ? {p: S.p, target: S.target, spark: S.spark ? [S.spark[0], S.spark[1]] : null, frames: S.frames, paints: S.paints,
  rebuilds: S.rebuilds, ready: !!S.ready, failed: !!S.failed, live: !!S.live, plain: !!S.plain, slow: S.slow | 0, slowTotal: S.slowTotal | 0, maxGap: +S.maxGap || 0, plainAt: S.plainAt, scale: S.scale, lite: !!S.lite} : null;
/* the top backdrop layer in the middle of the backdrop window; the backdrop ignores the pointer, so for
   the moment of the hit test it is made hittable through CSSOM (no style element: the page has a CSP) */
const topLayer = () => {
  const st = view(), x = (st.l + st.r) / 2, y = (st.t + st.b) / 2;
  const els = [bg, ...bg.querySelectorAll('*')], old = els.map(e => [e.style.getPropertyValue('pointer-events'), e.style.getPropertyPriority('pointer-events')]);
  els.forEach(e => e.style.setProperty('pointer-events', 'auto', 'important'));
  const hit = document.elementsFromPoint(x, y).find(n => bg.contains(n) && n !== bg);
  els.forEach((e, i) => { e.style.removeProperty('pointer-events'); if (old[i][0]) e.style.setProperty('pointer-events', old[i][0], old[i][1]); if (!e.getAttribute('style')) e.removeAttribute('style'); });
  return !hit ? 'none' : hit === cv ? 'canvas' : hit === base ? 'base' : hit === stat ? 'static' : hit.tagName.toLowerCase();
};
/* two references: the files before/after of the current orientation drawn by "cover" into the backdrop box, at the
   pixel size of the scene canvas (or of the box if the canvas is not in use) */
const refs = async () => {
  const W = bg.clientWidth, H = bg.clientHeight, used = cv && S && S.ready && cv.width > 2;
  const cw = used ? cv.width : Math.round(W), ch = used ? cv.height : Math.round(H);
  const m = /\.(webp|jpe?g)(\?|$)/.exec((base && (base.currentSrc || base.src)) || ''), ext = m ? m[1] : 'webp';
  const key = [W, H, cw, ch, tall, ext].join('|');
  if (window.__gateRefs && window.__gateRefs.key === key) return window.__gateRefs;
  const load = u => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('reference not loaded: ' + u)); im.src = u; });
  const draw = im => { const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d', {alpha: false, willReadFrequently: true}); g.imageSmoothingQuality = 'high';
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k;
    g.drawImage(im, (W - iw) / 2 * cw / W, (H - ih) / 2 * ch / H, iw * cw / W, ih * ch / H); return c; };
  const url = k => '%SCENE_DIR%gorodmost_' + k + '_' + (tall ? 'tel' : 'pc') + '.' + ext;
  const R = {key, W, H, cw, ch, b: draw(await load(url('before'))), a: draw(await load(url('after')))};
  window.__gateRefs = R; return R;
};
const grid = c => { const t = document.createElement('canvas'); t.width = t.height = N; const g = t.getContext('2d', {willReadFrequently: true});
  g.drawImage(c, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
const patch = (c, R, x, y) => { const t = document.createElement('canvas'); t.width = t.height = 5; const g = t.getContext('2d', {willReadFrequently: true});
  g.drawImage(c, Math.round(x * c.width / R.W) - 2, Math.round(y * c.height / R.H) - 2, 5, 5, 0, 0, 5, 5);
  const d = g.getImageData(0, 0, 5, 5).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += luma(d, i); return s / 25; };
""".replace("%SCENE_DIR%", SCENE_DIR)


def js(body: str, is_async: bool = False) -> str:
    return ("async " if is_async else "") + "(arg) => {" + LIB + body + "}"


INFO_JS = js(r"""
  const scenes = document.querySelectorAll('section[data-scene]').length;
  if (!scene || !stage || !bg) return {ok: false, scenes};
  const de = document.documentElement, sr = rc(scene), br = rc(bg), css = getComputedStyle(bg);
  const pic = e => e ? {file: file(e.currentSrc || e.src), ok: e.complete && e.naturalWidth > 0, shown: shown(e), covers: covers(e)} : null;
  const ccs = cv ? getComputedStyle(cv) : null, cr = cv ? rc(cv) : null;
  return {ok: true, scenes, W: innerWidth, H: innerHeight, y: scrollY, maxY: de.scrollHeight - innerHeight, docH: de.scrollHeight,
    live: root.classList.contains('scene-live'), failed: root.classList.contains('scene-failed'), plain: root.classList.contains('scene-plain'), tall, S: state(),
    sceneTop: sr.t + scrollY, sceneH: sr.h, bgTop: br.t, bgB: br.b, pos: css.position, head: headB(),
    base: pic(base), static: pic(stat), canvases: bg.querySelectorAll('canvas').length,
    canvas: cv ? {display: ccs.display, visibility: ccs.visibility, opacity: opac(cv), covers: covers(cv), px: cv.width * cv.height, w: cv.width, h: cv.height,
                  scale: cr.w > 0 && cr.h > 0 ? Math.min(cv.width / cr.w, cv.height / cr.h) : 0} : null,
    caps: caps.length, hero: !!hero, top: topLayer(),
    blocks: blocks.map(e => { const r = rc(e); return {vis: shown(e) && r.w > 1 && r.h > 1, o: opac(e), l: r.l, t: r.t, r: r.r, b: r.b, h: r.h, dt: r.t + scrollY, db: r.b + scrollY}; })};
""")
# the canvas against the references; never reads the live canvas back directly (it is drawn into a small copy)
GRID_JS = js(r"""
  if (!cv || !S) return {err: 'no canvas or state'};
  let R; try { R = await refs(); } catch (e) { return {err: String(e.message || e)}; }
  const cd = grid(cv), bd = grid(R.b), ad = grid(R.a), sp = S.spark;
  let n = 0, near = 0, mix = 0, sB = 0, nB = 0, sA = 0, maxA = 0, sRef = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (j * N + i) * 4; let dB = 0, dA = 0, dR = 0, num = 0, den = 0;
    for (let c = 0; c < 3; c++) { const ab = ad[k + c] - bd[k + c]; dB += Math.abs(cd[k + c] - bd[k + c]); dA += Math.abs(cd[k + c] - ad[k + c]); dR += Math.abs(ab); num += (cd[k + c] - bd[k + c]) * ab; den += ab * ab; }
    sRef += dR; sA += dA; if (dA > maxA) maxA = dA;
    const inSpark = !!sp && Math.hypot((i + 0.5) / N * R.W - sp[0], (j + 0.5) / N * R.H - sp[1]) < 170;
    if (!inSpark) { sB += dB; nB++; }
    if (inSpark || dR < 24) continue;
    n++; if (dA < dB) near++; mix += Math.min(1, Math.max(0, num / den));
  }
  let spark = null;
  if (sp) { const st = view(), c = rc(cv), vx = c.l + sp[0], vy = c.t + sp[1], I = arg.inset;
    spark = {x: sp[0], y: sp[1], inside: vx >= st.l + I && vx <= st.r - I && vy >= st.t + I && vy <= st.b - I && vx >= I && vx <= innerWidth - I,
             lum: patch(cv, R, sp[0], sp[1]), ref: Math.max(patch(R.b, R, sp[0], sp[1]), patch(R.a, R, sp[0], sp[1]))}; }
  return {n, share: n ? (S.lite ? mix : near) / n : -1, madB: nB ? sB / nB / 3 : 999, madA: sA / (N * N) / 3, maxA: maxA / 3,
          refDelta: sRef / (N * N) / 3, spark, S: state()};
""", True)
WAIT_JS = r"""async ({exp, lim, tol}) => {
  const t0 = performance.now(); let last = '', same = 0, s = null;
  while (performance.now() - t0 < lim) {
    await new Promise(r => setTimeout(r, 50)); s = window.__sceneState; if (!s) continue;
    const sig = [s.p, s.target, s.frames, s.paints].join('|');
    const good = s.ready && s.p === s.target && (exp == null || Math.abs(s.target - exp) <= tol);
    same = good && sig === last ? same + 1 : 0; last = sig;
    if (same >= 3) return {ok: true, p: s.p, target: s.target};
  }
  return {ok: false, p: s ? s.p : null, target: s ? s.target : null, ready: s ? !!s.ready : null};
}"""
# the pass goes on for 400 ms after the end is reached: the travel catches up with the scroll, those frames count too
PASS_JS = r"""({y0, y1, ms}) => new Promise(res => {
  const S = window.__sceneState || {}, ts = [], pa = S.paints | 0, t0 = performance.now(); let lo = 9, hi = -9;
  window.scrollTo(0, y0);
  const f = t => { ts.push(t); if (typeof S.p === 'number') { if (S.p < lo) lo = S.p; if (S.p > hi) hi = S.p; }
    const k = Math.min(1, (t - t0) / ms); window.scrollTo(0, y0 + (y1 - y0) * k);
    if (t - t0 < ms + 400) requestAnimationFrame(f); else res({ts, lo, hi, paints: (S.paints | 0) - pa, y: scrollY, plain: !!S.plain, slow: S.slow | 0}); };
  requestAnimationFrame(f);
})"""
BLANK_HTML = "<!doctype html><meta charset=utf-8><title>calibration</title><body style='margin:0;background:#fff'><div style='height:%dpx'></div>"
# (g) contrast of the text of the given blocks over the brightest spot of both pictures
CONTRAST_JS = js(r"""
  const WHITE = [255, 255, 255, 1];             /* the worst backdrop under a translucent layer */
  const t = document.createElement('canvas'); t.width = t.height = 1; const g1 = t.getContext('2d', {willReadFrequently: true}), cache = new Map();
  const rgba = c => { if (cache.has(c)) return cache.get(c); g1.clearRect(0, 0, 1, 1); g1.fillStyle = '#000'; g1.fillStyle = c; g1.fillRect(0, 0, 1, 1);
    const d = g1.getImageData(0, 0, 1, 1).data, a = d[3] / 255, v = a ? [d[0], d[1], d[2], a] : [0, 0, 0, 0]; cache.set(c, v); return v; };
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const own = e => [...e.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.nodeValue));
  const lab = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '') + '"' + e.textContent.trim().slice(0, 16) + '"';
  let checked = 0, fail = 0, worst = 99; const samples = [];
  let inBlocks = 0, onGlass = 0; const main = document.querySelector('main') || document.body;
  { for (const e of main.querySelectorAll('*')) {
      if (e.closest('svg') || e.closest('[data-scene-bg]') || !own(e) || !shown(e)) continue;
      const mine = blocks.some(b => b.contains(e));
      const cs = getComputedStyle(e), r = rc(e); if (r.w < 2 || r.h < 2) continue;
      /* backdrop chain from the text up to the stage: every layer is a list of alternatives (a gradient = its stops) */
      const layers = [];
      let open = true; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n), o = opac(n), alts = [];
        const stops = s.backgroundImage && s.backgroundImage !== 'none' ? (s.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []) : [];
        const bc = rgba(s.backgroundColor);
        if (stops.length) { for (const c of stops) { const v = rgba(c), a = v[3] + bc[3] * (1 - v[3]), m = k => a ? (v[k] * v[3] + bc[k] * bc[3] * (1 - v[3])) / a : 0; alts.push([m(0), m(1), m(2), a * o]); } }
        else if (bc[3] > 0) alts.push([bc[0], bc[1], bc[2], bc[3] * o]);
        if (alts.length) { layers.push(alts); if (alts.every(a => a[3] >= 0.999)) { open = false; break; } } }
      if (!mine && !open) continue;                 /* ordinary text on an opaque sheet: the general gate judges it */
      if (mine) inBlocks++; else onGlass++;
      const tc = rgba(cs.color), text = [tc[0], tc[1], tc[2], tc[3] * opac(e)];
      let ratio = 99; const walk = (i, bgc) => { if (i < 0) { const fg = over(text, bgc), l1 = lum(fg), l2 = lum(bgc); ratio = Math.min(ratio, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)); return; }
        for (const a of layers[i]) walk(i - 1, over(a, bgc)); };
      walk(layers.length - 1, WHITE);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400, large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      checked++; if (ratio < worst) worst = ratio;
      if (ratio < (large ? 3 : 4.5)) { fail++; if (samples.length < 4) samples.push(lab(e) + '=' + ratio.toFixed(2)); }
    } }
  const bb = rgba(getComputedStyle(document.body).backgroundColor);
  return {checked, inBlocks, onGlass, fail, worst, samples, bodyOpaque: bb[3] >= 0.999};
""", True)
# (e) share of the backdrop window where nothing with opacity >= 0.05 lies over the scene (24x24 points)
OPEN_JS = js(r"""
  const v = view(), M = 24; let open = 0, n = 0;
  const t = document.createElement('canvas'); t.width = t.height = 1; const g1 = t.getContext('2d', {willReadFrequently: true});
  const alpha = c => { g1.clearRect(0, 0, 1, 1); g1.fillStyle = '#000'; g1.fillStyle = c; g1.fillRect(0, 0, 1, 1); return g1.getImageData(0, 0, 1, 1).data[3] / 255; };
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = (i + 0.5) / M * (v.r - v.l), y = v.t + (j + 0.5) / M * (v.b - v.t); let a = 0;
    for (const e of document.elementsFromPoint(x, y)) { if (bg.contains(e) || e === document.body || e === root) break;
      const cs = getComputedStyle(e); a = Math.max(a, alpha(cs.backgroundColor) * opac(e)); if (cs.backgroundImage !== 'none') a = Math.max(a, 0.9); }
    n++; if (a < 0.05) open++;
  }
  return open / n;
""")
# (o) no backdrop blur inside main
BLUR_JS = r"""() => { const m = document.querySelector('main'); if (!m) return ['no_main'];
  return [m, ...m.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); const v = cs.backdropFilter || cs.webkitBackdropFilter || 'none'; return v !== 'none'; })
    .slice(0, 4).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')); }"""
# expected travel of the current scroll position, by the formula of the engine
EXPECT_JS = r"""() => { const de = document.documentElement; return 0.03 + 0.97 * Math.min(1, Math.max(0, scrollY / Math.max(1, de.scrollHeight - de.clientHeight))); }"""
# (c) a recorder for the scroll gesture of the browser
REC_JS = r"""() => { const S = window.__sceneState || {}; window.__rec = {ts: [], ys: [], lo: 9, hi: -9, pa: S.paints | 0, on: true};
  const f = t => { const R = window.__rec; R.ts.push(t); R.ys.push(scrollY); if (typeof S.p === 'number') { if (S.p < R.lo) R.lo = S.p; if (S.p > R.hi) R.hi = S.p; }
    if (R.on) requestAnimationFrame(f); }; requestAnimationFrame(f); }"""
REC_END_JS = r"""(maxY) => { const R = window.__rec, S = window.__sceneState || {}; R.on = false;
  const ts = R.ts.filter((t, i) => R.ys[i] > 0 && R.ys[i] < maxY - 1);
  return {ts, lo: R.lo, hi: R.hi, paints: (S.paints | 0) - R.pa, y: scrollY, plain: !!S.plain, slow: S.slow | 0}; }"""
ANCHOR_JS = r"""() => {
  const t = document.querySelector('#tarify'); if (!t) return {found: false};
  const h = document.querySelector('header[data-chrome]'); let off = 0;
  if (h) { const cs = getComputedStyle(h); if (cs.position === 'fixed' || cs.position === 'sticky') off = h.getBoundingClientRect().bottom; }
  return {found: true, top: t.getBoundingClientRect().top, off, y: scrollY, H: innerHeight, atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2};
}"""
FOOT_JS = r"""() => { const f = document.querySelector('footer[data-chrome-foot], footer'); const r = f ? f.getBoundingClientRect() : null;
  return {foot: !!f, top: r ? r.top : -1, H: innerHeight, atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2}; }"""
THROW_AT = re.compile(r"function\s+paintSpark\s*\(\s*\)\s*\{")
THROW_CODE = " throw new Error('v2_scene_check: injected frame failure');"
LITE_AT = re.compile(r"(<[^>]*\sdata-scene-bg\b)")


# ---------------------------------------------------------------- scaffolding
class Agg:
    """Numbers of the final line and the list of failures (`miss_c` = smoothness, judged apart for `invalid`)."""

    def __init__(self, want, dod):
        self.want, self.long_limit = want, 0 if dod else LONG_LIMIT
        self.miss, self.miss_c, self.calib_bad, self.err_samples = [], [], [], []
        self.plain_seen, self.city, self.slow_total = False, {}, None
        self.start = self.end = self.p_lo = self.p_hi = self.long = self.long_nt = self.paints = None
        self.pin = self.contrast = self.idle = self.errors = self.scale = None

    def lo(self, key, v):
        cur = getattr(self, key)
        setattr(self, key, v if cur is None else min(cur, v))

    def hi(self, key, v):
        cur = getattr(self, key)
        setattr(self, key, v if cur is None else max(cur, v))

    def add(self, key, v):
        setattr(self, key, (getattr(self, key) or 0) + v)

    def fail(self, tag, what):
        self.miss.append(f"{tag}:{what}".replace(" ", ""))

    def fail_c(self, tag, what):
        self.miss_c.append(f"{tag}:{what}".replace(" ", ""))


class Sink:
    """Page errors, console errors and failed requests of one page (Metrika, blocked on purpose, is not counted)."""

    def __init__(self, tag, page_only=False):
        self.tag, self.items, self.page_only = tag, [], page_only

    def attach(self, pg):
        pg.on("pageerror", lambda e: self.items.append("pageerror " + str(e)[:90]))
        if self.page_only:
            return pg

        def skip(url):
            return bool(METRIKA.search(url or ""))

        def on_console(m):
            url = (m.location or {}).get("url", "") or ""
            if m.type == "error" and not skip(url) and "yandex" not in m.text:
                self.items.append("console " + m.text[:90])
        pg.on("console", on_console)
        pg.on("requestfailed", lambda r: None if skip(r.url) else self.items.append(f"requestfailed {r.url[-60:]} {r.failure or ''}"[:120]))
        pg.on("response", lambda r: self.items.append(f"http{r.status} {r.url[-60:]}") if r.status >= 400 and not skip(r.url) else None)
        return pg

    def flush(self, A):
        A.add("errors", len(self.items))
        A.err_samples += [f"{self.tag}: {e}" for e in self.items[:3]]
        if self.items:
            A.fail(self.tag, f"errors={len(self.items)}")
        self.items = []


def new_ctx(browser, spec, **kw):
    _, w, h, mobile, dpr = spec
    a = dict(viewport={"width": w, "height": h}, locale="ru-RU", device_scale_factor=dpr, **kw)
    if mobile:
        a.update(is_mobile=True, has_touch=True)
    ctx = browser.new_context(**a)
    block_metrika(ctx)
    return ctx


def open_page(ctx, url, sink=None, wait="load", extra=600):
    pg = ctx.new_page()
    if sink:
        sink.attach(pg)
    resp = pg.goto(url, wait_until=wait, timeout=45000)
    if wait == "load":
        settle(pg, extra)
    return pg, (resp.status if resp else 0)


def err(e):
    return f"{type(e).__name__}:" + re.sub(r"\s+", "_", (str(e).strip().splitlines() or [""])[0])[:70]


def frame_gaps(ts):
    return sum(1 for a, b in zip(ts, ts[1:]) if b - a > LONG_MS)


class Travel:
    """Scroll positions of the scene travel: the whole page, from the top to the last scroll position."""

    def __init__(self, info):
        self.y0, self.span, self.end = 0.0, float(info["maxY"]), float(info["maxY"])
        self.ok = self.span >= 50

    def y(self, part):
        return self.span * part


def go(pg, y, exp=None, limit=8000):
    """Scroll and wait until the engine has caught up: p === target (and target is the expected one), loop stopped."""
    pg.evaluate("y => window.scrollTo(0, y)", y)
    return pg.evaluate(WAIT_JS, {"exp": exp, "lim": limit, "tol": P_TOL})


def scene_basics(info, tag, A, lite=False):
    """Presence of the live scene; returns the travel or None."""
    if not info.get("ok"):
        A.fail(tag, f"no_scene(scenes={info.get('scenes')})")
        return None
    S = info["S"]
    if not info["live"] or not S or not S["ready"] or S["failed"] or info["failed"]:
        A.fail(tag, f"scene-live_missing(live={info['live']},state={'none' if not S else 'ready=%s,failed=%s' % (S['ready'], S['failed'])})")
        return None
    if info["scenes"] != 1 or info["canvases"] != 1 or info["caps"] != 3 or not info["hero"]:
        A.fail(tag, f"markup(scenes={info['scenes']},canvases={info['canvases']},caps={info['caps']},hero={info['hero']})")
    if lite != S["lite"]:
        A.fail(tag, f"lite_mode={S['lite']}")
    if "e" in A.want and info["pos"] != "fixed":
        A.fail(tag, f"pin@rest(position={info['pos']})")
    if S["plain"] or info["plain"]:
        A.fail(tag, f"watchdog_tripped_at_rest(slow={S['slow']})")
    T = Travel(info)
    if not T.ok:
        A.fail(tag, f"travel(span={T.span:.0f})")
        return None
    return T


def spark_ok(sp):
    return bool(sp) and sp["inside"] and ((sp["lum"] >= SPARK_LUM and sp["lum"] - sp["ref"] >= SPARK_GAIN) or sp["lum"] >= SPARK_WHITE)


def spark_txt(sp):
    return "none" if not sp else f"x={sp['x']:.0f},y={sp['y']:.0f},inside={sp['inside']},lum={sp['lum']:.0f},ref={sp['ref']:.0f}"


def overlap(a, b):
    return min(a["r"], b["r"]) - max(a["l"], b["l"]) > 1 and min(a["b"], b["b"]) - max(a["t"], b["t"]) > 1


def check_travel(pg, tag, A, T, want, log, spec):
    """(a) (b) (e) (i: rest and return) (k: scale) on an opened live page; returns the shares at 0/25/50/75/100 %."""
    shares, line = [], f"  {tag}"
    w0 = go(pg, T.y0, P0)
    if not w0["ok"]:
        A.fail(tag, f"settle@0(p={w0['p']},target={w0['target']})")
        return None
    info = pg.evaluate(INFO_JS)
    if "a" in want:
        b = info["base"]
        if not (b and b["ok"]) or "_before_" not in b["file"] or ("_tel." in b["file"]) != info["tall"]:
            A.fail(tag, f"base_picture({(b or {}).get('file')},ok={(b or {}).get('ok')},tall={info['tall']})")
    if "k" in want:
        sc, dpr, area = info["canvas"]["scale"], spec[4], spec[1] * spec[2]
        need = 1.5 if dpr >= 2 else 1.0 if area <= 1920 * 1080 else 0.8
        A.lo("scale", sc)
        if sc < need - 0.005 or abs(sc - info["S"]["scale"]) > 0.02:
            A.fail(tag, f"scale={sc:.2f}<{need}(state={info['S']['scale']:.2f})")
        if info["canvas"]["px"] > CANVAS_MAX_PX:
            A.fail(tag, f"canvas_px={info['canvas']['px']}>{CANVAS_MAX_PX}")
        line += f" scale={sc:.2f}"
    if "i" in want:
        f0 = pg.evaluate("window.__sceneState.frames")
        pg.wait_for_timeout(1000)
        idle = pg.evaluate("window.__sceneState.frames") - f0
        A.hi("idle", idle)
        if idle:
            A.fail(tag, f"idle_frames@0={idle}")
    for part in (0, 0.25, 0.5, 0.75, 1):
        w = go(pg, T.y(part), P0 + P_SPAN * part)
        if not w["ok"]:
            A.fail(tag, f"settle@{part}(p={w['p']},target={w['target']})")
            return None
        g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET})
        if g.get("err"):
            A.fail(tag, f"grid:{g['err'][:60]}")
            return None
        shares.append(g["share"])
        if "a" in want:
            if g["n"] < MIN_POINTS or g["refDelta"] < REF_DELTA_MIN:
                A.fail(tag, f"references_alike(points={g['n']},delta={g['refDelta']:.1f})")
            if part == 0 and g["madB"] > RGB_MAX:
                A.fail(tag, f"start_not_before(mean={g['madB']:.1f})")
            if part == 1 and (g["madA"] > RGB_MAX or g["madB"] < REF_DELTA_MIN):
                A.fail(tag, f"end_not_after(vs_after={g['madA']:.1f},vs_before={g['madB']:.1f})")
        if "b" in want:
            if part < 1 and not spark_ok(g["spark"]):
                A.fail(tag, f"spark@{part}({spark_txt(g['spark'])})")
            if part == 1 and (g["spark"] or g["maxA"] > END_POINT_MAX):
                A.fail(tag, f"spark_left_at_end(state={bool(g['spark'])},worst_point={g['maxA']:.0f})")
        if "e" in want and part in (0.25, 0.5, 0.75):
            i2 = pg.evaluate(INFO_JS)
            c = i2["canvas"]
            dev = abs(i2["bgTop"] - i2["head"])
            A.hi("pin", dev)
            seen = c["display"] != "none" and c["visibility"] == "visible" and c["opacity"] >= 0.999 and c["covers"]
            if dev > PIN_TOL or i2["pos"] != "fixed":
                A.fail(tag, f"pin@{part}(dev={dev:.1f},position={i2['pos']},top={i2['bgTop']:.0f},head={i2['head']:.0f})")
            if not seen or i2["top"] != "canvas":
                A.fail(tag, f"canvas_not_seen@{part}(display={c['display']},visibility={c['visibility']},opacity={c['opacity']:.2f},covers={c['covers']},top_layer={i2['top']})")
    if "a" in want:
        A.hi("start", shares[0])
        A.lo("end", shares[4])
        if not 0 <= shares[0] <= START_MAX:
            A.fail(tag, f"after_start={shares[0]:.2f}")
        for i in range(3):
            if shares[i + 1] - shares[i] < STEP_MIN:
                A.fail(tag, f"after_step{i + 1}={shares[i]:.2f}->{shares[i + 1]:.2f}")
        if shares[4] < END_MIN:
            A.fail(tag, f"after_end={shares[4]:.2f}")
    if "i" in want:
        f0 = pg.evaluate("window.__sceneState.frames")
        pg.wait_for_timeout(1000)
        idle = pg.evaluate("window.__sceneState.frames") - f0
        A.hi("idle", idle)
        if idle:
            A.fail(tag, f"idle_frames@1={idle}")
        w = go(pg, T.y(0.5), P0 + P_SPAN * 0.5)
        g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET}) if w["ok"] else {"err": "settle"}
        if g.get("err") or abs(g["share"] - shares[2]) > RETURN_TOL or not spark_ok(g["spark"]):
            A.fail(tag, f"return_to_50({g.get('err') or '%.2f_vs_%.2f,spark:%s' % (g['share'], shares[2], spark_txt(g['spark']))})")
    st = pg.evaluate("({plain: !!window.__sceneState.plain, slow: window.__sceneState.slow | 0})")
    if st["plain"] or st["slow"]:                      # stepwise scrolling must never wake the watchdog
        A.fail(tag, f"watchdog_awake(plain={st['plain']},slow={st['slow']})")
    log(line + f" after={['%.2f' % s for s in shares]} pin={A.pin if A.pin is not None else 'na'}")
    return shares


def check_rebuilds(pg, tag, A, spec, T):
    """(k) phone: +-80 px of window height at the same width in the middle of the page: no rebuild, a quiet watchdog, P in place."""
    _, w, h, _, _ = spec
    go(pg, T.y(0.5))
    s0 = pg.evaluate("({r: __sceneState.rebuilds, slow: __sceneState.slow | 0, t: __sceneState.target})")
    for dh in (-80, 80, 0):
        pg.set_viewport_size({"width": w, "height": h + dh})
        pg.wait_for_timeout(450)                                         # the engine debounces resize by 150 ms
        s1 = pg.evaluate("({r: __sceneState.rebuilds, slow: __sceneState.slow | 0, t: __sceneState.target})")
        if s1["r"] != s0["r"] or s1["slow"] != s0["slow"] or abs(s1["t"] - s0["t"]) > HEIGHT_P_TOL:
            A.fail(tag, f"height{dh:+d}(rebuilds={s0['r']}->{s1['r']},slow={s0['slow']}->{s1['slow']},p={s0['t']:.3f}->{s1['t']:.3f})")
    pg.evaluate(WAIT_JS, {"exp": None, "lim": 4000, "tol": P_TOL})
    return pg.evaluate("__sceneState.rebuilds") - s0["r"]


def check_rotation(pg, tag, A, spec, T):
    """(k) the phone is turned in the middle of the page: the landscape pair, the travel of the new geometry, the pin."""
    _, w, h, _, _ = spec
    go(pg, T.y(0.5))
    pg.set_viewport_size({"width": h, "height": w})
    pg.wait_for_timeout(900)
    wt = pg.evaluate(WAIT_JS, {"exp": None, "lim": 10000, "tol": P_TOL})
    info, exp = pg.evaluate(INFO_JS), pg.evaluate(EXPECT_JS)
    g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET}) if wt["ok"] else {"err": f"settle(p={wt['p']},target={wt['target']})"}
    b, S = info["base"] or {}, info["S"] or {}
    if g.get("err") or info["tall"] or "_pc." not in (b.get("file") or "") or not S.get("ready") or S.get("plain") or S.get("failed") \
            or abs(wt["target"] - exp) > P_TOL or info["pos"] != "fixed" or abs(info["bgTop"] - info["head"]) > PIN_TOL or info["top"] != "canvas" \
            or not info["canvas"]["covers"] or g["n"] < MIN_POINTS or not 0.03 < g["share"] < 0.97 or (exp < 0.99 and not spark_ok(g["spark"])):
        A.fail(tag, f"rotation({g.get('err') or 'share=%.2f,points=%s' % (g['share'], g['n'])},file={b.get('file')},ready={S.get('ready')},p={wt['target']}_vs_{exp:.3f},"
                    f"pos={info['pos']},top_layer={info['top']})")
    pg.set_viewport_size({"width": w, "height": h})
    pg.wait_for_timeout(900)
    return g.get("share", -1)


def check_height(pg, tag, A, T):
    """(i) the page changes its height and its ends: an opened answer, a scroll past the end, a page shorter than the window."""
    go(pg, T.y(0.6))
    s0 = pg.evaluate("__sceneState.slow | 0")
    if not pg.evaluate("() => { const d = document.querySelector('#faq details'); if (!d) return false; d.open = true; return true; }"):
        A.fail(tag, "faq_details_missing")
    pg.wait_for_timeout(300)
    w, exp = pg.evaluate(WAIT_JS, {"exp": None, "lim": 6000, "tol": P_TOL}), pg.evaluate(EXPECT_JS)
    if not w["ok"] or abs(w["target"] - exp) > P_TOL or pg.evaluate("__sceneState.slow | 0") != s0:
        A.fail(tag, f"answer_opened(p={w['target']}_vs_{exp:.4f},settled={w['ok']})")
    w = go(pg, 1e9, 1.0)
    if not w["ok"]:
        A.fail(tag, f"past_the_end(p={w['p']},target={w['target']})")
    pg.evaluate("() => { for (const e of document.querySelectorAll('main > .band, footer, .scene-caps')) e.style.display = 'none'; window.scrollTo(0, 0); }")
    pg.wait_for_timeout(400)
    w = pg.evaluate(WAIT_JS, {"exp": P0, "lim": 6000, "tol": P_TOL})
    short = pg.evaluate("() => { const de = document.documentElement, S = __sceneState; return {room: de.scrollHeight - de.clientHeight, p: S.p, fin: Number.isFinite(S.p) && Number.isFinite(S.target), failed: !!S.failed}; }")
    if not w["ok"] or not short["fin"] or short["failed"] or short["room"] > 250:
        A.fail(tag, f"short_page(room={short['room']},p={short['p']},settled={w['ok']},failed={short['failed']})")


def flow_misses(info):
    """(h) the first screen and the three captions in the flow: visible, whole, apart, in the order of the markup."""
    out, b = [], info["blocks"]
    if len(b) != 4:
        return [f"blocks={len(b)}"]
    for i, x in enumerate(b):
        if not (x["vis"] and x["o"] >= VISIBLE_MIN):
            out.append(f"block{i}_hidden(o={x['o']:.2f},vis={x['vis']})")
        elif x["h"] < 20 or x["l"] < -1 or x["r"] > info["W"] + 1 or x["dt"] < info["head"] - 1.5 or x["db"] > info["docH"] + 1:
            out.append(f"block{i}_clipped(l={x['l']:.0f},r={x['r']:.0f},top={x['dt']:.0f},bottom={x['db']:.0f},doc={info['docH']:.0f})")
        for j in range(i):
            if overlap(x, b[j]):
                out.append(f"block{j}_overlaps_block{i}")
            if b[j]["dt"] >= x["dt"]:
                out.append(f"block{j}_not_above_block{i}")
    return out


def check_blocks(pg, tag, A, T, want, log):
    """(h) and (g) on an opened live page."""
    pg.evaluate("window.scrollTo(0, 0)")
    pg.wait_for_timeout(250)
    info = pg.evaluate(INFO_JS)
    if "h" in want:
        for m in flow_misses(info):
            A.fail(tag, m)
        for i, x in enumerate(info["blocks"]):              # every block can be brought under the header
            y = min(max(0.0, x["dt"] - info["head"] - 8), info["maxY"])
            pg.evaluate("y => window.scrollTo(0, y)", y)
            pg.wait_for_timeout(200)
            now = pg.evaluate(INFO_JS)["blocks"][i]
            room = info["H"] - info["head"]
            if now["t"] < info["head"] - 1.5 or (now["b"] > info["H"] + 1 and now["h"] <= room and y < info["maxY"] - 1) or not (now["vis"] and now["o"] >= VISIBLE_MIN):
                A.fail(tag, f"block{i}_unreachable(t={now['t']:.0f},b={now['b']:.0f},head={info['head']:.0f},H={info['H']})")
    if "g" in want:
        c = pg.evaluate(CONTRAST_JS, None)
        if c.get("err") or not c["inBlocks"] or not c["onGlass"]:
            A.fail(tag, f"contrast:{c.get('err') or 'no_text(blocks=%s,glass=%s)' % (c['inBlocks'], c['onGlass'])}")
        else:
            A.add("contrast", c["fail"])
            for s in c["samples"][:3]:
                A.fail(tag, f"contrast:{s}")
            log(f"  {tag} contrast: texts={c['checked']} (blocks={c['inBlocks']} glass={c['onGlass']}) fail={c['fail']} worst={c['worst']:.2f}")


def static_misses(info, kind, any_file=False):
    """(d) static page: `kind` = which picture must show (`base`/`static`); the backdrop is fixed, the blocks are in the flow."""
    out = []
    if info["live"]:
        out.append("scene-live_present")
    c = info["canvas"]
    if c and c["display"] != "none" and c["visibility"] != "hidden":
        out.append(f"canvas_displayed({c['display']},{c['visibility']})")
    pic = info[kind]
    if not (pic and pic["ok"] and pic["shown"] and pic["covers"]):
        out.append(f"{kind}_picture(file={(pic or {}).get('file')},ok={(pic or {}).get('ok')},shown={(pic or {}).get('shown')},covers={(pic or {}).get('covers')})")
    elif not any_file and ("_after_" not in pic["file"] or ("_tel." in pic["file"]) != info["tall"]):
        out.append(f"{kind}_is_not_after({pic['file']},tall={info['tall']})")
    if info["top"] != kind:
        out.append(f"top_layer={info['top']}")
    if info["pos"] != "fixed" or abs(info["bgTop"] - info["head"]) > PIN_TOL:
        out.append(f"backdrop_not_pinned({info['pos']},top={info['bgTop']:.0f},head={info['head']:.0f})")
    return out + flow_misses(info)


def static_sig(info, kind):
    return (info["live"], info["failed"], (info[kind] or {}).get("file"), info["pos"], round(info["bgTop"]), (info[kind] or {}).get("covers"), info["top"],
            tuple((round(x["dt"]), round(x["db"]), round(x["o"], 2), x["vis"]) for x in info["blocks"]))


def check_static(pg, tag, A, kind):
    """(d) one opened static page: the state at the top and the same state at three more scroll positions."""
    info = pg.evaluate(INFO_JS)
    if not info.get("ok"):
        A.fail(tag, f"no_scene(scenes={info.get('scenes')})")
        return
    for m in static_misses(info, kind):
        A.fail(tag, m)
    sig0 = static_sig(info, kind)
    for y in (info["maxY"] * 0.4, info["maxY"] * 0.8, info["maxY"]):
        pg.evaluate("y => window.scrollTo(0, y)", y)
        pg.wait_for_timeout(250)
        if static_sig(pg.evaluate(INFO_JS), kind) != sig0:
            A.fail(tag, f"changed_on_scroll@{y:.0f}")
            break


def click_cta(pg):
    cta = pg.locator("a.chrome-cta").first
    if not cta.is_visible():
        tg = pg.locator("button[data-menu-toggle]").first
        if tg.count():
            tg.click()
            pg.wait_for_timeout(350)
    cta.click(timeout=5000)


def check_anchors(pg, base, tag, A, want):
    """(f) anchors and the footer; (i) the state of the scene after a cold load of /#tarify."""
    hows = (("load", "cta", "cta_from_end") if "f" in want else ("load",)) if want & {"f", "i"} else ()
    for how in hows:
        try:
            if how == "load":
                pg.goto("about:blank")
                pg.goto(base + "/#tarify", wait_until="load", timeout=45000)      # a cold load with the fragment
            else:
                pg.goto(base + "/", wait_until="load", timeout=45000)
                settle(pg, 500)
                if how == "cta_from_end":
                    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                    pg.wait_for_timeout(500)
                click_cta(pg)
            pg.wait_for_timeout(1800)
            a = pg.evaluate(ANCHOR_JS)
            good = a["found"] and (-ANCHOR_TOL <= a["top"] <= a["off"] + ANCHOR_TOL or (a["atEnd"] and 0 <= a["top"] < a["H"]))
            if "f" in want and not good:
                A.fail(tag, f"anchor_{how}(top={a.get('top')},off={a.get('off')})")
            if how == "load" and "i" in want:
                w = pg.evaluate(WAIT_JS, {"exp": None, "lim": 6000, "tol": P_TOL})
                g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET}) if w["ok"] else {"err": f"settle(p={w['p']},target={w['target']})"}
                y, g2, w2 = pg.evaluate("scrollY"), {"err": "skipped"}, w
                if not g.get("err"):                      # the same place reached by scrolling from the top
                    go(pg, 0, P0)
                    w2 = go(pg, y)
                    g2 = pg.evaluate(GRID_JS, {"inset": SPARK_INSET}) if w2["ok"] else {"err": "settle_from_top"}
                if g.get("err") or g2.get("err") or abs(g["share"] - g2["share"]) > RETURN_TOL or not spark_ok(g["spark"]) \
                        or not 0.02 < g["share"] < END_MIN or abs(w["target"] - w2["target"]) > P_TOL:
                    A.fail(tag, f"load_at_tarify({g.get('err') or g2.get('err') or 'share=%.2f_vs_%.2f,p=%.3f,spark:%s' % (g['share'], g2['share'], w['target'], spark_txt(g['spark']))})")
        except Exception as e:
            A.fail(tag, f"anchor_{how}:{err(e)}")
    if "f" in want:
        pg.goto(base + "/", wait_until="load", timeout=45000)
        settle(pg, 500)
        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        pg.wait_for_timeout(500)
        f = pg.evaluate(FOOT_JS)
        if not (f["foot"] and f["atEnd"] and f["top"] < f["H"]):
            A.fail(tag, "footer_not_reached")


# ---------------------------------------------------------------- groups of checks
def run_full(name, browser, base, A, log, shares_at):
    """Full set of windows: a b e g h i f (+ errors of every ordinary load)."""
    want = A.want
    for spec in FULL:
        tag = f"{name}:{spec[0]}"
        ctx, sink = new_ctx(browser, spec), Sink(tag)
        try:
            pg, status = open_page(ctx, base + "/", sink)
            T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A)
            if T and want & set("abei"):
                shares_at[tag] = check_travel(pg, tag, A, T, want, log, spec)
            if T and want & set("gh"):
                check_blocks(pg, tag, A, T, want, log)
            if T and "o" in want:
                blur = pg.evaluate(BLUR_JS)
                if blur:
                    A.fail(tag, f"backdrop_filter({'+'.join(blur)})")
            vk = {"1440x900": "d", "390x844": "m"}.get(spec[0])
            if T and vk and "e" in want and name == "chromium":
                vals = []
                for k in range(9):
                    pg.evaluate("y => window.scrollTo(0, y)", T.y(k / 8))
                    pg.wait_for_timeout(200)
                    vals.append(pg.evaluate(OPEN_JS))
                A.city[vk] = sum(vals) / len(vals)
                if A.city[vk] < CITY_MIN[vk] or (vk == "m" and vals[0] < CITY_TOP_M):
                    A.fail(tag, f"city_open_{vk}={A.city[vk]:.2f}<{CITY_MIN[vk]}(top={vals[0]:.2f})")
                log(f"  {tag} city_open={['%.2f' % v for v in vals]} mean={A.city[vk]:.2f}")
            if T and vk and "i" in want:
                check_height(pg, tag, A, T)
            check_anchors(pg, base, tag, A, want)
        except Exception as e:
            A.fail(tag, err(e))
        finally:
            if "l" in want:
                sink.flush(A)
            ctx.close()


def run_geometry(name, browser, base, A, log):
    """Geometry set (Chromium): a b e k."""
    want = A.want & set("abek")
    for spec in GEOM:
        tag = f"{name}:geom:{spec[0]}"
        ctx, sink = new_ctx(browser, spec), Sink(tag)
        try:
            pg, status = open_page(ctx, base + "/", sink)
            T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A)
            if T:
                check_travel(pg, tag, A, T, want, log, spec)
                if "k" in want and spec[3]:
                    extra = f" rotation_share={check_rotation(pg, tag, A, spec, T):.2f}" if spec[0] == "390x844@2" else ""
                    log(f"  {tag} rebuilds_on_height_change={check_rebuilds(pg, tag, A, spec, T)}{extra}")
        except Exception as e:
            A.fail(tag, err(e))
        finally:
            if "l" in A.want:
                sink.flush(A)
            ctx.close()


def run_static(name, browser, base, A, log):
    """(d) reduced motion and no scripts, five windows; (g) of the static page rides along."""
    for mode, kw, kind in (("reduced_motion", dict(reduced_motion="reduce"), "base"), ("no_js", dict(java_script_enabled=False), "static")):
        for spec in FULL:
            tag = f"{name}:{mode}:{spec[0]}"
            ctx, sink = new_ctx(browser, spec, **kw), Sink(tag)
            try:
                pg, status = open_page(ctx, base + "/", sink)
                if status != 200:
                    A.fail(tag, f"http{status}")
                    continue
                if "d" in A.want:
                    check_static(pg, tag, A, kind)
                if "g" in A.want and mode == "reduced_motion":
                    c = pg.evaluate(CONTRAST_JS, None)
                    if c.get("err") or not c["inBlocks"] or not c["onGlass"]:
                        A.fail(tag, f"contrast:{c.get('err') or 'no_text'}")
                    else:
                        A.add("contrast", c["fail"])
                        for s in c["samples"][:2]:
                            A.fail(tag, f"contrast:{s}")
            except Exception as e:
                A.fail(tag, err(e))
            finally:
                if "l" in A.want:
                    sink.flush(A)
                ctx.close()
        log(f"  {name}:{mode} done")
    if name == "chromium" and "d" in A.want:                 # "still" mode: the same static backdrop by one attribute
        for spec in FAULT:
            tag = f"{name}:still:{spec[0]}"
            ctx, st, sink = new_ctx(browser, spec), {}, Sink(tag)
            lite_route(ctx, base, st, "still")
            try:
                pg, status = open_page(ctx, base + "/", sink, extra=1200)
                if st.get("patched") != 1:
                    A.fail(tag, f"still_patch:applied_{st.get('patched')}_times")
                    continue
                check_static(pg, tag, A, "base")
                if pg.evaluate("window.__sceneState ? window.__sceneState.frames : -1") != 0:
                    A.fail(tag, "still_mode_draws")
            except Exception as e:
                A.fail(tag, err(e))
            finally:
                if "l" in A.want:
                    sink.flush(A)
                ctx.close()


def run_low(name, browser, base, A, log):
    """Low windows 667x375 and 720x450@2 (= 200 % zoom): the scene is live there as well: (e) pin, (g), (h), (l)."""
    for spec in LOWS:
        tag = f"{name}:{spec[0]}"
        ctx, sink = new_ctx(browser, spec), Sink(tag)
        try:
            pg, status = open_page(ctx, base + "/", sink)
            T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A)
            if T and "e" in A.want:
                check_travel(pg, tag, A, T, {"e"}, log, spec)
            if T and A.want & set("gh"):
                check_blocks(pg, tag, A, T, A.want & set("gh"), log)
        except Exception as e:
            A.fail(tag, err(e))
        finally:
            if "l" in A.want:
                sink.flush(A)
            ctx.close()


def lite_route(ctx, base, state, mode="lite"):
    """Serve the home page with `data-scene-mode` on the backdrop (one attribute, patched in flight)."""
    def h(route):
        resp = route.fetch()
        body, n = LITE_AT.subn(r'\1 data-scene-mode="%s"' % mode, resp.text())
        state["patched"] = n
        route.fulfill(response=resp, body=body)
    ctx.route(re.compile("^" + re.escape(base) + r"/(index\.html)?(\?[^#]*)?$"), h)


GPU_JS = r"""() => { try { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info');
  return String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)); } catch (e) { return 'none:' + e.message; } }"""


def gpu_proof(browser):
    """(renderer, reasons): the proof that the video card draws the page: WebGL renderer + feature status of the GPU process."""
    bad, rend = [], "none"
    ctx = browser.new_context()
    try:
        pg = ctx.new_page()
        pg.set_content("<!doctype html><title>gpu</title>")
        rend = re.sub(r"\s+", "_", pg.evaluate(GPU_JS))[:70]
        if SOFT_GPU.search(rend):
            bad.append("renderer")
        fs = browser.new_browser_cdp_session().send("SystemInfo.getInfo").get("gpu", {}).get("featureStatus", {})
        bad += [f"{k}={fs.get(k)}" for k in GPU_FEATURES if not str(fs.get(k, "")).startswith("enabled")]
    except Exception as e:
        bad.append(type(e).__name__)
    finally:
        ctx.close()
    return rend, bad


def calibrate(ctx, spec, length):
    """Long frames of the same scripted pass over an empty long page (a busy machine shows here)."""
    cal = ctx.new_page()
    cal.set_content(BLANK_HTML % int(length + spec[2] * 2))
    cal.wait_for_timeout(300)
    cg = frame_gaps(cal.evaluate(PASS_JS, {"y0": 0, "y1": length, "ms": PASS_MS})["ts"])
    cal.close()
    return cg


# a fixed piece of script work, ms (best of three): the proof that CPU throttling is really on in this browser
BENCH_JS = r"""() => { let best = 1e9; for (let k = 0; k < 3; k++) { const t = performance.now(); let x = 0; for (let i = 0; i < 3e6; i++) x += Math.sqrt(i ^ k); best = Math.min(best, performance.now() - t); } return best; }"""


def one_pass(pg, cdp, kind, end, spec):
    """A pass over the whole page: `script` = scrollTo from requestAnimationFrame, `gesture` = the wheel gesture of the browser."""
    if kind == "script":
        return pg.evaluate(PASS_JS, {"y0": 0, "y1": end, "ms": PASS_MS})
    pg.evaluate(REC_JS)
    cdp.send("Input.synthesizeScrollGesture", {"x": spec[1] / 2, "y": spec[2] * 0.6, "yDistance": -(end + 40), "speed": max(200, int(end * 1000 / PASS_MS)),
                                               "gestureSourceType": "mouse"})
    pg.wait_for_timeout(250)
    return pg.evaluate(REC_END_JS, end)


def watch_off_route(ctx, st):
    def patch(route):
        resp = route.fetch()
        body, n = WATCH_OFF_AT.subn("SLOW = 1e9", resp.text())
        st["watch_off"] = n
        route.fulfill(response=resp, body=body)
    ctx.route(re.compile(r"/assets/scene3\.js(\?|$)"), patch)


def run_smooth(name, browser, base, A, log, lite=False, label=None, judge=False):
    """(c) calibration on an empty page, then passes over the whole page; Chromium repeats them with CPU x4.
    `judge` (Chromium with the video card): the gesture pass as well, the limits of the base, calibration after."""
    label = label or name
    for spec in ([LITE] if lite else SMOOTH):
        tag = f"{label}:{'lite:' if lite else ''}smooth:{spec[0]}"
        ctx, st = new_ctx(browser, spec), {}
        if lite:
            lite_route(ctx, base, st)
        if not judge:
            watch_off_route(ctx, st)
        try:
            pg, status = open_page(ctx, base + "/")
            T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A, lite)
            if not T:
                continue
            if not judge and st.get("watch_off") != 1:
                A.fail_c(tag, f"watch_off_patch_applied_{st.get('watch_off')}_times")
            cg = calibrate(ctx, spec, T.end)
            if cg:
                A.calib_bad.append(f"{tag}={cg}")
            cdp = ctx.new_cdp_session(pg) if name == "chromium" else None
            line = f"  {tag} calib={cg} (long/frames/paints/longest gap/p95)"
            for mode in (("nt", "cpu4") if name == "chromium" else ("nt",)):
                if mode == "cpu4":
                    b1 = pg.evaluate(BENCH_JS)
                    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                    b4 = pg.evaluate(BENCH_JS)
                    line += f" throttle=x{b4 / max(b1, 0.01):.1f}"
                    if judge and b4 < b1 * 2.5:                         # the slowdown did not take: the x4 numbers mean nothing
                        A.calib_bad.append(f"{tag}:throttle=x{b4 / max(b1, 0.01):.1f}")
                worst, runs, plain = 0, [], False
                for kind in (("script", "gesture") if judge else ("script",)):
                    for _ in range(2):
                        if plain:                                       # the plain page has no travel to settle
                            pg.evaluate("window.scrollTo(0, 0)")
                            pg.wait_for_timeout(500)
                        else:
                            w = go(pg, 0, P0, limit=20000)
                            if not w["ok"]:
                                A.fail_c(tag, f"{mode}:settle_before_pass(p={w['p']})")
                                break
                        r = one_pass(pg, cdp, kind, T.end, spec)
                        gaps = sorted(b - a for a, b in zip(r["ts"], r["ts"][1:]))
                        lg, frames = frame_gaps(r["ts"]), len(r["ts"])
                        p95 = gaps[int(len(gaps) * 0.95)] if gaps else 0.0
                        worst = max(worst, lg)
                        runs.append(f"{kind[0]}:{lg}/{frames}f/{r['paints']}p/{gaps[-1] if gaps else 0:.0f}ms/{p95:.0f}ms" + (f"/slow{r['slow']}" if r["slow"] else "") + ("/PLAIN" if r["plain"] else ""))
                        if r["plain"] or r["slow"] > SLOW_OK:
                            A.fail_c(tag, f"{mode}:{kind}:watchdog(plain={r['plain']},slow={r['slow']})")
                        if r["plain"]:
                            plain = A.plain_seen = True
                            continue
                        A.hi("p_lo", r["lo"])
                        A.lo("p_hi", r["hi"])
                        if frames < MIN_FRAMES or r["y"] < T.end - 2 or r["lo"] > 0.1 or r["hi"] < END_MIN:
                            A.fail_c(tag, f"{mode}:{kind}:pass_invalid(frames={frames},y={r['y']:.0f}/{T.end:.0f},p={r['lo']:.2f}-{r['hi']:.2f})")
                        if judge and mode == "nt" and (frames < GPU_FRAMES or r["paints"] < GPU_PAINTS or p95 > GPU_P95):
                            A.fail_c(tag, f"nt:{kind}:below_base(frames={frames}<{GPU_FRAMES}|paints={r['paints']}<{GPU_PAINTS}|p95={p95:.0f}>{GPU_P95:.0f})")
                        if mode == "cpu4":
                            A.lo("paints", r["paints"])
                            if r["paints"] < MIN_PAINTS:
                                A.fail_c(tag, f"{kind}:paints_cpu4={r['paints']}<{MIN_PAINTS}")
                if mode == "nt":
                    A.hi("long_nt", worst)
                    if worst > LONG_LIMIT_NOTHROTTLE:
                        A.fail_c(tag, f"long_frames_nothrottle={worst}")
                else:
                    A.hi("long", worst)
                    if worst > A.long_limit:
                        A.fail_c(tag, f"long_frames_cpu4={worst}>{A.long_limit}")
                    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
                line += f" {mode}={runs}"
            A.hi("slow_total", pg.evaluate("window.__sceneState.slowTotal | 0"))
            if judge:
                cg2 = calibrate(ctx, spec, T.end)
                if cg2:
                    A.calib_bad.append(f"{tag}:after={cg2}")
                line += f" calib_after={cg2}"
            log(line)
        except Exception as e:
            A.fail_c(tag, err(e))
        finally:
            ctx.close()


def run_early(browser, base, A, log):
    """(c) the page is scrolled before it has loaded (slow network): the watchdog must not blame the device for the loading."""
    spec = ("390x844", 390, 844, True, 1)
    tag = "gpu:early:390x844"
    ctx, sink = new_ctx(browser, spec), Sink(tag)
    try:
        pg = sink.attach(ctx.new_page())
        cdp = ctx.new_cdp_session(pg)
        cdp.send("Network.enable")
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150, "downloadThroughput": 200000, "uploadThroughput": 93750})
        pg.goto(base + "/", wait_until="domcontentloaded", timeout=60000)
        end = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
        r1 = pg.evaluate(PASS_JS, {"y0": 0, "y1": end, "ms": PASS_MS})
        pg.wait_for_function("() => window.__sceneState && (window.__sceneState.ready || window.__sceneState.plain || window.__sceneState.failed)", timeout=40000)
        pg.evaluate("window.scrollTo(0, 0)")
        pg.wait_for_timeout(400)
        end = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
        r2 = pg.evaluate(PASS_JS, {"y0": 0, "y1": end, "ms": PASS_MS})
        S = pg.evaluate("({plain: !!__sceneState.plain, slow: __sceneState.slow | 0, failed: !!__sceneState.failed, ready: !!__sceneState.ready, total: __sceneState.slowTotal | 0})")
        if S["plain"] or S["failed"] or not S["ready"] or S["slow"] > SLOW_OK:
            A.fail_c(tag, f"early_scroll(plain={S['plain']},failed={S['failed']},ready={S['ready']},slow={S['slow']})")
        log(f"  {tag} long_before_ready={frame_gaps(r1['ts'])} long_after={frame_gaps(r2['ts'])} slow={S['slow']} slowTotal={S['total']} plain={S['plain']}")
    except Exception as e:
        A.fail_c(tag, err(e))
    finally:
        if "l" in A.want:
            sink.flush(A)
        ctx.close()


# (n) what the page has told the outside: the event, the goal in the queue of the Metrika counter, the tab memory
GOAL_JS = r"""() => { const q = (window.ym && window.ym.a) || []; const m = document.querySelector('meta[name=build]');
  let keys = []; try { keys = Object.keys(sessionStorage).filter(k => k.startsWith('scene-plain')); } catch (e) { keys = ['error']; }
  return {events: window.__plainEvents | 0, goals: [...q].filter(c => c[1] === 'reachGoal' && c[2] === 'scene_plain').length,
          build: m ? m.getAttribute('content') : '', keys}; }"""


def busy_route(ctx, st, every):
    def patch(route):
        resp = route.fetch()
        body, n = BUSY_AT.subn(lambda m: m.group(0) + BUSY_CODE % every, resp.text())
        st["patched"] = n
        route.fulfill(response=resp, body=body)
    ctx.route(re.compile(r"/assets/scene3\.js(\?|$)"), patch)


def run_watchdog(name, browser, base, A, log):
    """(n) a device that does not keep up (a 70 ms busy loop in every frame / in every 20th frame): the page turns plain,
    stays whole and remembers that for the tab."""
    for spec in WATCHES:
        for every, passes in ((1, 1), (20, 3)):
            tag = f"{name}:watchdog:{spec[0]}:every{every}"
            ctx, st, sink = new_ctx(browser, spec), {}, Sink(tag, page_only=True)
            try:
                busy_route(ctx, st, every)
                ctx.add_init_script("window.__plainEvents = 0; document.addEventListener('scene:plain', () => { window.__plainEvents++; });")
                pg, status = open_page(ctx, base + "/", sink, extra=900)
                if st.get("patched") != 1:
                    A.calib_bad.append(f"{tag}:busy_patch_applied_{st.get('patched')}_times")
                    continue
                i0 = pg.evaluate(INFO_JS)
                if not scene_basics(i0, tag, A):
                    continue
                used = 0
                for used in range(1, passes + 1):
                    r = pg.evaluate(PASS_JS, {"y0": 0, "y1": i0["maxY"], "ms": PASS_MS})
                    if r["plain"]:
                        break
                    pg.wait_for_timeout(300)
                pg.wait_for_timeout(400)
                pg.evaluate("window.scrollTo(0, 0)")
                pg.wait_for_timeout(300)
                i1 = pg.evaluate(INFO_JS)
                S, c, b = i1["S"] or {}, i1["canvas"] or {}, i1["base"] or {}
                if not (S.get("plain") and i1["plain"]):
                    A.fail(tag, f"not_plain_after_{used}_passes(state={S.get('plain')},class={i1['plain']},slow={S.get('slow')})")
                    continue
                if i1["live"] or S.get("ready") or (c.get("display") != "none" and c.get("visibility") != "hidden"):
                    A.fail(tag, f"still_drawing(live={i1['live']},ready={S.get('ready')},canvas={c.get('display')}/{c.get('visibility')})")
                if i1["pos"] == "fixed":
                    A.fail(tag, "backdrop_still_fixed")
                if not (b.get("ok") and b.get("shown")) or "_after_" not in (b.get("file") or ""):
                    A.fail(tag, f"plain_picture(file={b.get('file')},ok={b.get('ok')},shown={b.get('shown')})")
                moved = [i for i, (x, y) in enumerate(zip(i0["blocks"], i1["blocks"])) if abs(x["dt"] - y["dt"]) > 1 or abs(x["db"] - y["db"]) > 1]
                if moved or len(i1["blocks"]) != 4 or flow_misses(i1):
                    A.fail(tag, f"layout_changed(blocks={moved},misses={len(flow_misses(i1))})")
                ev = pg.evaluate(GOAL_JS)
                if S.get("plainAt") is None or S.get("slowTotal", 0) < 8 or S.get("maxGap", 0) < LONG_MS or ev["events"] != 1:
                    A.fail(tag, f"counters(plainAt={S.get('plainAt')},slowTotal={S.get('slowTotal')},maxGap={S.get('maxGap'):.0f},events={ev['events']})")
                if ev["goals"] != 1:
                    A.fail(tag, f"metrika_goal_scene_plain_calls={ev['goals']}")
                if not ev["build"] or ev["keys"] != [f"scene-plain:{ev['build']}:full"]:
                    A.fail(tag, f"tab_memory_key({ev['keys']},build={ev['build']})")
                cst = pg.evaluate(CONTRAST_JS, None)
                if cst.get("err") or cst["fail"] or not cst["bodyOpaque"] or not cst["onGlass"]:
                    A.fail(tag, f"plain_contrast(fail={cst.get('fail')},body_opaque={cst.get('bodyOpaque')},{cst.get('err') or ''})")
                pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                pg.wait_for_timeout(400)
                f = pg.evaluate(FOOT_JS)
                if not (f["foot"] and f["atEnd"] and f["top"] < f["H"]):
                    A.fail(tag, "footer_not_reached")
                pg.reload(wait_until="load")                             # the tab remembers: plain at once, nothing is drawn
                settle(pg, 900)
                i2 = pg.evaluate(INFO_JS)
                S2, b2 = i2["S"] or {}, i2["base"] or {}
                if pg.evaluate(GOAL_JS)["goals"] != 0:
                    A.fail(tag, "metrika_goal_sent_again_after_reload")
                if not (i2["plain"] and S2.get("plain")) or i2["live"] or S2.get("frames") or i2["pos"] == "fixed" or "_after_" not in (b2.get("file") or "") or not b2.get("ok"):
                    A.fail(tag, f"reload(class={i2['plain']},state={S2.get('plain')},live={i2['live']},frames={S2.get('frames')},backdrop={i2['pos']},picture={b2.get('file')})")
                log(f"  {tag} plain after {used} pass(es) at P={S.get('plainAt'):.2f} slowTotal={S.get('slowTotal')} maxGap={S.get('maxGap'):.0f}ms backdrop={i1['pos']} reload_plain={i2['plain']}")
            except Exception as e:
                A.fail(tag, err(e))
            finally:
                sink.flush(A)
                ctx.close()


def run_watchdog_calm(browser, base, A, log):
    """(n) the negative: a healthy device (video card) with one long frame in 70 keeps the scene (three passes)."""
    for spec in WATCHES:
        tag = f"gpu:watchdog:{spec[0]}:every70"
        ctx, st = new_ctx(browser, spec), {}
        try:
            busy_route(ctx, st, 70)
            pg, status = open_page(ctx, base + "/", extra=900)
            if st.get("patched") != 1:
                A.calib_bad.append(f"{tag}:busy_patch_applied_{st.get('patched')}_times")
                continue
            i0 = pg.evaluate(INFO_JS)
            if not scene_basics(i0, tag, A):
                continue
            for _ in range(3):
                go(pg, 0, P0, limit=20000)
                r = pg.evaluate(PASS_JS, {"y0": 0, "y1": i0["maxY"], "ms": PASS_MS})
            S = pg.evaluate("({plain: !!__sceneState.plain, slow: __sceneState.slow | 0, total: __sceneState.slowTotal | 0})")
            if S["plain"] or S["slow"] > SLOW_OK or r["plain"] or not S["total"]:
                A.fail(tag, f"calm_device(plain={S['plain']},slow={S['slow']},slowTotal={S['total']})")
            log(f"  {tag} plain={S['plain']} slow={S['slow']} slowTotal={S['total']}")
        except Exception as e:
            A.fail(tag, err(e))
        finally:
            ctx.close()


def tree_of(base):
    """(served sha, same as the working tree?) of the three files the scene lives in."""
    hs, hl = hashlib.sha256(), hashlib.sha256()
    for url, rel in TREE_FILES:
        status, body = http_get(base + url)
        hs.update(body if status == 200 else f"http{status}".encode())
        try:
            hl.update((ROOT / rel).read_bytes())
        except OSError:
            hl.update(b"missing")
    return hs.hexdigest()[:12], hs.digest() == hl.digest()


def run_lite(name, browser, base, A, log):
    """(m) lite mode, Chromium 390x844: a b h (+ c in run_smooth)."""
    tag = f"{name}:lite:{LITE[0]}"
    ctx, st, sink = new_ctx(browser, LITE), {}, Sink(tag)
    lite_route(ctx, base, st)
    try:
        pg, status = open_page(ctx, base + "/", sink)
        if st.get("patched") != 1:
            A.fail(tag, f"lite_patch:applied_{st.get('patched')}_times")
            return
        T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A, lite=True)
        if T:
            check_travel(pg, tag, A, T, set("ab"), log, LITE)
            check_blocks(pg, tag, A, T, {"h"}, log)
    except Exception as e:
        A.fail(tag, err(e))
    finally:
        sink.flush(A)
        ctx.close()


def failed_page_misses(info, want_file):
    """(l) the page after an engine failure: static, the visible base picture is loaded and is the wanted file."""
    out = [] if info["failed"] else ["scene-failed_missing"]
    out += [m for m in static_misses(info, "base", any_file=True) if not m.startswith("top_layer")]
    b = info["base"] or {}
    if f"_{want_file}_" not in (b.get("file") or ""):
        out.append(f"base_is_not_{want_file}({b.get('file')})")
    if info["top"] != "base":
        out.append(f"top_layer={info['top']}")
    return out


def run_faults(name, browser, base, A, log, shares_at):
    """(l) a slow "after" picture, a missing "after" picture, a throw inside the frame."""
    after_re = re.compile(r"gorodmost_after_[a-z]+\.\w+")
    for spec in FAULT:
        # -- "after" arrives 3 s late
        tag = f"{name}:after_delayed:{spec[0]}"
        ctx, sink, held = new_ctx(browser, spec), Sink(tag), []
        try:
            ctx.route(after_re, lambda route: held.append(route))
            pg = sink.attach(ctx.new_page())
            t0 = time.monotonic()
            pg.goto(base + "/", wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_function("() => { const b = document.querySelector('img[data-scene-base]'); return b && b.complete && b.naturalWidth > 0 && !!window.__sceneState; }", timeout=20000)
            pg.wait_for_timeout(1200)
            i1 = pg.evaluate(INFO_JS)
            T = Travel(i1)
            pg.evaluate("y => window.scrollTo(0, y)", T.y(0.5))
            pg.wait_for_timeout(max(0, 2700 - (time.monotonic() - t0) * 1000))
            i2 = pg.evaluate(INFO_JS)
            for when, i in (("early", i1), ("late", i2)):
                b, S = i["base"] or {}, i["S"] or {}
                if not held or S.get("ready") or S.get("spark") or S.get("failed") or i["failed"] or i["top"] != "base" or not b.get("ok") \
                        or "_before_" not in (b.get("file") or "") or not b.get("covers") or (i["canvas"] or {}).get("visibility") == "visible":
                    A.fail(tag, f"before_ready_{when}(held={len(held)},ready={S.get('ready')},spark={S.get('spark')},failed={i['failed']},top_layer={i['top']},base={b.get('file')},ok={b.get('ok')})")
            pg.wait_for_timeout(max(0, 3000 - (time.monotonic() - t0) * 1000))
            ctx.unroute(after_re)
            for r in held:
                r.continue_()
            exp = P0 + P_SPAN * 0.5
            w = pg.evaluate(WAIT_JS, {"exp": exp, "lim": 10000, "tol": P_TOL})
            g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET}) if w["ok"] else {"err": f"settle(p={w['p']},target={w['target']})"}
            i3 = pg.evaluate(INFO_JS)
            ref = (shares_at.get(f"{name}:{spec[0]}") or [None] * 5)[2]
            if g.get("err") or i3["top"] != "canvas" or not spark_ok(g["spark"]) or (ref is not None and abs(g["share"] - ref) > RETURN_TOL) or not 0.05 < g["share"] < 0.95:
                A.fail(tag, f"after_ready({g.get('err') or 'share=%.2f_vs_%s,top_layer=%s,spark:%s' % (g['share'], ref, i3['top'], spark_txt(g['spark']))})")
            log(f"  {tag} top_layer={i1['top']}->{i3['top']} share={g.get('share', -1):.2f}")
        except Exception as e:
            A.fail(tag, err(e))
        finally:
            sink.flush(A)
            ctx.close()
        # -- "after" answers 404; a throw inside the frame with "after" loaded
        for kind, want_file in (("after_404", "before"), ("frame_throw", "after")):
            tag = f"{name}:{kind}:{spec[0]}"
            ctx, st = new_ctx(browser, spec), {}
            sink = Sink(tag, page_only=True)             # the plan asks for no script errors here; the network is broken on purpose
            try:
                if kind == "after_404":
                    ctx.route(after_re, lambda route: route.fulfill(status=404, body="not found", content_type="text/plain"))
                else:
                    def patch(route):
                        resp = route.fetch()
                        body, n = THROW_AT.subn(lambda m: m.group(0) + THROW_CODE, resp.text(), count=1)
                        st["patched"] = n
                        route.fulfill(response=resp, body=body)
                    ctx.route(re.compile(r"/assets/scene3\.js(\?|$)"), patch)
                pg, status = open_page(ctx, base + "/", sink, extra=900)
                if kind == "frame_throw" and not st.get("patched"):
                    A.fail(tag, "throw_patch:function_paintSpark_not_found_in_scene3.js")
                    continue
                info = pg.evaluate(INFO_JS)
                if not info.get("ok"):
                    A.fail(tag, "no_scene")
                    continue
                misses = failed_page_misses(info, want_file)
                for m in misses:
                    A.fail(tag, m)
                log(f"  {tag} failed={info['failed']} base={(info['base'] or {}).get('file')} misses={len(misses)}")
            except Exception as e:
                A.fail(tag, err(e))
            finally:
                sink.flush(A)
                ctx.close()


def check_files(base, A):
    """(a) sha256 of the eight scene files, fetched from the base address, against the fixture."""
    try:
        want = json.loads(FIXTURE.read_text(encoding="utf-8"))
    except Exception as e:
        A.fail("files", f"fixture_unreadable:{type(e).__name__}")
        return
    bad = []
    for fn in SCENE_FILES:
        try:
            req = urllib.request.Request(base + SCENE_DIR + fn, headers={"User-Agent": "v2-gate/1", "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=30) as r:
                got = hashlib.sha256(r.read()).hexdigest()
        except Exception as e:
            got = type(e).__name__
        if got != want.get(fn):
            bad.append(fn)
    if bad or set(want) != set(SCENE_FILES):
        A.fail("files", f"sha256_mismatch({'+'.join(bad) or 'fixture_names'})")
    print(f"  files sha256 {len(SCENE_FILES) - len(bad)}/{len(SCENE_FILES)}", flush=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--dod", action="store_true", help="long frames with CPU x4 must be 0 as well (PLAN-3 DoD-3, PLAN-4 DoD-3)")
    ap.add_argument("--only", default="", help="debug: comma-separated letters of the checks to run (never a full verdict)")
    a = ap.parse_args(argv)
    want = set(a.only.replace(",", "").lower()) or set(LETTERS)
    if not want <= set(LETTERS):
        ap.error(f"--only takes letters of {LETTERS}")
    from playwright.sync_api import sync_playwright
    A, engines, webkit_reason, t0 = Agg(want, a.dod), 0, "", time.monotonic()
    gpu, refs, tree, regress = "na", {}, "na", []
    log = lambda s: print(s, flush=True)
    n = lambda v: "na" if v is None else str(v)
    try:
        with Served(a.base) as srv, sync_playwright() as p:
            tree, same = tree_of(srv.base)
            local = bool(re.match(r"https?://(127\.0\.0\.1|localhost)[:/]", srv.base + "/"))
            log(f"  tree={tree} same_as_working_tree={same}")
            if a.dod and local and not same:
                A.fail("tree_mismatch", "the_served_files_differ_from_the_working_tree")
            if "a" in want:
                check_files(srv.base, A)
            for name in ("chromium", "webkit"):
                try:
                    br = getattr(p, name).launch()
                except Exception as e:
                    reason = re.sub(r"\s+", "_", str(e).strip().splitlines()[0])[:80] if str(e).strip() else type(e).__name__
                    if name == "webkit":
                        webkit_reason = reason
                    else:
                        A.fail("chromium_launch", reason)
                    continue
                engines += 1
                shares_at: dict = {}
                if "c" in want:                              # reference only: a software renderer does not judge smoothness
                    R = Agg(want, a.dod)
                    run_smooth(name, br, srv.base, R, log, label=f"ref_{name}")
                    key = "sw" if name == "chromium" else name
                    refs[key] = f"{n(R.long_nt)}/{n(R.long) if name == 'chromium' else '-'}"
                    refs["slow_" + key] = n(R.slow_total)
                    for k, v in ((f"{key}_nt", R.long_nt), (f"{key}_cpu4", R.long)):
                        if k in REF_MAX and v is not None and v > REF_MAX[k]:
                            regress.append(f"{k}={v}>{REF_MAX[k]}")
                if want & set("abefghil"):
                    run_full(name, br, srv.base, A, log, shares_at)
                if want & set("dg"):
                    run_static(name, br, srv.base, A, log)
                if want & set("eghl"):
                    run_low(name, br, srv.base, A, log)
                if "l" in want:
                    run_faults(name, br, srv.base, A, log, shares_at)
                if name == "chromium" and want & set("abek"):
                    run_geometry(name, br, srv.base, A, log)
                if name == "chromium" and "m" in want:
                    run_lite(name, br, srv.base, A, log)
                if "n" in want:
                    run_watchdog(name, br, srv.base, A, log)
                br.close()
            if want & set("cmn"):                            # the judged smoothness: Chromium with the video card, alone, last
                try:
                    gb = p.chromium.launch(args=GPU_ARGS)
                    gpu, bad = gpu_proof(gb)
                    log(f"  gpu renderer: {gpu} {'NOT A VIDEO CARD: ' + ','.join(bad) if bad else 'ok'}")
                    if bad:
                        A.calib_bad.append("gpu=" + "+".join(bad))
                    if "c" in want:
                        run_smooth("chromium", gb, srv.base, A, log, label="gpu", judge=True)
                        run_early(gb, srv.base, A, log)
                    if "m" in want:
                        run_smooth("chromium", gb, srv.base, A, log, lite=True, label="gpu", judge=True)
                    if "n" in want:
                        run_watchdog_calm(gb, srv.base, A, log)
                    gb.close()
                except Exception as e:
                    A.fail("gpu_chromium", err(e))
    except Exception as e:
        A.fail("gate_error", err(e))
    if engines < 2:
        A.fail("engines", f"{engines}_need_2")
    miss = A.miss + A.miss_c
    for m in miss[:60]:
        print("  FAIL", m)
    for s in A.err_samples[:8]:
        print("  error:", s)
    # a busy machine makes the smoothness numbers worthless: without other failures the verdict is `invalid`
    status = "fail" if A.miss or (A.miss_c and not A.calib_bad) else "invalid" if A.calib_bad else "ok"
    f2 = lambda v: "na" if v is None else f"{v:.2f}"
    extra = (f" only={''.join(sorted(want))}" if want != set(LETTERS) else "") + (f" calib={','.join(A.calib_bad)}" if A.calib_bad else "") \
        + (f" webkit={webkit_reason}" if webkit_reason else "") + ("" if not miss else " miss=" + ",".join(miss[:12]))
    print(f"TIME secs={time.monotonic() - t0:.0f}")
    if regress:
        print("  REFERENCE REGRESS (does not change the verdict; stop, find the reason, tell the owner):", ",".join(regress))
    print(f"SCENE status={status} engines={engines} gpu={gpu} tree={tree} after_start={f2(A.start)} after_end={f2(A.end)} "
          f"p_range={f2(A.p_lo)}-{f2(A.p_hi)} long_frames={n(A.long)} long_frames_nothrottle={n(A.long_nt)} paints_cpu4={n(A.paints)} "
          f"pin_dev={'na' if A.pin is None else '%.1f' % A.pin} contrast_fail={n(A.contrast)} idle_frames={n(A.idle)} "
          f"errors={n(A.errors) if 'l' in want else 'na'} scale_min={f2(A.scale)} city_open_d={f2(A.city.get('d'))} city_open_m={f2(A.city.get('m'))} ref_sw={refs.get('sw', 'na')} "
          f"ref_webkit={refs.get('webkit', 'na')} ref_slow_sw={refs.get('slow_sw', 'na')} ref_slow_webkit={refs.get('slow_webkit', 'na')} ref_regress={'yes' if regress else 'no'}{extra}")
    return {"ok": 0, "fail": 1, "invalid": 2}[status]


if __name__ == "__main__":
    sys.exit(main())
