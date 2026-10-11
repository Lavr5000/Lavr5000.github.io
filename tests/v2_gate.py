#!/usr/bin/env python
"""Site v2 gate (plan PLAN.md section 5 E1, 4.5.3 and 13). One SCORE line, one GATE verdict. Read-only.

    python tests/v2_gate.py [base_url] [--stage e1|e2|e3|full] [--exp NAME] [--json OUT] [--strict]

Without base_url the gate serves the working tree itself (python -m http.server on a free port, cwd = tree root)
and prints `SERVING sha=<short> dirty=<0|1> port=<n>`; with a base_url (live site, preview) it only reads.
Yandex Metrika (mc.yandex.*, yandex.ru/an) is blocked by request interception. Last line: GATE status=ok|fail miss=...
Exit code 0 = ok, 1 = fail. `--strict` is accepted for compatibility with the plan text; the verdict is always strict.

Stages (the key lists and page lists below are constants; after Э0 they are not edited):
  e1   nav_variants overflow_pages_m pages_200 page_errors csp_violations         (13 pages, no upload pages, no Transkribator)
  e2   e1 + the home-page keys (scene, image weight, versioned assets, LCP, fold, tariff cards, hidden*, dead CTA,
       small text, weight, contrast)
  e3   every key except ym_form_protected and the font size inside the open pay dialog (same 13 pages as e1)
  full everything, all 16 pages

Helpers of this file (serve, git info, Metrika block) are imported by the other v2_* gates.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parent.parent
METRIKA = re.compile(r"mc\.yandex|yandex\.ru/an")
NBSPS = "   "

# ---------------------------------------------------------------- constants (page lists, exceptions, thresholds)
ALL_PAGES = ["/", "/services/", "/products.html", "/about.html", "/blog/",
             "/blog/smeta-osnovanie-list/", "/blog/apartment-auditor/", "/blog/dva-prilozheniya/",
             "/blog/transkribator-golosom/", "/blog/ryazan-obmer-razvertki/", "/apps/transkribator/",
             "/oferta.html", "/privacy.html", "/vedomost.html", "/nakladnaya.html", "/spasibo/"]
NO_UPLOAD_PAGES = [p for p in ALL_PAGES if p not in ("/vedomost.html", "/nakladnaya.html", "/apps/transkribator/")]
BLOG_ARTICLES = [p for p in ALL_PAGES if p.startswith("/blog/") and p != "/blog/"]
HERMES_EXCLUDE = set(BLOG_ARTICLES) | {"/oferta.html", "/privacy.html"}      # llms.txt is never excluded
REMOVED_OFFERS_EXCLUDE = {"/oferta.html"}
UNREADY_EXCLUDE: set[str] = set()
CONTRAST_PAGES_E3 = ["/", "/services/"]

E1_KEYS = ["pages_200", "page_errors", "csp_violations", "overflow_pages_m", "nav_variants"]
HOME_KEYS = ["scene_home", "img_kb_home_m", "img_kb_home_d", "assets_versioned_home", "lcp_ms_home_m", "fold_360x640", "tariff_cards_home", "hidden_at_rest", "hidden_at_rest_rm", "hidden_nojs",
             "dead_cta_nojs", "small_text", "screens_m_home", "js_raw_kb_home", "js_gzip_kb_home",
             "claudecode_raw_home", "contrast_fail"]
E3_EXTRA = ["hermes_raw", "removed_offers", "unready_prices", "llms_txt_200", "tariff_prices_match",
            "pay_buttons_services", "screens_m_services"]
STAGES = {
    "e1": dict(pages=NO_UPLOAD_PAGES, keys=E1_KEYS, scope_home_only=False),
    "e2": dict(pages=NO_UPLOAD_PAGES, keys=E1_KEYS + HOME_KEYS, scope_home_only=True),
    "e3": dict(pages=NO_UPLOAD_PAGES, keys=E1_KEYS + HOME_KEYS + E3_EXTRA, scope_home_only=False),
    "full": dict(pages=ALL_PAGES, keys=E1_KEYS + HOME_KEYS + E3_EXTRA + ["ym_form_protected"], scope_home_only=False),
}
# thresholds of the scene-era keys (PLAN-3 5.1); the two image limits are tightened to "fact + 10 %" after the build
IMG_KB_HOME_M_MAX = 900     # KB of image/* response bodies, home page, 390x844, load + scroll to the footer
IMG_KB_HOME_D_MAX = 1600    # the same at 1440x900
LCP_MS_HOME_M_MAX = 2500    # Largest Contentful Paint, 390x844, CDP-throttled network
LCP_NET = dict(offline=False, latency=150, downloadThroughput=int(1.6e6 / 8), uploadThroughput=int(0.75e6 / 8))   # 1.6 / 0.75 Mbit/s, 150 ms
SCENE_PATH = "/assets/scene/"
# informational keys printed next to the gated ones (never in miss=)
INFO_KEYS = ["contrast_skipped", "pay_buttons_home", "claudecode_raw_llms", "small_text_dialog"]

CHECKS = {   # key -> predicate on the value; the verdict is the list of keys whose predicate is false
    "pages_200": lambda v: isinstance(v, str) and v.split("/")[0] == v.split("/")[1],
    "page_errors": lambda v: v == 0, "csp_violations": lambda v: v == 0, "overflow_pages_m": lambda v: v == 0,
    "nav_variants": lambda v: v == 1, "scene_home": lambda v: v == 1, "fold_360x640": lambda v: v == 1,
    "img_kb_home_m": lambda v: isinstance(v, (int, float)) and 0 < v <= IMG_KB_HOME_M_MAX,   # -1 = scene-file condition not met
    "img_kb_home_d": lambda v: isinstance(v, (int, float)) and 0 < v <= IMG_KB_HOME_D_MAX,
    "assets_versioned_home": lambda v: v == 1,
    "lcp_ms_home_m": lambda v: isinstance(v, (int, float)) and 0 < v <= LCP_MS_HOME_M_MAX,
    "tariff_cards_home": lambda v: v == 2, "hidden_at_rest": lambda v: v == 0, "hidden_at_rest_rm": lambda v: v == 0,
    "hidden_nojs": lambda v: v == 0, "dead_cta_nojs": lambda v: v == 0, "small_text": lambda v: v == 0,
    "screens_m_home": lambda v: isinstance(v, (int, float)) and 0 < v <= 9,
    "js_raw_kb_home": lambda v: isinstance(v, (int, float)) and 0 < v <= 160,
    "js_gzip_kb_home": lambda v: isinstance(v, (int, float)) and 0 < v <= 60,
    "claudecode_raw_home": lambda v: v == 0, "contrast_fail": lambda v: v == 0,
    "hermes_raw": lambda v: v == 0, "removed_offers": lambda v: v == 0, "unready_prices": lambda v: v == 0,
    "llms_txt_200": lambda v: v == 1, "tariff_prices_match": lambda v: v == 1,
    "pay_buttons_services": lambda v: isinstance(v, int) and v >= 2,
    "screens_m_services": lambda v: isinstance(v, (int, float)) and 0 < v <= 9,
    "ym_form_protected": lambda v: v == 1,
}

# ---------------------------------------------------------------- shared scaffolding (imported by the other gates)


def git_info(root: Path = ROOT) -> tuple[str, int]:
    def run(*a):
        try:
            return subprocess.run(["git", "-C", str(root), *a], capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception:
            return ""
    return run("rev-parse", "--short", "HEAD") or "unknown", 1 if run("status", "--porcelain") else 0


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Served:
    """Context manager: serve ROOT on a free port unless an external base URL is given."""

    def __init__(self, base: str | None, root: Path = ROOT):
        self.ext, self.root, self.proc, self.base = base.rstrip("/") if base else None, root, None, None

    def __enter__(self):
        if self.ext:
            self.base = self.ext
            print(f"SERVING external={self.ext}", flush=True)
            return self
        port = free_port()
        sha, dirty = git_info(self.root)
        self.proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                                     cwd=str(self.root), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", port), 0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        self.base = f"http://127.0.0.1:{port}"
        print(f"SERVING sha={sha} dirty={dirty} port={port}", flush=True)
        return self

    def __exit__(self, *exc):
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except Exception:
                self.proc.kill()
        return False


def block_metrika(ctx):
    ctx.route(METRIKA, lambda r: r.abort())


def preview_api_stub(ctx, base: str):
    """A preview on 127.0.0.1 may not call the production API (CORS refuses the origin and the log fills with noise):
    answer the read-only status probe locally. On the live site nothing is intercepted (GET only reaches the real API)."""
    if (urlparse(base).hostname or "").endswith("ai-vibes.ru"):
        return

    def h(route, request):
        cors = {"access-control-allow-origin": "*", "access-control-allow-headers": "content-type, idempotency-key",
                "access-control-allow-methods": "GET, POST, OPTIONS"}
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if request.method == "GET" and request.url.split("?")[0].endswith("/api/feature-status"):
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body='{"accounts_enabled":false,"registration_enabled":false}')
        return route.fulfill(status=404, headers=cors, content_type="application/json", body='{"error":"preview_stub"}')
    ctx.route(re.compile(r"^https://api\.ai-vibes\.ru/"), h)


def http_get(url: str, timeout: int = 30) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": "v2-gate/1", "Accept-Encoding": "identity"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def settle(pg, extra_ms: int = 500):
    try:
        pg.wait_for_load_state("networkidle", timeout=6000)
    except Exception:
        pass
    pg.wait_for_timeout(extra_ms)


# ---------------------------------------------------------------- in-page measurement
PAGE_JS = r"""(opts) => {
  const W = innerWidth, H = innerHeight, de = document.documentElement, body = document.body;
  const out = {};
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TITLE|HEAD|META|LINK)$/;
  const ownText = e => { let s = ''; for (const n of e.childNodes) if (n.nodeType === 3) s += n.nodeValue; return s.trim(); };
  const hasWord = s => /[\p{L}\p{N}]/u.test(s);
  const opac = e => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const lab = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ((typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const exempt = e => !!e.closest('dialog:not([open]), [data-menu-panel]');
  const textEls = root => [...root.querySelectorAll('*')].filter(e => {
    if (SKIP.test(e.tagName) || e.closest('svg')) return false;
    const t = ownText(e); if (!t || !hasWord(t)) return false;
    if (!e.getClientRects().length) return false;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    if (getComputedStyle(e).visibility !== 'visible') return false;
    if (exempt(e) || opac(e) < 0.05) return false;
    return true;
  });
  const vt = textEls(body);
  // overflow: scrollWidth of the root and of body (body also catches content clipped by overflow-x on the root)
  out.overflow = Math.max(de.scrollWidth, body.scrollWidth) > de.clientWidth + 1;
  out.screens = +(de.scrollHeight / H).toFixed(1);
  // small text
  const smallOf = els => els.filter(e => parseFloat(getComputedStyle(e).fontSize) < 13);
  const sm = smallOf(vt);
  out.small = sm.length;
  out.smallSamples = sm.slice(0, 5).map(e => lab(e) + ' ' + getComputedStyle(e).fontSize + ' "' + ownText(e).slice(0, 24) + '"');
  // hidden at rest
  const CAND = 'body section, body article, body aside, body figure, [data-tariff], [data-sheet], body [data-reveal], body header, body footer';
  const narrow = W < 768, spasibo = location.pathname.startsWith('/spasibo');
  const inHScroller = e => { for (let n = e.parentElement; n && n !== body; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return true; } return false; };
  const hid = [];
  for (const e of new Set(document.querySelectorAll(CAND))) {
    if (exempt(e) || e.closest('details:not([open])')) continue;
    if (spasibo && e.closest('[hidden]')) continue;
    if (e.textContent.trim().length <= 20) continue;
    const sheetNarrow = narrow && !!e.closest('[data-sheet]');
    let why = '';
    if (!e.getClientRects().length) { if (!sheetNarrow) why = 'display:none'; }
    else {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      if (cs.visibility === 'hidden') why = 'visibility:hidden';
      else if (opac(e) < 0.5) why = 'opacity ' + opac(e).toFixed(2);
      else if (r.right + scrollX <= 0 || r.bottom + scrollY <= 0 || (r.left > W + 200 && !inHScroller(e))) why = 'offscreen';
      else if (r.width < 2 || r.height < 2) why = 'collapsed';
    }
    if (why) hid.push(lab(e) + ' [' + why + ']');
  }
  out.hidden = hid.length; out.hiddenSamples = hid.slice(0, 6);
  // navigation
  let navEls = [...document.querySelectorAll('header[data-chrome] nav a, a.chrome-cta')];
  out.chrome = !!document.querySelector('header[data-chrome]');
  if (!out.chrome) navEls = [...document.querySelectorAll('header nav a, header .nav-links a, header a')];
  out.nav = [...new Set(navEls.map(a => a.textContent.trim().replace(/\s+/g, ' ') + '>' + (a.getAttribute('href') || '').replace(/^https:\/\/ai-vibes\.ru/, '')))].sort().join('|');
  // tariff buttons (for dead-CTA check without scripts)
  const btns = new Set([...document.querySelectorAll('[data-pay]'), ...document.querySelectorAll('[data-tariff] a.btn, [data-tariff] button, [data-tariff] [role=button]')]);
  out.payCount = document.querySelectorAll('[data-pay]').length;
  out.btns = [...btns].map(b => {
    const href = b.getAttribute('href'); let same = false, frag = '', fragOk = false, abs = '';
    if (href) { try { const u = new URL(b.href, location.href); abs = u.href; same = u.pathname === location.pathname; frag = decodeURIComponent(u.hash.slice(1)); fragOk = !frag || !!document.getElementById(frag); } catch (_) {} }
    return {tag: b.tagName, href, same, frag, fragOk, abs, label: b.textContent.trim().slice(0, 30)};
  });
  // Metrika protection of the pay window (markup only)
  const dlg = document.querySelector('dialog#pay-dialog'), frm = document.querySelector('form#pay-form');
  out.ym = {dialog: !!dlg, hide: !!dlg && dlg.classList.contains('ym-hide-content'), form: !!frm, keys: !!frm && frm.classList.contains('ym-disable-keys')};
  if (opts.text) out.text = body.innerText;
  // font size inside the open pay dialog
  if (opts.dialog && dlg && dlg.showModal) {
    try { dlg.showModal(); const s2 = smallOf(textEls(dlg)); out.dlgSmall = s2.length; out.dlgSamples = s2.slice(0, 4).map(e => lab(e) + ' ' + getComputedStyle(e).fontSize); dlg.close(); } catch (err) { out.dlgSmall = -1; out.dlgErr = String(err).slice(0, 80); }
  }
  // contrast on rendered pairs
  if (opts.contrast) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const g = cv.getContext('2d', {willReadFrequently: true}); const cache = new Map();
    const rgba = c => { if (cache.has(c)) return cache.get(c); g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2], d[3] / 255]; cache.set(c, v); return v; };
    const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    let fail = 0, skipped = 0, checked = 0; const samples = [];
    for (const e of vt) {
      const cs = getComputedStyle(e);
      if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text' || rgba(cs.webkitTextFillColor || cs.color)[3] === 0) { skipped++; continue; }
      const layers = []; let skip = false;
      const chain = []; for (let n = e; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
      let cum = 1; const ops = chain.map(n => (cum *= parseFloat(getComputedStyle(n).opacity), cum));   // opacity from node up to root
      for (let i = 0; i < chain.length; i++) {
        const s = getComputedStyle(chain[i]);
        if (s.backgroundImage && s.backgroundImage !== 'none') { skip = true; break; }
        const bg = rgba(s.backgroundColor);
        if (bg[3] > 0) { const eff = [bg[0], bg[1], bg[2], bg[3] * (ops[ops.length - 1] / (ops[i] / parseFloat(s.opacity)) )]; layers.push(eff); if (eff[3] >= 0.999) break; }
      }
      if (skip) { skipped++; continue; }
      let bgc = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) bgc = over(layers[i], bgc);
      const tc = rgba(cs.color); const tcol = [tc[0], tc[1], tc[2], tc[3] * ops[ops.length - 1]];
      const fg = over(tcol, bgc), l1 = lum(fg), l2 = lum(bgc), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400, large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      checked++;
      if (ratio < (large ? 3 : 4.5)) { fail++; if (samples.length < 6) samples.push(lab(e) + ' ' + ratio.toFixed(2) + ' "' + ownText(e).slice(0, 20) + '"'); }
    }
    out.contrast = {fail, skipped, checked, samples};
  }
  return out;
}"""

HOME_JS = r"""() => {
  const q = s => [...document.querySelectorAll(s)];
  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const scenes = q('section[data-scene]');
  const inScene = s => scenes.flatMap(sc => [...sc.querySelectorAll(s)]);
  const base = q('img[data-scene-base]'), canv = q('canvas[data-scene-canvas]');
  const canvasOk = c => { const s = getComputedStyle(c), r = c.getBoundingClientRect();
    return s.display !== 'none' && s.visibility === 'visible' && c.getClientRects().length > 0 && r.width > 0 && r.height > 0; };
  const sameOrigin = u => { try { return new URL(u, location.href).origin === location.origin; } catch (_) { return false; } };
  const hasV = u => { try { return new URL(u, location.href).searchParams.has('v'); } catch (_) { return false; } };
  const local = [...q('script[src]').map(e => e.getAttribute('src')), ...q('link[rel~=stylesheet][href]').map(e => e.getAttribute('href'))].filter(sameOrigin);
  return {scenes: scenes.length, stages: inScene('[data-scene-stage]').length,
          baseCount: base.length, baseLoaded: base.length > 0 && base.every(i => i.complete && i.naturalWidth > 0),
          canvasCount: canv.length, canvasVisible: canv.length > 0 && canv.every(canvasOk),
          caps: inScene('[data-scene-cap]').length, oldSheets: q('[data-sheet]').length,
          live: document.documentElement.classList.contains('scene-live'),
          localAssets: local.length, unversioned: local.filter(u => !hasV(u)),
          cards: q('[data-tariff]').map(c => ({scope: c.closest('#tarify') ? 'tarify' : 'other', id: c.getAttribute('data-tariff'),
            price: ((c.querySelector('.tariff-price') || {textContent: ''}).textContent || '').replace(/\s+/g, ' ').trim()}))};
}"""

FOLD_JS = r"""() => {
  const inFold = r => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0;
  const btns = [...document.querySelectorAll('#hero [data-pay]')].map(b => ({id: b.getAttribute('data-service-id'), ok: inFold(b.getBoundingClientRect())}));
  const got = {};
  for (const e of document.querySelectorAll('#hero *')) {
    if (e.children.length || !e.getClientRects().length) continue;
    const m = e.textContent.replace(/[\s  ]+/g, ' ').match(/(7 ?500|45 ?000) ?₽/);
    if (m && inFold(e.getBoundingClientRect())) got[m[1].replace(' ', '')] = true;
  }
  return {btns, prices: Object.keys(got).sort(), scrollY: scrollY, innerH: innerHeight};
}"""

SCRIPTS_JS = r"""() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name)).map(r => r.name)"""

INIT_CSP = "window.__csp = 0; document.addEventListener('securitypolicyviolation', () => { window.__csp++; });"


def norm_price(s: str) -> str:
    for c in NBSPS:
        s = s.replace(c, " ")
    return re.sub(r"\s+", " ", s).strip()


def flat_text(raw: str) -> str:
    """Raw HTML/text with entities decoded and every no-break space turned into a plain one (for phrase search)."""
    s = unescape(raw)
    for c in NBSPS:
        s = s.replace(c, " ")
    return s


SP = r"[ ]"
REMOVED_PATTERNS = {
    "15000_rub": re.compile(r"(?<![\d.,])(?<!\d )15 ?000(?! ?\d)\s?(?:₽|руб)|(?<!\d)15000(?!\d)"),
    "2000_rub": re.compile(r"(?<![\d.,])(?<!\d )2 ?000(?! ?\d)\s?(?:₽|руб)"),
    "pokaz_za": re.compile(r"\bпоказ\s+за\b", re.I),
    "pokazhu_agenta": re.compile(r"\bпокажу\s+агента\b", re.I),
    "legkiy_pomoshnik": re.compile(r"\bЛ[её]гкий\s+помощник", re.I),
    "dlya_kompanii": re.compile(r"\bДля компании\b"),
}
UNREADY_PATTERNS = {
    "1490": re.compile(r"(?<![\d.,])(?<!\d )1 ?490(?! ?\d)\s?(?:₽|руб)"),
    "1990": re.compile(r"(?<![\d.,])(?<!\d )1 ?990(?! ?\d)\s?(?:₽|руб)"),
    "790": re.compile(r"(?<![\d.,])(?<!\d )790(?! ?\d)\s?(?:₽|руб)"),
}
HERMES = re.compile(r"hermes", re.I)
CLAUDE_CODE = re.compile(r"claude[\s \-_]*code", re.I)


def count_patterns(text: str, patterns: dict) -> dict:
    return {k: len(p.findall(text)) for k, p in patterns.items() if p.search(text)}


def parse_services_js(src: str) -> dict:
    """id -> priceLabel.ru for the records of services.js (regex, the file is a JS literal, not JSON)."""
    res = {}
    for m in re.finditer(r"\{\s*id:\s*[\"']([\w-]+)[\"'](.*?)\n\s*\}", src, re.S):
        pl = re.search(r"priceLabel:\s*\{\s*ru:\s*[\"']([^\"']+)[\"']", m.group(2))
        if pl:
            res[m.group(1)] = pl.group(1)
    return res


def run_gate(base: str, stage: str, exp: str, out_json: str | None) -> tuple[dict, list, dict]:
    from playwright.sync_api import sync_playwright
    cfg = STAGES[stage]
    pages = cfg["pages"]
    keys = cfg["keys"]
    home_only = cfg["scope_home_only"]
    scope = ["/"] if home_only else pages
    need_text = stage in ("e3", "full")
    contrast_pages = ["/"] if stage == "e2" else CONTRAST_PAGES_E3
    want = set(keys)
    detail: dict = {"stage": stage, "base": base, "pages": pages, "rows": [], "notes": {}}
    rows: list[dict] = []
    errs_total, csp_total = 0, 0
    err_samples: list[str] = []
    skip_contrast = not ({"contrast_fail"} & want)

    with sync_playwright() as p:
        br = p.chromium.launch()

        def new_ctx(**kw):
            c = br.new_context(locale="ru-RU", **kw)
            block_metrika(c)
            preview_api_stub(c, base)
            return c

        def open_page(ctx, path, wait="load"):
            pg = ctx.new_page()
            sink = {"errs": [], "csp": 0}
            pg.add_init_script(INIT_CSP)
            pg.on("pageerror", lambda e: sink["errs"].append("pageerror " + str(e)[:110]))

            def on_console(m):
                if m.type != "error":
                    return
                url = (m.location or {}).get("url", "") or ""
                if METRIKA.search(url) or "mc.yandex" in m.text or "yandex" in url:
                    return                                    # the one intentionally blocked Metrika line
                sink["errs"].append("console " + m.text[:110])
            pg.on("console", on_console)
            status = 0
            try:
                resp = pg.goto(base + path, wait_until=wait, timeout=45000)
                status = resp.status if resp else 0
                settle(pg)
            except Exception as e:
                sink["errs"].append("GOTO " + str(e)[:90])
            return pg, status, sink

        def csp_of(pg, sink):
            n = 0
            try:
                n = pg.evaluate("window.__csp|0")
            except Exception:
                pass
            return max(n, sum(1 for e in sink["errs"] if "Content Security Policy" in e or "Refused to" in e))

        # --- main pass: every page at 390 (mobile) and 1440 (desktop)
        views = {"m": dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True),
                 "d": dict(viewport={"width": 1440, "height": 900})}
        for vk, vv in views.items():
            ctx = new_ctx(**vv)
            for path in pages:
                pg, status, sink = open_page(ctx, path)
                row = dict(path=path, view=vk, status=status, errors=len(sink["errs"]))
                row["csp"] = csp_of(pg, sink)
                if status == 200:
                    try:
                        do_contrast = (not skip_contrast) and path in contrast_pages
                        do_dialog = stage == "full" and vk == "d"
                        row.update(pg.evaluate(PAGE_JS, {"text": need_text and vk == "d", "contrast": do_contrast, "dialog": do_dialog}))
                    except Exception as e:
                        row["measure_error"] = str(e)[:120]
                errs_total += len(sink["errs"]); csp_total += row["csp"]
                err_samples += [f"{path}@{vk}: {e}" for e in sink["errs"][:2]]
                rows.append(row); pg.close()
            ctx.close()

        # --- reduced motion and no scripts (mobile width) on the pages of the scope
        extra = {"rm": {}, "nojs": {}}
        if want & {"hidden_at_rest_rm", "hidden_nojs", "dead_cta_nojs"}:
            ctx = new_ctx(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
            for path in scope:
                pg, status, sink = open_page(ctx, path)
                try:
                    extra["rm"][path] = pg.evaluate(PAGE_JS, {}) if status == 200 else {"status": status}
                except Exception as e:
                    extra["rm"][path] = {"measure_error": str(e)[:100]}
                pg.close()
            ctx.close()
            ctx = new_ctx(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, java_script_enabled=False)
            for path in scope:
                pg, status, sink = open_page(ctx, path)
                try:
                    r = pg.evaluate(PAGE_JS, {}) if status == 200 else {"status": status}
                except Exception as e:
                    r = {"measure_error": str(e)[:100]}
                if "btns" in r:
                    dead = []
                    for b in r["btns"]:
                        h = b.get("href")
                        if b["tag"] != "A" or not h or h.strip() in ("#", "") or h.lower().startswith("javascript:"):
                            dead.append(f"{b['label']!r}: not a link/empty href"); continue
                        if b["same"]:
                            if not b["fragOk"]:
                                dead.append(f"{b['label']!r}: #{b['frag']} not in page")
                        else:
                            st, body = http_get(b["abs"].split("#")[0])
                            if st != 200:
                                dead.append(f"{b['label']!r}: {b['abs']} -> {st}")
                            elif b["frag"] and f'id="{b["frag"]}"' not in body.decode("utf-8", "replace"):
                                dead.append(f"{b['label']!r}: #{b['frag']} not on target")
                    r["dead"] = dead
                extra["nojs"][path] = r
                pg.close()
            ctx.close()

        # --- home: scene / cards / fold / script weight
        home: dict = {}
        if want & {"scene_home", "assets_versioned_home", "tariff_cards_home", "tariff_prices_match", "fold_360x640", "js_raw_kb_home", "js_gzip_kb_home"}:
            for vk, vv in views.items():
                ctx = new_ctx(**vv)
                pg, status, sink = open_page(ctx, "/")
                if status == 200:
                    pg.wait_for_timeout(1200)                                  # the first scene frame
                    try:
                        home[vk] = pg.evaluate(HOME_JS)
                    except Exception as e:
                        home[vk] = {"error": str(e)[:100]}
                pg.close(); ctx.close()
            ctx = new_ctx(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
            pg, status, sink = open_page(ctx, "/")
            try:
                home["fold"] = pg.evaluate(FOLD_JS) if status == 200 else {"status": status}
            except Exception as e:
                home["fold"] = {"error": str(e)[:100]}
            pg.close(); ctx.close()
            # script weight: scroll through the page so lazy scripts load, then read the resource list
            ctx = new_ctx(viewport={"width": 1440, "height": 900})
            pg, status, sink = open_page(ctx, "/")
            urls = []
            try:
                h = pg.evaluate("document.documentElement.scrollHeight")
                for y in range(0, int(h) + 900, 600):
                    pg.evaluate("y => window.scrollTo(0, y)", y); pg.wait_for_timeout(120)
                pg.wait_for_timeout(400)
                urls = sorted(set(pg.evaluate(SCRIPTS_JS)))
            except Exception as e:
                detail["notes"]["scripts_error"] = str(e)[:100]
            pg.close(); ctx.close()
            raw_total = gz_total = 0
            sizes = {}
            for u in urls:
                if METRIKA.search(u) or "yandex" in u:
                    continue
                st, body = http_get(u)
                if st == 200:
                    sizes[u] = [len(body), len(gzip.compress(body, 9))]
                    raw_total += len(body); gz_total += sizes[u][1]
            st, html = http_get(base + "/")
            for i, m in enumerate(re.finditer(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", html.decode("utf-8", "replace"), re.S | re.I)):
                if "ld+json" in m.group(1) or "json" in m.group(1).lower():
                    continue
                b = m.group(2).encode("utf-8")
                if b.strip():
                    sizes[f"inline#{i}"] = [len(b), len(gzip.compress(b, 9))]
                    raw_total += len(b); gz_total += sizes[f"inline#{i}"][1]
            home["scripts"] = sizes
            home["raw_kb"], home["gzip_kb"] = round(raw_total / 1024, 1), round(gz_total / 1024, 1)
        # --- image weight of the home page (390 and 1440): load, scroll to the footer, sum image/* response bodies
        img: dict = {}
        if want & {"img_kb_home_m", "img_kb_home_d"}:
            for vk, vv in views.items():
                if f"img_kb_home_{vk}" not in want:
                    continue
                ctx = new_ctx(**vv)
                pg = ctx.new_page()
                got: list = []            # (url, bytes, content-type)

                def on_resp(resp, got=got):
                    try:
                        ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
                        if ct.startswith("image/"):
                            got.append((resp.url, len(resp.body()), ct))
                    except Exception:
                        pass
                pg.on("response", on_resp)
                try:
                    pg.goto(base + "/", wait_until="load", timeout=45000)
                    settle(pg)
                    h = pg.evaluate("document.documentElement.scrollHeight")
                    for y in range(0, int(h) + 900, 600):
                        pg.evaluate("y => window.scrollTo(0, y)", y); pg.wait_for_timeout(150)
                    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                    settle(pg, 800)
                except Exception as e:
                    detail["notes"][f"img_{vk}_error"] = str(e)[:100]
                pg.close(); ctx.close()
                files: dict = {}
                for u, n, ct in got:
                    files[urlparse(u).path] = files.get(urlparse(u).path, 0) + n
                scene_files = {p: n for p, n in files.items() if p.startswith(SCENE_PATH)}
                orient = "_tel" if vk == "m" else "_pc"
                names = sorted(Path(p).stem for p in scene_files)
                scene_ok = (len(scene_files) == 2 and all(n.endswith(orient) for n in names)
                            and sum("before" in n for n in names) == 1 and sum("after" in n for n in names) == 1)
                img[vk] = dict(total_kb=round(sum(files.values()) / 1024, 1), scene_kb=round(sum(scene_files.values()) / 1024, 1),
                               other_kb=round((sum(files.values()) - sum(scene_files.values())) / 1024, 1),
                               scene_files=sorted(scene_files), scene_ok=scene_ok, files={p: files[p] for p in sorted(files)})

        # --- LCP of the home page: 390x844, cache off, network throttled through CDP (1.6 Mbit/s down, 750 kbit/s up, 150 ms)
        lcp: dict = {}
        if "lcp_ms_home_m" in want:
            ctx = new_ctx(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            pg.add_init_script("window.__lcp = null; try { new PerformanceObserver(l => { const e = l.getEntries(); const x = e[e.length - 1];"
                               " if (x) window.__lcp = {t: x.startTime, size: x.size, tag: x.element ? x.element.tagName.toLowerCase() : '',"
                               " url: x.url || ''}; }).observe({type: 'largest-contentful-paint', buffered: true}); } catch (_) {}")
            try:
                cdp = ctx.new_cdp_session(pg)
                cdp.send("Network.enable")
                cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
                cdp.send("Network.emulateNetworkConditions", LCP_NET)
                pg.goto(base + "/", wait_until="load", timeout=90000)
                pg.wait_for_timeout(2500)
                lcp = pg.evaluate("window.__lcp") or {}
            except Exception as e:
                detail["notes"]["lcp_error"] = str(e)[:100]
            pg.close(); ctx.close()
        br.close()

    # ---- raw HTML scans (no browser)
    raw: dict[str, str] = {}
    status_of = {(r["path"], r["view"]): r["status"] for r in rows}
    if want & {"claudecode_raw_home", "hermes_raw", "removed_offers", "unready_prices"}:
        for path in (pages if need_text else ["/"]):
            st, body = http_get(base + path)
            if st == 200:
                raw[path] = flat_text(body.decode("utf-8", "replace"))
    llms_status, llms_body = http_get(base + "/llms.txt")
    llms = flat_text(llms_body.decode("utf-8", "replace")) if llms_status == 200 else ""
    services_status, services_src = http_get(base + "/services.js")
    services_prices = parse_services_js(services_src.decode("utf-8", "replace")) if services_status == 200 else {}

    # ---- aggregate
    S: dict = {}
    ok_rows = [r for r in rows if r["status"] == 200]
    S["pages_200"] = f"{len(ok_rows)}/{len(rows)}"
    S["page_errors"] = errs_total
    S["csp_violations"] = csp_total
    S["overflow_pages_m"] = sum(1 for r in ok_rows if r["view"] == "m" and r.get("overflow"))
    S["nav_variants"] = len({r.get("nav", "") for r in ok_rows if "nav" in r})
    inscope = lambda r: r["path"] in scope
    S["hidden_at_rest"] = sum(r.get("hidden", 0) for r in ok_rows if inscope(r))
    S["hidden_at_rest_rm"] = sum(v.get("hidden", 0) for v in extra["rm"].values()) + sum(1 for v in extra["rm"].values() if v.get("status") or v.get("measure_error"))
    S["hidden_nojs"] = sum(v.get("hidden", 0) for v in extra["nojs"].values()) + sum(1 for v in extra["nojs"].values() if v.get("status") or v.get("measure_error"))
    S["dead_cta_nojs"] = sum(len(v.get("dead", [])) for v in extra["nojs"].values())
    S["small_text"] = sum(r.get("small", 0) for r in ok_rows if inscope(r))
    dl = [r.get("dlgSmall", 0) for r in ok_rows if r["view"] == "d" and r.get("dlgSmall") is not None and r["path"] in scope]
    S["small_text_dialog"] = sum(max(x, 0) for x in dl)
    if stage == "full":
        S["small_text"] += S["small_text_dialog"]
    find = lambda path, view: next((r for r in rows if r["path"] == path and r["view"] == view), {})
    S["screens_m_home"] = find("/", "m").get("screens", -1)
    S["screens_m_services"] = find("/services/", "m").get("screens", -1)
    S["pay_buttons_services"] = find("/services/", "d").get("payCount", 0)
    S["pay_buttons_home"] = find("/", "d").get("payCount", 0)
    cf = [r["contrast"] for r in ok_rows if "contrast" in r and r["path"] in contrast_pages]
    S["contrast_fail"] = sum(c["fail"] for c in cf) if cf else -1
    S["contrast_skipped"] = sum(c["skipped"] for c in cf)
    # home
    hm, hd = home.get("m", {}), home.get("d", {})
    scene_one = lambda h: (h.get("scenes") == 1 and h.get("stages") == 1 and h.get("baseCount") == 1 and bool(h.get("baseLoaded"))
                           and h.get("canvasCount") == 1 and bool(h.get("canvasVisible")) and h.get("caps") == 3
                           and bool(h.get("live")) and h.get("oldSheets") == 0)
    S["scene_home"] = int(scene_one(hm) and scene_one(hd))
    detail["scene_home_parts"] = {vk: {k: h.get(k) for k in ("scenes", "stages", "baseCount", "baseLoaded", "canvasCount", "canvasVisible",
                                                            "caps", "live", "oldSheets")} for vk, h in (("m", hm), ("d", hd))}
    S["assets_versioned_home"] = int(bool(hd) and hd.get("localAssets", 0) > 0 and not hd.get("unversioned"))
    detail["unversioned_home"] = hd.get("unversioned", [])
    for vk in ("m", "d"):
        iv = img.get(vk)
        S[f"img_kb_home_{vk}"] = (iv["total_kb"] if iv["scene_ok"] else -1) if iv else -1
    detail["img"] = img
    S["lcp_ms_home_m"] = round(lcp["t"]) if lcp.get("t") else -1
    detail["lcp"] = lcp
    cards = [c for c in hm.get("cards", []) if c["scope"] == "tarify"]
    S["tariff_cards_home"] = len(cards)
    fd = home.get("fold", {})
    ids = {b["id"] for b in fd.get("btns", []) if b["ok"]}
    S["fold_360x640"] = int({"setup-start", "setup-vip"} <= ids and len(fd.get("btns", [])) >= 2 and all(b["ok"] for b in fd["btns"])
                            and set(fd.get("prices", [])) >= {"7500", "45000"} and fd.get("scrollY") == 0)
    S["js_raw_kb_home"] = home.get("raw_kb", -1)
    S["js_gzip_kb_home"] = home.get("gzip_kb", -1)
    # tariff_prices_match: cards (home + any [data-tariff] elsewhere) against services.js priceLabel
    mism = []
    found_ids = set()
    tariff_cards = [("/", c) for c in hd.get("cards", [])]
    ok = bool(cards) and services_status == 200
    for path, c in tariff_cards:
        if c["id"] in ("setup-start", "setup-vip"):
            found_ids.add(c["id"])
            want_p = services_prices.get(c["id"])
            if want_p is None or norm_price(c["price"]) != norm_price(want_p):
                mism.append(f"{path} {c['id']}: card {c['price']!r} vs services.js {want_p!r}")
    S["tariff_prices_match"] = int(ok and found_ids == {"setup-start", "setup-vip"} and not mism and
                                   all(i in services_prices for i in found_ids))
    detail["tariff_mismatch"] = mism
    # raw scans
    S["claudecode_raw_home"] = len(CLAUDE_CODE.findall(raw.get("/", "")))
    S["claudecode_raw_llms"] = len(CLAUDE_CODE.findall(llms))
    herm, removed, unready = {}, {}, {}
    if need_text:
        for path, t in raw.items():
            if path not in HERMES_EXCLUDE and HERMES.search(t):
                herm[path] = len(HERMES.findall(t))
            for src_name, text in (("raw", t), ("text", next((r.get("text", "") for r in rows if r["path"] == path and r["view"] == "d"), ""))):
                text = flat_text(text)
                if path not in REMOVED_OFFERS_EXCLUDE:
                    c = count_patterns(text, REMOVED_PATTERNS)
                    if c:
                        removed[f"{path}[{src_name}]"] = c
                if path not in UNREADY_EXCLUDE:
                    c = count_patterns(text, UNREADY_PATTERNS)
                    if c:
                        unready[f"{path}[{src_name}]"] = c
        if HERMES.search(llms):
            herm["/llms.txt"] = len(HERMES.findall(llms))
        for nm, pats, dst in (("removed", REMOVED_PATTERNS, removed), ("unready", UNREADY_PATTERNS, unready)):
            c = count_patterns(llms, pats)
            if c:
                dst["/llms.txt"] = c
    S["hermes_raw"] = sum(herm.values())
    S["removed_offers"] = sum(sum(c.values()) for c in removed.values())
    S["unready_prices"] = sum(sum(c.values()) for c in unready.values())
    S["llms_txt_200"] = int(llms_status == 200)
    # ym protection: every page with pay buttons has the protected dialog and form; at least one page has them
    pay_pages = [r for r in ok_rows if r["view"] == "d" and r.get("payCount", 0) > 0]
    S["ym_form_protected"] = int(bool(pay_pages) and all(r["ym"]["dialog"] and r["ym"]["hide"] and r["ym"]["form"] and r["ym"]["keys"] for r in pay_pages))

    score = {k: S[k] for k in keys}
    info = {k: S[k] for k in INFO_KEYS if k in S} if stage != "e1" else {}
    miss = [k for k in keys if not CHECKS[k](S[k])]
    detail.update(score=score, info=info, miss=miss, home=home, extra_rm=extra["rm"], extra_nojs=extra["nojs"],
                  hermes=herm, removed=removed, unready=unready, error_samples=err_samples[:20],
                  services_prices=services_prices, llms_status=llms_status)
    detail["rows"] = [{k: v for k, v in r.items() if k not in ("text", "btns")} for r in rows]
    return score, miss, {"info": info, "detail": detail}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--stage", choices=list(STAGES), default="full")
    ap.add_argument("--exp", default="run")
    ap.add_argument("--json")
    ap.add_argument("--strict", action="store_true", help="accepted for compatibility; the verdict is always strict")
    a = ap.parse_args(argv)
    try:
        with Served(a.base) as srv:
            score, miss, extra = run_gate(srv.base, a.stage, a.exp, a.json)
    except Exception as e:                                           # never die with a traceback: report as a failed gate
        print(f"GATE_ERROR {type(e).__name__}: {str(e)[:300]}")
        print("GATE status=fail miss=gate_error")
        return 1
    fmt = lambda d: " ".join(f"{k}={v}" for k, v in d.items())
    print(f"SCORE suite=site-v2 exp={a.exp}: stage={a.stage} {fmt(score)} {fmt(extra['info'])}".rstrip())
    for sample in extra["detail"]["error_samples"][:6]:
        print("  error:", sample)
    for vk, iv in extra["detail"].get("img", {}).items():
        print(f"  img_kb_home_{vk}: total={iv['total_kb']} scene={iv['scene_kb']} other={iv['other_kb']} scene_ok={int(iv['scene_ok'])}"
              f" scene_files={','.join(Path(p).name for p in iv['scene_files']) or '-'}")
    if extra["detail"].get("lcp"):
        l = extra["detail"]["lcp"]
        print(f"  lcp_ms_home_m: {round(l.get('t', 0))} element={l.get('tag')} size={l.get('size')} url={l.get('url') or '-'}")
    if extra["detail"].get("unversioned_home"):
        print("  unversioned:", ", ".join(extra["detail"]["unversioned_home"][:8]))
    if "scene_home" in extra["detail"]["score"] and not extra["detail"]["score"]["scene_home"]:
        print("  scene_home parts:", json.dumps(extra["detail"]["scene_home_parts"], ensure_ascii=False))
    if a.json:
        Path(a.json).write_text(json.dumps(extra["detail"], ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print("GATE " + ("status=ok" if not miss else "status=fail miss=" + ",".join(miss)))
    return 1 if miss else 0


if __name__ == "__main__":
    sys.exit(main())
