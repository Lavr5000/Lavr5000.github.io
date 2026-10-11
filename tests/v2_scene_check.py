#!/usr/bin/env python
"""Scroll-scene gate, one-canvas version (PLAN-3.md 5.2 with the notes of section 13).

    python tests/v2_scene_check.py [base_url] [--dod] [--only a,b,...]

Contract (PLAN-3 4.1): `section[data-scene] > [data-scene-stage] > ([data-scene-bg] > picture > img[data-scene-base],
canvas[data-scene-canvas], noscript > picture > img[data-scene-static]) + section#hero + 3 x [data-scene-cap]`;
`html.scene-live` = motion is on, `html.scene-failed` = the engine gave up; `window.__sceneState` =
{p, target, spark:[x,y]|null (CSS px inside the canvas), frames, paints, rebuilds, ready, failed, live, scale, lite}.
Travel: P = 0.03 + 0.97 * (scrollY - y0) / span, y0 = scene top - sticky offset of the stage, span = scene height -
stage height (taken from the page geometry). After every scroll the gate waits for p === target and a stopped loop.
Windows: full set (both engines) 360x640, 390x844, 844x390, 820x1180, 1440x900; geometry set (Chromium; a, b, e, k)
344x882, 960x950, 1000x1190, 1000x1210, 1024x768, 1920x1080, 2560x1440, 390x844@2; low window 667x375 (both engines).
Checks (latin letter = letter of the plan: a=а b=б c=в d=г e=д f=е g=ж h=з i=и k=к l=л m=м):
  a. state: the canvas against two references the gate draws itself (files before/after of the current orientation,
     "cover" into the stage box); 64x64 grid, points inside 170 px around the spark and points where the references
     differ by < 24 (sum of channels) are skipped; share of points closer to "after": start <= 0.12, +>= 0.05 on
     each of 0-25, 25-50, 50-75 %, end >= 0.98 (lite mode: mean blend share); start equals "before" (mean <= 12),
     end equals "after" (<= 12) and differs from "before" (>= 15); the base picture is the `before` file;
     sha256 of the eight scene files equals fixtures/v2_scene_files.json;
  b. spark: at 0/25/50/75 % the point of the state is inside the stage (8 px inset) and the canvas there is lighter
     than both references by >= 30 with luminance >= 200, or luminance >= 245; at the end there is no spark and
     every grid point equals "after";
  c. smoothness: gaps > 50 ms between requestAnimationFrame callbacks, a 3 s pass from the top of the travel to the
     end of the container, twice, the worse counts; valid only with >= 60 frames, the end reached, P from <= 0.1 to
     >= 0.98; 1440x900, 390x844, 390x844@2; limit 0 without throttling (both engines), <= 5 with CPU x4 (Chromium;
     `--dod`: 0); scene repaints during a x4 pass >= 30 (paints_cpu4). Before each window the same pass over an
     empty long page must give 0 long frames, otherwise the verdict is `invalid` (busy machine), never `ok`;
  d. reduced motion and no scripts (both engines, five windows): no scene-live, canvas not displayed, the picture
     (base / static) is the loaded `after` file, covers the stage and is the top backdrop layer, the stage is not
     pinned, the first screen and three captions are visible and do not overlap, scrolling changes nothing;
     low window 667x375 with scripts and no motion: all four blocks reachable, not clipped, not overlapping;
  e. pin: at 25/50/75 % the stage top stands at its sticky offset under the header (+-2 px), the canvas is visible
     (display, visibility, opacity 1), covers the stage and is the top backdrop layer (elementsFromPoint);
  f. anchors: /#tarify and `a.chrome-cta` put the block under the header (+-40 px); the page scrolls to the footer;
  g. text on the stage: colour of the backdrop chain laid over the brightest spot (99th percentile of luminance) of
     the visible part of both pictures against the text colour >= 4.5 (3.0 large)             -> contrast_fail;
  h. blocks: in the middle of its travel window (first screen P <= 0.06; captions 0.2-0.36, 0.48-0.64, >= 0.76) a
     block is opaque (>= 0.99), wholly inside the stage and under the header, the other blocks are hidden;
     667x375: either motion with whole blocks or no motion and the low-window check of (d);
  i. rest: frames do not grow for 1 s (idle_frames); back from the end to 50 % the share returns (+-0.05) and the
     spark is there; a load of /#tarify gives share >= 0.98 and no spark;
  k. canvas scale at rest >= 1.0 up to 1920x1080, >= 0.8 at 2560x1440, >= 1.5 at density 2 (scale_min); on phone
     windows +-80 px of window height at the same width does not rebuild the buffers;
  l. errors: page errors, console errors, failed requests = 0 (Metrika is blocked) on every ordinary load; "after"
     delayed by 3 s: until it arrives the top layer is the base `before` picture and there is no spark, then the
     state follows P; "after" answers 404: scene-failed, static page, the visible base picture is the loaded
     `before` file and covers the stage; a throw inside the frame (scene3.js patched in flight): scene-failed, the
     visible base picture is the loaded `after` file;
  m. lite mode (Chromium 390x844, `data-scene-mode="lite"` patched into the page in flight): a, b, c, h.
Last line: SCENE status=ok|fail|invalid engines=N after_start=.. after_end=.. p_range=.. long_frames=..
           long_frames_nothrottle=.. paints_cpu4=.. pin_dev=.. contrast_fail=.. idle_frames=.. errors=.. scale_min=..
           [only=..] [calib=..] [webkit=reason] [miss=..]
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
from v2_gate import Served, block_metrika, settle   # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "v2_scene_files.json"
SCENE_DIR = "/assets/scene/"
SCENE_FILES = [f"gorodmost_{k}_{o}.{e}" for k in ("before", "after") for o in ("pc", "tel") for e in ("webp", "jpg")]
# (label, width, height, mobile, density)
FULL = [("360x640", 360, 640, True, 1), ("390x844", 390, 844, True, 1), ("844x390", 844, 390, True, 1),
        ("820x1180", 820, 1180, True, 1), ("1440x900", 1440, 900, False, 1)]
GEOM = [("344x882", 344, 882, True, 1), ("960x950", 960, 950, False, 1), ("1000x1190", 1000, 1190, False, 1),
        ("1000x1210", 1000, 1210, False, 1), ("1024x768", 1024, 768, False, 1), ("1920x1080", 1920, 1080, False, 1),
        ("2560x1440", 2560, 1440, False, 1), ("390x844@2", 390, 844, True, 2)]
LOW = ("667x375", 667, 375, True, 1)
SMOOTH = [("1440x900", 1440, 900, False, 1), ("390x844", 390, 844, True, 1), ("390x844@2", 390, 844, True, 2)]
FAULT = [("390x844", 390, 844, True, 1), ("1440x900", 1440, 900, False, 1)]
LITE = ("390x844", 390, 844, True, 1)
LETTERS = "abcdefghiklm"
# thresholds (PLAN-3 5.2; not to be loosened)
LONG_MS, LONG_LIMIT, LONG_LIMIT_NOTHROTTLE, PASS_MS, MIN_FRAMES, MIN_PAINTS = 50, 5, 0, 3000, 60, 30
START_MAX, STEP_MIN, END_MIN, RETURN_TOL = 0.12, 0.05, 0.98, 0.05
RGB_MAX, REF_DELTA_MIN, END_POINT_MAX, MIN_POINTS = 12.0, 15.0, 40.0, 400
SPARK_LUM, SPARK_GAIN, SPARK_WHITE, SPARK_INSET = 200, 30, 245, 8
PIN_TOL, ANCHOR_TOL, VISIBLE_MIN, HIDDEN_MAX = 2.0, 40, 0.99, 0.01
P0, P_SPAN, P_TOL = 0.03, 0.97, 0.004                       # engine: P = 0.03 + 0.97 * share of the travel
BLOCK_WIN = [(P0, 0.06), (0.2, 0.36), (0.48, 0.64), (0.76, 1.0)]   # fully visible ranges, constant WIN of scene3.js
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
const shown = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility === 'visible';
const file = u => (u || '').split('?')[0].split('/').pop();
const covers = (e, box) => { if (!e || !box) return false; const a = rc(e), b = rc(box); return a.l <= b.l + 2 && a.t <= b.t + 2 && a.r >= b.r - 2 && a.b >= b.b - 2; };
const headB = () => { const h = document.querySelector('header[data-chrome]'); if (!h) return 0; const p = getComputedStyle(h).position; return p === 'fixed' || p === 'sticky' ? h.getBoundingClientRect().bottom : 0; };
const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const state = () => S ? {p: S.p, target: S.target, spark: S.spark ? [S.spark[0], S.spark[1]] : null, frames: S.frames, paints: S.paints,
  rebuilds: S.rebuilds, ready: !!S.ready, failed: !!S.failed, live: !!S.live, scale: S.scale, lite: !!S.lite} : null;
/* the top backdrop layer in the middle of the visible part of the stage; the backdrop ignores the pointer, so for
   the moment of the hit test it is made hittable through CSSOM (no style element: the page has a CSP) */
const topLayer = () => {
  const st = rc(stage), x = (Math.max(st.l, 0) + Math.min(st.r, innerWidth)) / 2, y = (Math.max(st.t, 0) + Math.min(st.b, innerHeight)) / 2;
  if (!(x >= 0 && x < innerWidth && y >= 0 && y < innerHeight) || st.b <= 0 || st.t >= innerHeight) return 'offscreen';
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
  const de = document.documentElement, sr = rc(scene), st = rc(stage), css = getComputedStyle(stage);
  const pic = e => e ? {file: file(e.currentSrc || e.src), ok: e.complete && e.naturalWidth > 0, shown: shown(e), covers: covers(e, stage)} : null;
  const ccs = cv ? getComputedStyle(cv) : null, cr = cv ? rc(cv) : null;
  return {ok: true, scenes, W: innerWidth, H: innerHeight, y: scrollY, maxY: de.scrollHeight - innerHeight, docH: de.scrollHeight,
    live: root.classList.contains('scene-live'), failed: root.classList.contains('scene-failed'), tall, S: state(),
    sceneTop: sr.t + scrollY, sceneH: sr.h, sceneL: sr.l, sceneR: sr.r, stageTop: st.t, stageDocTop: st.t + scrollY, stageH: stage.offsetHeight,
    stageB: st.b, stageL: st.l, stageR: st.r, pos: css.position, sticky: parseFloat(css.top) || 0, head: headB(),
    base: pic(base), static: pic(stat), canvases: bg.querySelectorAll('canvas').length,
    canvas: cv ? {display: ccs.display, visibility: ccs.visibility, opacity: opac(cv), covers: covers(cv, stage), w: cv.width, h: cv.height,
                  scale: cr.w > 0 && cr.h > 0 ? Math.min(cv.width / cr.w, cv.height / cr.h) : 0} : null,
    caps: caps.length, hero: !!hero, top: topLayer(),
    blocks: blocks.map(e => { const r = rc(e); return {vis: shown(e) && r.w > 1 && r.h > 1, o: opac(e), l: r.l, t: r.t, r: r.r, b: r.b, dt: r.t + scrollY, db: r.b + scrollY}; })};
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
  if (sp) { const st = rc(stage), c = rc(cv), vx = c.l + sp[0], vy = c.t + sp[1], I = arg.inset;
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
PASS_JS = r"""({y0, y1, ms}) => new Promise(res => {
  const S = window.__sceneState || {}, ts = [], pa = S.paints | 0, t0 = performance.now(); let lo = 9, hi = -9;
  window.scrollTo(0, y0);
  const f = t => { ts.push(t); if (typeof S.p === 'number') { if (S.p < lo) lo = S.p; if (S.p > hi) hi = S.p; }
    const k = Math.min(1, (t - t0) / ms); window.scrollTo(0, y0 + (y1 - y0) * k);
    if (k < 1) requestAnimationFrame(f); else res({ts, lo, hi, paints: (S.paints | 0) - pa, y: scrollY}); };
  requestAnimationFrame(f);
})"""
BLANK_HTML = "<!doctype html><meta charset=utf-8><title>calibration</title><body style='margin:0;background:#fff'><div style='height:%dpx'></div>"
# (g) contrast of the text of the given blocks over the brightest spot of both pictures
CONTRAST_JS = js(r"""
  let R; try { R = await refs(); } catch (e) { return {err: String(e.message || e)}; }
  if (!R.bright) R.bright = [R.b, R.a].map(c => {                      /* colour of the 99th percentile of luminance */
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[Math.round(luma(d, i))]++;
    let k = 0, acc = 0; const need = d.length / 4 * 0.99; for (; k < 255; k++) { acc += hist[k]; if (acc >= need) break; }
    let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (Math.round(luma(d, i)) === k) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return [r / n, g / n, b / n, 1]; });
  const t = document.createElement('canvas'); t.width = t.height = 1; const g1 = t.getContext('2d', {willReadFrequently: true}), cache = new Map();
  const rgba = c => { if (cache.has(c)) return cache.get(c); g1.clearRect(0, 0, 1, 1); g1.fillStyle = '#000'; g1.fillStyle = c; g1.fillRect(0, 0, 1, 1);
    const d = g1.getImageData(0, 0, 1, 1).data, a = d[3] / 255, v = a ? [d[0], d[1], d[2], a] : [0, 0, 0, 0]; cache.set(c, v); return v; };
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const own = e => [...e.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.nodeValue));
  const lab = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '') + '"' + e.textContent.trim().slice(0, 16) + '"';
  let checked = 0, fail = 0, worst = 99; const samples = [];
  for (const bi of arg.blocks) { const blk = blocks[bi]; if (!blk) continue;
    for (const e of [blk, ...blk.querySelectorAll('*')]) {
      if (e.closest('svg') || !own(e) || !shown(e)) continue;
      const cs = getComputedStyle(e), r = rc(e); if (r.w < 2 || r.h < 2) continue;
      /* backdrop chain from the text up to the stage: every layer is a list of alternatives (a gradient = its stops) */
      const layers = [];
      for (let n = e; n && n !== stage; n = n.parentElement) { const s = getComputedStyle(n), o = opac(n), alts = [];
        const stops = s.backgroundImage && s.backgroundImage !== 'none' ? (s.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []) : [];
        const bc = rgba(s.backgroundColor);
        if (stops.length) { for (const c of stops) { const v = rgba(c), a = v[3] + bc[3] * (1 - v[3]), m = k => a ? (v[k] * v[3] + bc[k] * bc[3] * (1 - v[3])) / a : 0; alts.push([m(0), m(1), m(2), a * o]); } }
        else if (bc[3] > 0) alts.push([bc[0], bc[1], bc[2], bc[3] * o]);
        if (alts.length) { layers.push(alts); if (alts.every(a => a[3] >= 0.999)) break; } }
      const tc = rgba(cs.color), text = [tc[0], tc[1], tc[2], tc[3] * opac(e)];
      let ratio = 99; const walk = (i, bgc) => { if (i < 0) { const fg = over(text, bgc), l1 = lum(fg), l2 = lum(bgc); ratio = Math.min(ratio, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)); return; }
        for (const a of layers[i]) walk(i - 1, over(a, bgc)); };
      for (const px of R.bright) walk(layers.length - 1, px);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400, large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      checked++; if (ratio < worst) worst = ratio;
      if (ratio < (large ? 3 : 4.5)) { fail++; if (samples.length < 4) samples.push(lab(e) + '=' + ratio.toFixed(2)); }
    } }
  return {checked, fail, worst, samples, bright: R.bright.map(c => c.slice(0, 3).map(Math.round))};
""", True)
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
    """Scroll positions of the scene travel, from the geometry of the page."""

    def __init__(self, info):
        self.y0 = max(0.0, info["sceneTop"] - info["sticky"])
        self.span = info["sceneH"] - info["stageH"]
        self.end = min(info["maxY"], info["sceneTop"] + info["sceneH"])          # end of the container
        self.ok = self.span >= 50 and self.y0 + self.span <= info["maxY"] + 1

    def y(self, part):
        return self.y0 + self.span * part

    def y_of_p(self, p):
        return self.y((p - P0) / P_SPAN)


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
    T = Travel(info)
    if not T.ok:
        A.fail(tag, f"travel(span={T.span:.0f},y0={T.y0:.0f},maxY={info['maxY']:.0f})")
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
            dev = max(abs(i2["stageTop"] - i2["sticky"]), abs(i2["stageTop"] - i2["head"]) if i2["head"] else 0)
            A.hi("pin", dev)
            seen = c["display"] != "none" and c["visibility"] == "visible" and c["opacity"] >= 0.999 and c["covers"]
            if dev > PIN_TOL or i2["pos"] != "sticky":
                A.fail(tag, f"pin@{part}(dev={dev:.1f},position={i2['pos']},top={i2['stageTop']:.0f},sticky={i2['sticky']:.0f},head={i2['head']:.0f})")
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
    log(line + f" after={['%.2f' % s for s in shares]} pin={A.pin if A.pin is not None else 'na'}")
    return shares


def check_rebuilds(pg, tag, A, spec):
    """(k) phone: +-80 px of window height at the same width must not rebuild the buffers."""
    _, w, h, _, _ = spec
    r0 = pg.evaluate("window.__sceneState.rebuilds")
    for dh in (-80, 80, 0):
        pg.set_viewport_size({"width": w, "height": h + dh})
        pg.wait_for_timeout(450)                                         # the engine debounces resize by 150 ms
    pg.evaluate(WAIT_JS, {"exp": None, "lim": 4000, "tol": P_TOL})
    r1 = pg.evaluate("window.__sceneState.rebuilds")
    if r1 != r0:
        A.fail(tag, f"rebuilds_on_height_change={r0}->{r1}")
    return r1 - r0


def block_misses(info, i, where):
    """(h) block i at the middle of its window: opaque, inside the stage, under the header, the others hidden."""
    out, b = [], info["blocks"]
    if i >= len(b):
        return [f"{where}:missing"]
    me = b[i]
    inside = me["l"] >= info["stageL"] - 1 and me["r"] <= info["stageR"] + 1 and me["t"] >= info["stageTop"] - 1 and me["b"] <= info["stageB"] + 1
    if not (me["vis"] and me["o"] >= VISIBLE_MIN):
        out.append(f"{where}:not_visible(o={me['o']:.2f},vis={me['vis']})")
    elif not inside or me["t"] < info["head"] - 1.5 or me["r"] > info["W"] + 1 or me["l"] < -1:
        out.append(f"{where}:clipped(t={me['t']:.0f},b={me['b']:.0f},stage={info['stageTop']:.0f}..{info['stageB']:.0f},head={info['head']:.0f})")
    for j, o in enumerate(b):
        if j != i and o["vis"] and o["o"] > HIDDEN_MAX:
            out.append(f"{where}:block{j}_also_visible(o={o['o']:.2f},overlap={overlap(me, o)})")
    return out


def check_blocks(pg, tag, A, T, want, log):
    """(h) and (g) on an opened live page."""
    checked = failed = 0
    worst = 99.0
    for i, (a, b) in enumerate(BLOCK_WIN):
        mid = (a + b) / 2
        w = go(pg, T.y_of_p(mid), mid)
        if not w["ok"]:
            A.fail(tag, f"settle@block{i}(p={w['p']},target={w['target']})")
            continue
        if "h" in want:
            for m in block_misses(pg.evaluate(INFO_JS), i, f"block{i}@P{mid:.2f}"):
                A.fail(tag, m)
        if "g" in want:
            c = pg.evaluate(CONTRAST_JS, {"blocks": [i]})
            if c.get("err") or not c["checked"]:
                A.fail(tag, f"contrast_block{i}:{c.get('err') or 'no_text'}")
                continue
            checked, failed, worst = checked + c["checked"], failed + c["fail"], min(worst, c["worst"])
            for s in c["samples"][:2]:
                A.fail(tag, f"contrast:{s}")
    if "g" in want:
        A.add("contrast", failed)
        log(f"  {tag} contrast: texts={checked} fail={failed} worst={worst:.2f}")


def static_misses(info, kind, low=False):
    """(d) static page: `kind` = which picture must show (`base`/`static`), blocks visible, whole, apart."""
    out = []
    if info["live"]:
        out.append("scene-live_present")
    c = info["canvas"]
    if c and c["display"] != "none" and c["visibility"] != "hidden":
        out.append(f"canvas_displayed({c['display']},{c['visibility']})")
    pic = info[kind]
    if not (pic and pic["ok"] and pic["shown"] and pic["covers"]):
        out.append(f"{kind}_picture(file={(pic or {}).get('file')},ok={(pic or {}).get('ok')},shown={(pic or {}).get('shown')},covers={(pic or {}).get('covers')})")
    elif not low and ("_after_" not in pic["file"] or ("_tel." in pic["file"]) != info["tall"]):
        out.append(f"{kind}_is_not_after({pic['file']},tall={info['tall']})")
    if info["top"] not in (kind, "offscreen"):
        out.append(f"top_layer={info['top']}")
    if info["pos"] in ("sticky", "fixed"):
        out.append(f"stage_pinned({info['pos']})")
    b = info["blocks"]
    if len(b) != 4:
        out.append(f"blocks={len(b)}")
    sc_t, sc_b = info["sceneTop"], info["sceneTop"] + info["sceneH"]
    for i, x in enumerate(b):
        if not (x["vis"] and x["o"] >= VISIBLE_MIN):
            out.append(f"block{i}_hidden(o={x['o']:.2f})")
        elif x["dt"] < sc_t - 1 or x["db"] > min(sc_b, info["docH"]) + 1 or x["l"] < info["sceneL"] - 1 or x["r"] > info["sceneR"] + 1:
            out.append(f"block{i}_clipped(top={x['dt']:.0f},bottom={x['db']:.0f},scene={sc_t:.0f}..{sc_b:.0f},l={x['l']:.0f},r={x['r']:.0f})")
        for j in range(i):
            if overlap(x, b[j]):
                out.append(f"block{j}_overlaps_block{i}")
    return out


def static_sig(info, kind):
    return (info["live"], info["failed"], (info[kind] or {}).get("file"), round(info["stageDocTop"]), info["pos"],
            tuple((round(x["dt"]), round(x["db"]), round(x["o"], 2), x["vis"]) for x in info["blocks"]))


def check_static(pg, tag, A, kind, low=False):
    """(d) one opened static page: the state at the top and the same state at three more scroll positions."""
    info = pg.evaluate(INFO_JS)
    if not info.get("ok"):
        A.fail(tag, f"no_scene(scenes={info.get('scenes')})")
        return
    for m in static_misses(info, kind, low):
        A.fail(tag, m)
    sig0 = static_sig(info, kind)
    for y in (info["sceneTop"] + info["sceneH"] * 0.4, info["sceneTop"] + info["sceneH"] * 0.8, info["maxY"]):
        pg.evaluate("y => window.scrollTo(0, y)", min(y, info["maxY"]))
        pg.wait_for_timeout(250)
        if static_sig(pg.evaluate(INFO_JS), kind) != sig0:
            A.fail(tag, f"changed_on_scroll@{y:.0f}")
            break
    if low:                                                             # every block can be brought into the window
        if info["blocks"] and max(x["db"] for x in info["blocks"]) > info["docH"] + 1:
            A.fail(tag, "block_below_document")


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
                pg.evaluate(WAIT_JS, {"exp": 1, "lim": 6000, "tol": P_TOL})
                g = pg.evaluate(GRID_JS, {"inset": SPARK_INSET})
                if g.get("err") or g["share"] < END_MIN or g["spark"]:
                    A.fail(tag, f"load_at_tarify({g.get('err') or 'share=%.2f,spark=%s' % (g['share'], bool(g['spark']))})")
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
                    go(pg, T.y0, P0)
                    log(f"  {tag} rebuilds_on_height_change={check_rebuilds(pg, tag, A, spec)}")
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
                    c = pg.evaluate(CONTRAST_JS, {"blocks": [0, 1, 2, 3]})
                    if c.get("err") or not c["checked"]:
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


def run_low(name, browser, base, A, log):
    """Low window 667x375: (h) one of two outcomes, the low-window part of (d), (l) errors."""
    tag = f"{name}:{LOW[0]}"
    ctx, sink = new_ctx(browser, LOW), Sink(tag)
    try:
        pg, status = open_page(ctx, base + "/", sink)
        info = pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}
        if not info.get("ok"):
            A.fail(tag, f"no_scene(scenes={info.get('scenes')})")
        elif info["live"]:
            T = scene_basics(info, tag, A)
            if T and "h" in A.want:
                check_blocks(pg, tag, A, T, {"h"}, log)
            log(f"  {tag} outcome=motion")
        else:
            if A.want & set("dh"):
                check_static(pg, tag, A, "base", low=True)
            log(f"  {tag} outcome=static picture={(info['base'] or {}).get('file')}")
    except Exception as e:
        A.fail(tag, err(e))
    finally:
        if "l" in A.want:
            sink.flush(A)
        ctx.close()


def lite_route(ctx, base, state):
    """Serve the home page with `data-scene-mode="lite"` on the backdrop (one attribute, patched in flight)."""
    def h(route):
        resp = route.fetch()
        body, n = LITE_AT.subn(r'\1 data-scene-mode="lite"', resp.text(), count=1)
        state["patched"] = n
        route.fulfill(response=resp, body=body)
    ctx.route(re.compile("^" + re.escape(base) + r"/(index\.html)?(\?[^#]*)?$"), h)


def run_smooth(name, browser, base, A, log, lite=False):
    """(c) calibration on an empty page, then two passes over the scene; Chromium repeats them with CPU x4."""
    for spec in ([LITE] if lite else SMOOTH):
        tag = f"{name}:{'lite:' if lite else ''}smooth:{spec[0]}"
        ctx, st = new_ctx(browser, spec), {}
        if lite:
            lite_route(ctx, base, st)
        try:
            pg, status = open_page(ctx, base + "/")
            T = scene_basics(pg.evaluate(INFO_JS) if status == 200 else {"ok": False, "scenes": f"http{status}"}, tag, A, lite)
            if not T:
                continue
            cal = ctx.new_page()
            cal.set_content(BLANK_HTML % int(T.end - T.y0 + spec[2] * 2))
            cal.wait_for_timeout(300)
            cg = frame_gaps(cal.evaluate(PASS_JS, {"y0": 0, "y1": T.end - T.y0, "ms": PASS_MS})["ts"])
            cal.close()
            if cg:
                A.calib_bad.append(f"{tag}={cg}")
            line = f"  {tag} calib={cg} (long/frames/paints/longest gap)"
            for mode in (("nt", "cpu4") if name == "chromium" else ("nt",)):
                cdp = None
                if mode == "cpu4":
                    cdp = ctx.new_cdp_session(pg)
                    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                worst, runs = 0, []
                for _ in range(2):
                    w = go(pg, T.y0, P0, limit=20000)
                    if not w["ok"]:
                        A.fail_c(tag, f"{mode}:settle_before_pass(p={w['p']})")
                        break
                    r = pg.evaluate(PASS_JS, {"y0": T.y0, "y1": T.end, "ms": PASS_MS})
                    lg, frames = frame_gaps(r["ts"]), len(r["ts"])
                    worst = max(worst, lg)
                    runs.append(f"{lg}/{frames}f/{r['paints']}p/{max((b - a for a, b in zip(r['ts'], r['ts'][1:])), default=0):.0f}ms")
                    A.hi("p_lo", r["lo"])
                    A.lo("p_hi", r["hi"])
                    if frames < MIN_FRAMES or r["y"] < T.end - 2 or r["lo"] > 0.1 or r["hi"] < END_MIN:
                        A.fail_c(tag, f"{mode}:pass_invalid(frames={frames},y={r['y']:.0f}/{T.end:.0f},p={r['lo']:.2f}-{r['hi']:.2f})")
                    if mode == "cpu4":
                        A.lo("paints", r["paints"])
                        if r["paints"] < MIN_PAINTS:
                            A.fail_c(tag, f"paints_cpu4={r['paints']}<{MIN_PAINTS}")
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
            log(line)
        except Exception as e:
            A.fail_c(tag, err(e))
        finally:
            ctx.close()


def run_lite(name, browser, base, A, log):
    """(m) lite mode, Chromium 390x844: a b h (+ c in run_smooth)."""
    tag = f"{name}:lite:{LITE[0]}"
    ctx, st, sink = new_ctx(browser, LITE), {}, Sink(tag)
    lite_route(ctx, base, st)
    try:
        pg, status = open_page(ctx, base + "/", sink)
        if not st.get("patched"):
            A.fail(tag, "lite_patch:attribute_data-scene-bg_not_found_in_home_page")
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
    run_smooth(name, browser, base, A, log, lite=True)


def failed_page_misses(info, want_file):
    """(l) the page after an engine failure: static, the visible base picture is loaded and is the wanted file."""
    out = [] if info["failed"] else ["scene-failed_missing"]
    out += [m for m in static_misses(info, "base", low=True) if not m.startswith("top_layer")]
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
    ap.add_argument("--dod", action="store_true", help="long frames with CPU x4 must be 0 as well (PLAN-3 DoD-3)")
    ap.add_argument("--only", default="", help="debug: comma-separated letters of the checks to run (never a full verdict)")
    a = ap.parse_args(argv)
    want = set(a.only.replace(",", "").lower()) or set(LETTERS)
    if not want <= set(LETTERS):
        ap.error(f"--only takes letters of {LETTERS}")
    from playwright.sync_api import sync_playwright
    A, engines, webkit_reason, t0 = Agg(want, a.dod), 0, "", time.monotonic()
    log = lambda s: print(s, flush=True)
    try:
        with Served(a.base) as srv, sync_playwright() as p:
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
                if "c" in want:
                    run_smooth(name, br, srv.base, A, log)
                if want & set("abefghil"):
                    run_full(name, br, srv.base, A, log, shares_at)
                if want & set("dg"):
                    run_static(name, br, srv.base, A, log)
                if want & set("dhl"):
                    run_low(name, br, srv.base, A, log)
                if "l" in want:
                    run_faults(name, br, srv.base, A, log, shares_at)
                if name == "chromium" and want & set("abek"):
                    run_geometry(name, br, srv.base, A, log)
                if name == "chromium" and "m" in want:
                    run_lite(name, br, srv.base, A, log)
                br.close()
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
    n = lambda v: "na" if v is None else str(v)
    extra = (f" only={''.join(sorted(want))}" if want != set(LETTERS) else "") + (f" calib={','.join(A.calib_bad)}" if A.calib_bad else "") \
        + (f" webkit={webkit_reason}" if webkit_reason else "") + ("" if not miss else " miss=" + ",".join(miss[:12]))
    print(f"TIME secs={time.monotonic() - t0:.0f}")
    print(f"SCENE status={status} engines={engines} after_start={f2(A.start)} after_end={f2(A.end)} "
          f"p_range={f2(A.p_lo)}-{f2(A.p_hi)} long_frames={n(A.long)} long_frames_nothrottle={n(A.long_nt)} paints_cpu4={n(A.paints)} "
          f"pin_dev={'na' if A.pin is None else '%.1f' % A.pin} contrast_fail={n(A.contrast)} idle_frames={n(A.idle)} "
          f"errors={n(A.errors) if 'l' in want else 'na'} scale_min={f2(A.scale)}{extra}")
    return {"ok": 0, "fail": 1, "invalid": 2}[status]


if __name__ == "__main__":
    sys.exit(main())
