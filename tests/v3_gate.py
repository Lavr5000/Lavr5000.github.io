#!/usr/bin/env python
"""Site v3 gate (plan site-v3-2026-11 PLAN.md section 1.1). One SCORE line, one GATE verdict. Read-only.

    python tests/v3_gate.py [base_url] [--exp NAME] [--json OUT] [--only k1,k2] [--no-webkit]
    python tests/v3_gate.py --capture-fixtures      # Э0 only: pay_bodies.json, metrika_pages.json, site2_baseline.json
    python tests/v3_gate.py --shots DIR             # screenshots of every page, 360/390/1440, reduced motion

Without base_url the gate serves its own tree on a free port (helpers of v2_gate.py) and checks that the served SHA
is HEAD of this tree. With a base_url (live site) the file-based keys are computed on the local tree of the same SHA,
the gate prints `SKIPPED ...`, and a skipped key of the groups redirects/pay/consent/scene/nav fails the gate.

Reference data comes only from tests/fixtures/ (commit T of the window, never edited by the IA executor):
  redirects.json   {"/services/": {"default": "/#tarify", "anchors": {"#vip": "/#vip", ...}}, "/about.html": {...}}
  menu.json        {"items": [{"label": ..., "href": ...}, ...], "cta": {"label": "Выбрать тариф", "href": "/#tarify"},
                    "active": {"<page path>" or "<prefix>*": "<href of the active item>"}}  (unlisted page: no active item)
  assets/redirect-map.js must carry the same table as JSON between /* map:begin */ and /* map:end */.
  pay_bodies.json  service id -> what the button opens and the request body it sends (taken from /services/ at 22934bd)
  metrika_pages.json  pages that load metrika.js at 22934bd
  site2_baseline.json font KB and CLS of the site2 pages at 22934bd
  scene2/<name>_p0_{pc,tel}.png  test-mode first frames of the scenes

Metrika referrer (checked 14.11.2026 on yandex.ru/support/metrica/ru/code/counter-initialize and .../objects/hit):
`init` has no referrer option; `hit(url, {referer})` has one. So the redirect pages hand the referrer over through
sessionStorage `av-ref`, metrika.js inits with `defer: true` and sends one `hit` with `referer`.

Scene contract (S-B / S-R): section[data-scene2="<name>"] > div.scene2-stage (or [data-scene2-stage]) > canvas[data-scene2-canvas] +
img[data-scene2-poster], captions [data-scene2-cap]; html.scene2-live while the canvas runs; `?scene-test=1` freezes time and exposes
window.__scene2.go(P) (renders progress P synchronously); the guard fires document event `scene:plain`.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2_gate import (ALL_PAGES, INIT_CSP, METRIKA, PAGE_JS, ROOT, Served, block_metrika, git_info,  # noqa: E402
                     http_get, preview_api_stub, settle)

BASE_SHA = "22934bd"
FIX = ROOT / "tests" / "fixtures"
PAGES = ALL_PAGES + ["/rieltor/"]
SCENES = {"builders": ("/products.html", "crane"), "rieltor": ("/rieltor/", "deal")}
RIELTOR_LABEL_EXPECTED = "Для риелторов"
REDIRECT_PAGE_FILES = {"services/index.html", "about.html"}
OLD_LINK_EXEMPT = REDIRECT_PAGE_FILES | {"assets/redirect-map.js", "rieltor/uslugi.catalog.js", "uslugi.catalog.js"}
PUBLISHED_EXT = {".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".webmanifest"}
OLD_LINK = re.compile(r"/services(?=[/?#\"'\s)]|$)|about\.html")
PAY_IGNORE_FIELDS = {"site", "place"}          # source fields, allowed to differ between /services/ and /
TOKEN_CSS = ["assets/site3.css", "assets/chrome.css", "rieltor/rieltor.css", "assets/site2.css", "assets/legal2.css"]
SCENE_JS = re.compile(r"/assets/(scene2/|scene-guard|scene2|js-flag)")
ICON_EXEMPT = re.compile(r"\.svg$|favicon|apple-touch|/brand/")
UTM = "utm_source=x&utm_campaign=y"
REF = "https://t.me/s/ai_vibes_test"
THR = dict(frame_gap_p95_ms=34, js_gzip_kb_scene=12, img_kb_scene_m=120, img_kb_scene_d=220, lcp_ms_m=2500,
           ssim_p0=0.97, ssim_p1=0.95, ssim_diff=0.8, a11y_pc=2.6, a11y_tel=2.2)
# keys whose absence in remote mode fails the gate
REMOTE_REQUIRED = re.compile(r"^(redirect|pay_|consent|scene|nav)")

NAMED = ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood "
         "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray "
         "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen "
         "darkslateblue darkslategray darkturquoise darkviolet deeppink deepskyblue dimgray dodgerblue firebrick floralwhite "
         "forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo "
         "ivory khaki lavender lawngreen lemonchiffon lightblue lightcoral lightcyan lightgray lightgreen lightgrey lightpink "
         "lightsalmon lightseagreen lightskyblue lightslategray lightsteelblue lightyellow lime limegreen linen magenta maroon "
         "mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumturquoise midnightblue mintcream mistyrose "
         "moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegreen paleturquoise palevioletred "
         "papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon "
         "sandybrown seagreen seashell sienna silver skyblue slateblue slategray snow springgreen steelblue tan teal thistle "
         "tomato turquoise violet wheat white whitesmoke yellow yellowgreen").split()
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:" + "|".join(NAMED) + r")\b", re.I)

YM_STUB = """(() => { window.__ym = []; const f = function () { window.__ym.push([...arguments].map(a => {
  try { return JSON.parse(JSON.stringify(a === undefined ? null : a)); } catch (_) { return String(a); } })); };
  Object.defineProperty(window, 'ym', {configurable: true, get: () => f, set: () => {}}); })();"""

DOM_JS = r"""() => {
  const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
  const dup = Object.entries(ids).filter(([k, n]) => n > 1).map(([k, n]) => k + 'x' + n);
  const old = [...document.querySelectorAll('[href]')].map(a => a.getAttribute('href') || '')
    .filter(h => /\/services(?=[\/?#"'\s)]|$)|about\.html/.test(h.replace(/^https?:\/\/ai-vibes\.ru/, '')));
  const nav = [...document.querySelectorAll('header[data-chrome] nav a')].map(a => ({label: a.textContent.trim().replace(/\s+/g, ' '),
    href: (a.getAttribute('href') || '').replace(/^https:\/\/ai-vibes\.ru/, ''), cur: a.getAttribute('aria-current') === 'page'}));
  const cta = [...document.querySelectorAll('header[data-chrome] a.chrome-cta')].map(a => ({label: a.textContent.trim().replace(/\s+/g, ' '),
    href: (a.getAttribute('href') || '').replace(/^https:\/\/ai-vibes\.ru/, '')}));
  const metrika = [...document.scripts].some(s => /\/assets\/metrika\.js/.test(s.src));
  return {dup, old, nav, cta, metrika};
}"""

TARIFF_JS = r"""() => {
  const q = s => [...document.querySelectorAll(s)], has = id => !!document.getElementById(id);
  const full = ['service-5', 'vip', 'service-rieltor'];
  const pays = q('a[data-pay]'), reqs = q('a[data-request]');
  const shortCards = q('#tarify [data-pay]').filter(b => !full.some(id => b.closest('#' + id))).length;
  const legalIn = sel => { const r = document.querySelector(sel); if (!r) return [false, false];
    const hs = [...r.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
    return [hs.some(h => /oferta\.html/.test(h)), hs.some(h => /privacy\.html/.test(h))]; };
  return {ids: Object.fromEntries(['service-5', 'vip', 'service-rieltor', 'compare', 'support'].map(i => [i, has(i)])),
    pay: pays.length, req: reqs.length, shortCards, tarify: legalIn('#tarify'), dialog: legalIn('#pay-dialog')};
}"""

CONSENT_JS = r"""() => {
  const out = {};
  for (const e of document.querySelectorAll('[id^="pay-consent-text"], [data-consent-for]'))
    out[(e.id || '') + '|' + (e.getAttribute('data-consent-for') || '')] = e.textContent.replace(/\s+/g, ' ').trim();
  for (const e of document.querySelectorAll('[data-consent-version]'))
    out['v:' + (e.getAttribute('data-service-id') || e.id)] = e.getAttribute('data-consent-version');
  const c = window.AI_PAY || {}; out['cfg:consentVersion'] = c.consentVersion || ''; out['cfg:consentVersions'] = JSON.stringify(c.consentVersions || {});
  return out;
}"""

LEGAL_JS = r"""() => { const b = document.body.cloneNode(true);
  b.querySelectorAll('[data-chrome], [data-chrome-foot], script, style, noscript').forEach(e => e.remove());
  return b.textContent.replace(/\s+/g, ' ').trim(); }"""

SCENE_JS_PROBE = r"""(name) => {
  const s = document.querySelector('section[data-scene2="' + name + '"]') || document.querySelector('section[data-scene2]');
  if (!s) return {present: false};
  const stage = s.querySelector('[data-scene2-stage], .scene2-stage'), cv = s.querySelector('canvas[data-scene2-canvas]'), po = s.querySelector('img[data-scene2-poster]');
  const link = [...document.querySelectorAll('a[href^="#"]')].find(a => /К услугам/i.test(a.textContent) && a.getBoundingClientRect().top < innerHeight);
  const target = link ? document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1))) : null;
  return {present: true, live: document.documentElement.classList.contains('scene2-live'), stage: !!stage,
    canvasHidden: !!cv && cv.getAttribute('aria-hidden') === 'true', posterAlt: !!po && !!(po.getAttribute('alt') || '').trim(),
    posterSrc: po ? (po.currentSrc || po.src) : '', posterLoaded: !!po && po.complete && po.naturalWidth > 0,
    link: !!link, targetTop: target ? target.getBoundingClientRect().top + scrollY : -1, H: innerHeight,
    top: s.getBoundingClientRect().top + scrollY, height: s.offsetHeight};
}"""


# ---------------------------------------------------------------- helpers
def git(*a, root: Path = ROOT) -> str:
    return subprocess.run(["git", "-C", str(root), *a], capture_output=True, text=True, timeout=60).stdout.strip()


def tree_of(rev: str) -> Path:
    """Export the tree of a revision once into the temp dir (cached by full SHA) and return its path."""
    sha = git("rev-parse", rev)
    dst = Path(tempfile.gettempdir()) / "v3_gate_trees" / sha[:12]
    if (dst / ".done").exists():
        return dst
    dst.mkdir(parents=True, exist_ok=True)
    data = subprocess.run(["git", "-C", str(ROOT), "archive", "--format=tar", sha], capture_output=True, timeout=120).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        t.extractall(dst, filter="data")
    (dst / ".done").write_text(sha)
    return dst


def load_fixture(name: str):
    p = FIX / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def published_files(root: Path) -> list[Path]:
    drop = set()
    pd = root / ".github" / "pages-drop.txt"
    if pd.exists():
        drop = {l.strip().strip("/") for l in pd.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}
    out = []
    for p in root.rglob("*"):
        rel = p.relative_to(root).as_posix()
        if not p.is_file() or rel.startswith((".git", ".github")) or rel.split("/")[0] in drop or rel in drop:
            continue
        if p.suffix.lower() in PUBLISHED_EXT:
            out.append(p)
    return out


def css_colors(text: str) -> list[str]:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    hits = []
    for m in re.finditer(r"([-\w]+)\s*:\s*([^;{}]+)", text):
        val = re.sub(r"url\([^)]*\)", "", m.group(2))
        if m.group(1).startswith("--") and "tokens" in m.group(0):
            continue
        hits += [h for h in COLOR.findall(val)]
    return hits


def hex_outside_tokens(root: Path) -> tuple[int, dict]:
    det: dict = {}
    for rel in TOKEN_CSS:
        p = root / rel
        if p.exists():
            n = len(css_colors(p.read_text(encoding="utf-8", errors="replace")))
            if n:
                det[rel] = n
    for p in published_files(root):
        rel = p.relative_to(root).as_posix()
        if ICON_EXEMPT.search(rel):
            continue
        if p.suffix == ".html":
            t = p.read_text(encoding="utf-8", errors="replace")
            n = sum(len(css_colors("x{" + m.group(1) + "}")) for m in re.finditer(r"\sstyle=\"([^\"]*)\"", t))
            n += sum(1 for m in re.finditer(r"\s(?:fill|stroke)=\"([^\"]*)\"", t) if COLOR.search(m.group(1)))
            if n:
                det[rel] = n
        elif p.suffix == ".js" and SCENE_JS.search("/" + rel):
            n = len(COLOR.findall(p.read_text(encoding="utf-8", errors="replace")))
            if n:
                det[rel] = n
    return sum(det.values()), det


def old_links_files(root: Path) -> tuple[int, dict]:
    det = {}
    for p in published_files(root):
        rel = p.relative_to(root).as_posix()
        if rel in OLD_LINK_EXEMPT:
            continue
        n = len(OLD_LINK.findall(p.read_text(encoding="utf-8", errors="replace")))
        if n:
            det[rel] = n
    return sum(det.values()), det


def redirect_map_js(root: Path):
    p = root / "assets" / "redirect-map.js"
    if not p.exists():
        return None
    t = p.read_text(encoding="utf-8")
    try:                                   # the table sits between /* map:begin */ and /* map:end */ as a JSON literal
        t = t.split("/* map:begin */", 1)[1].split("/* map:end */", 1)[0]
        return json.loads(t[t.index("{"): t.rindex("}") + 1])
    except Exception:
        return "unparsable"


def redirect_cases(rmap: dict) -> list[tuple[str, str]]:
    """(source URL, expected path+query+hash) for every variant of every page of the map."""
    cases = []
    for page, spec in rmap.items():
        srcs = [page]
        if page.endswith("/"):
            srcs += [page.rstrip("/"), page + "index.html"]
        anchors = dict(spec.get("anchors", {}))
        for src in srcs:
            variants = [("", spec["default"]), ("#zz-unknown", spec["default"])] + [(a, t) for a, t in anchors.items()]
            for frag, tgt in variants:
                for q in ("", UTM):
                    path, _, h = tgt.partition("#")
                    exp = path + ("?" + q if q else "") + ("#" + h if h else "")
                    cases.append((src + ("?" + q if q else "") + frag, exp))
    return cases


def ssim(a: bytes, b_path: Path) -> float:
    import numpy as np
    from PIL import Image
    from skimage.metrics import structural_similarity
    if not b_path.exists():
        return -1.0
    A = Image.open(io.BytesIO(a)).convert("L")
    B = Image.open(b_path).convert("L").resize(A.size)
    return float(structural_similarity(np.asarray(A), np.asarray(B), data_range=255))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


# ---------------------------------------------------------------- the gate
class Gate:
    def __init__(self, base: str, remote: bool, only: set | None, webkit: bool):
        self.base, self.remote, self.only, self.webkit = base, remote, only, webkit
        self.S: dict = {}
        self.D: dict = {"notes": {}}
        self.skipped: list[str] = []

    def want(self, *keys) -> bool:
        return not self.only or bool(self.only & set(keys))

    # contexts --------------------------------------------------------
    def ctx(self, br, ym=False, **kw):
        c = br.new_context(locale="ru-RU", **kw)
        block_metrika(c)
        preview_api_stub(c, self.base)
        c.add_init_script(INIT_CSP)
        if ym:
            c.add_init_script(YM_STUB)
        return c

    def open(self, c, path, wait="load", referer=None):
        pg = c.new_page()
        sink = {"errs": []}
        pg.on("pageerror", lambda e: sink["errs"].append("pageerror " + str(e)[:110]))

        def on_console(m):
            url = (m.location or {}).get("url", "") or ""
            if m.type == "error" and not (METRIKA.search(url) or "yandex" in m.text or "yandex" in url):
                sink["errs"].append("console " + m.text[:110])
        pg.on("console", on_console)
        status = 0
        try:
            r = pg.goto(self.base + path, wait_until=wait, timeout=45000, referer=referer)
            status = r.status if r else 0
            settle(pg, 300)
        except Exception as e:
            sink["errs"].append("GOTO " + str(e)[:90])
        return pg, status, sink

    # groups ----------------------------------------------------------
    def files(self):
        root = ROOT
        if self.want("old_links_in_site"):
            n, det = old_links_files(root)
            self.D["old_links_files"] = det
            self.S["old_links_in_site"] = n          # the DOM part is added in pages()
        if self.want("hex_outside_tokens"):
            self.S["hex_outside_tokens"], self.D["hex"] = hex_outside_tokens(root)
        if self.want("nav_ok"):
            src = (root / "scripts" / "build_chrome.py").read_text(encoding="utf-8")
            m = re.search(r"^RIELTOR_LABEL\s*=\s*[\"']([^\"']+)", src, re.M)
            self.D["rieltor_label"] = m.group(1) if m else None
        if self.want("redirects_ok"):
            fx, js = load_fixture("redirects.json"), redirect_map_js(root)
            self.D["redirect_map_same"] = fx is not None and js == fx
            self.D["redirect_fixture"] = fx is not None

    def pages(self, p):
        rows, errs, csp = [], 0, 0
        menu = load_fixture("menu.json")
        ym_pages = []
        for vk, vv in {"m": dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True),
                       "d": dict(viewport={"width": 1440, "height": 900})}.items():
            br = p.chromium.launch()
            for path in PAGES:
                c = self.ctx(br, ym=True, **vv)                       # a fresh context per page: clean sessionStorage
                pg, status, sink = self.open(c, path)
                row = dict(path=path, view=vk, status=status, errors=len(sink["errs"]), err=sink["errs"][:2])
                if status == 200:
                    try:
                        pg.wait_for_timeout(300)
                        row["csp"] = pg.evaluate("window.__csp|0")
                        row.update(pg.evaluate(DOM_JS))
                        row["page"] = pg.evaluate(PAGE_JS, {"contrast": vk == "d" and self.want("contrast_fail")})
                        ym = pg.evaluate("window.__ym || []")
                        row["pageviews"] = sum(1 for a in ym if len(a) > 1 and a[1] == "hit") + \
                            sum(1 for a in ym if len(a) > 2 and a[1] == "init" and not (a[2] or {}).get("defer"))
                    except Exception as e:
                        row["measure_error"] = str(e)[:120]
                errs += len(sink["errs"])
                csp += row.get("csp", 0)
                rows.append(row)
                c.close()
            br.close()
        ok = [r for r in rows if r["status"] == 200]
        self.S["pages_200"] = f"{len(ok)}/{len(rows)}"
        self.D["pages_200_bad"] = [f"{r['path']}@{r['view']}={r['status']}" for r in rows if r["status"] != 200]
        self.S["console_errors"] = errs
        self.S["csp_violations"] = csp
        self.D["error_samples"] = [f"{r['path']}@{r['view']}: {e}" for r in rows for e in r.get("err", [])][:8]
        self.S["duplicate_ids"] = sum(len(r.get("dup", [])) for r in ok if r["view"] == "d")
        self.D["duplicate_ids"] = {r["path"]: r["dup"] for r in ok if r.get("dup") and r["view"] == "d"}
        dom_old = {r["path"]: r["old"] for r in ok if r.get("old") and r["view"] == "d"}
        self.D["old_links_dom"] = dom_old
        if "old_links_in_site" in self.S:
            self.S["old_links_in_site"] += sum(len(v) for k, v in dom_old.items() if k not in ("/services/", "/about.html"))
        # nav
        if self.want("nav_ok"):
            bad = []
            if not menu:
                bad.append("no fixture menu.json")
            else:
                exp = [(i["label"], i["href"]) for i in menu["items"]]
                for r in ok:
                    if r["path"] in ("/services/", "/about.html"):
                        continue
                    got = [(n["label"], n["href"]) for n in r.get("nav", [])]
                    if got != exp:
                        bad.append(f"{r['path']}@{r['view']}: {got}")
                    elif [c["href"] for c in r.get("cta", [])][:1] != [menu["cta"]["href"]]:
                        bad.append(f"{r['path']}@{r['view']}: cta {r.get('cta')}")
                    else:
                        act = next((h for k, h in menu.get("active", {}).items()
                                    if r["path"] == k or (k.endswith("*") and r["path"].startswith(k[:-1]))), None)
                        cur = [n["href"] for n in r["nav"] if n["cur"]]
                        if cur != ([act] if act else []):
                            bad.append(f"{r['path']}@{r['view']}: active {cur} != {act}")
            if self.D.get("rieltor_label") != RIELTOR_LABEL_EXPECTED:
                bad.append(f"RIELTOR_LABEL={self.D.get('rieltor_label')!r}")
            self.S["nav_ok"] = 0 if bad else 1
            self.D["nav_bad"] = bad[:12]
        # metrika
        if self.want("metrika_pageviews"):
            mp = load_fixture("metrika_pages.json")
            if mp is None:
                self.S["metrika_pageviews"] = "nofixture"
            else:
                bad = [f"{r['path']}@{r['view']}={r.get('pageviews')}" for r in ok
                       if r["path"] in mp and r["path"] not in ("/services/", "/about.html") and r.get("pageviews") != 1]
                self.S["metrika_pageviews"] = f"{sum(1 for r in ok if r['path'] in mp and r['path'] not in ('/services/', '/about.html')) - len(bad)}/" \
                                              f"{sum(1 for r in ok if r['path'] in mp and r['path'] not in ('/services/', '/about.html'))}"
                self.D["metrika_bad"] = bad
        # contrast (DOM)
        cf = [r["page"]["contrast"] for r in ok if r.get("page", {}).get("contrast")]
        self.S["contrast_fail"] = sum(c["fail"] for c in cf)
        self.D["contrast_samples"] = [s for c in cf for s in c["samples"]][:8]
        self.D["rows"] = rows
        return ok

    def nojs_rm(self, p):
        res = {"nojs": {}, "rm": {}}
        br = p.chromium.launch()
        base_kw = dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        for mode, kw in (("nojs", dict(java_script_enabled=False)), ("rm", dict(reduced_motion="reduce"))):
            for path in PAGES:
                c = self.ctx(br, **base_kw, **kw)
                pg, status, sink = self.open(c, path)
                try:
                    res[mode][path] = pg.evaluate(PAGE_JS, {}) if status == 200 else {"status": status}
                except Exception as e:
                    res[mode][path] = {"measure_error": str(e)[:100]}
                c.close()
        br.close()
        bad = lambda v: v.get("hidden", 0) + (1 if v.get("status") or v.get("measure_error") else 0)
        self.S["hidden_nojs"] = sum(bad(v) for k, v in res["nojs"].items() if k not in ("/services/", "/about.html"))
        self.S["hidden_at_rest_rm"] = sum(bad(v) for k, v in res["rm"].items() if k not in ("/services/", "/about.html"))
        self.D["hidden_samples"] = {f"{m}:{k}": v.get("hiddenSamples") for m in res for k, v in res[m].items() if v.get("hidden")}

    def overflow(self, p):
        bad = []
        engines = [("chromium", p.chromium)] + ([("webkit", p.webkit)] if self.webkit else [])
        for en, bt in engines:
            br = bt.launch()
            for w in (360, 390):
                c = self.ctx(br, viewport={"width": w, "height": 800}, has_touch=True, **({"is_mobile": True} if en == "chromium" else {}))
                for path in PAGES:
                    pg, status, sink = self.open(c, path)
                    try:
                        o = pg.evaluate("() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > document.documentElement.clientWidth + 1")
                    except Exception:
                        o = True
                    if status != 200 or o:
                        bad.append(f"{en}:{w}:{path}")
                    pg.close()
                c.close()
            br.close()
        self.S["overflow_pages_m"] = len(bad)
        self.D["overflow_bad"] = bad
        if not self.webkit:
            self.D["notes"]["overflow"] = "webkit skipped (--no-webkit)"

    def redirects(self, p):
        fx = load_fixture("redirects.json")
        if fx is None:
            self.S["redirects_ok"] = "nofixture"
            return
        cases = redirect_cases(fx)
        bad = []
        br = p.chromium.launch()
        for src, exp in cases:
            c = self.ctx(br)
            pg, status, sink = self.open(c, src)
            pg.wait_for_timeout(1000)
            u = urlparse(pg.url)
            got = u.path + ("?" + u.query if u.query else "") + ("#" + u.fragment if u.fragment else "")
            if got != exp:
                bad.append(f"{src} -> {got} (want {exp})")
            c.close()
        # without JS: meta refresh to the default target, a visible link to it
        for page, spec in fx.items():
            c = self.ctx(br, java_script_enabled=False)
            pg, status, sink = self.open(c, page)
            pg.wait_for_timeout(1500)
            want_path = spec["default"].split("#")[0]
            if urlparse(pg.url).path != want_path:
                bad.append(f"nojs {page} -> {urlparse(pg.url).path} (want {want_path})")
            c.close()
            c = self.ctx(br, java_script_enabled=False)
            st, body = http_get(self.base + page)
            if spec["default"] not in body.decode("utf-8", "replace").split("<body", 1)[-1]:
                bad.append(f"nojs {page}: no visible link to {spec['default']}")
            c.close()
        br.close()
        n = len(cases) + 2 * len(fx)
        if not self.D.get("redirect_map_same"):
            bad.insert(0, "assets/redirect-map.js != tests/fixtures/redirects.json")
        self.S["redirects_ok"] = f"{n - len(bad)}/{n}" + ("" if n >= 40 else "(N<40)")
        self.D["redirects_bad"] = bad[:15]

    def referrer(self, p):
        br = p.chromium.launch()
        out = []

        def run(src, ref, final_path):
            c = self.ctx(br, ym=True)
            pg, status, sink = self.open(c, src, referer=ref)
            pg.wait_for_timeout(1500)
            ym = pg.evaluate("window.__ym || []")
            hits = [a for a in ym if len(a) > 1 and a[1] == "hit"]
            refs = [(a[3] or {}).get("referer") if len(a) > 3 and isinstance(a[3], dict) else None for a in hits]
            dref = pg.evaluate("document.referrer")
            path = urlparse(pg.url).path
            c.close()
            return dict(src=src, path=path, final_ok=path == final_path, hits=len(hits), refs=refs, dref=dref)
        a = run("/services/", REF, "/")
        a["ok"] = a["final_ok"] and a["refs"] == [REF]
        b = run("/services/", None, "/")
        b["ok"] = b["final_ok"] and b["hits"] == 1 and b["refs"] == [None] and b["dref"] == ""
        cc = run("/services/#documents", REF, "/products.html")
        cc["ok"] = cc["final_ok"] and cc["refs"] == [REF]
        out = [a, b, cc]
        br.close()
        self.S["redirect_referrer"] = f"{sum(x['ok'] for x in out)}/3"
        self.D["referrer"] = out

    def unhold(self, c):
        """Variant 'unheld': services.config.js with heldServices emptied, so the pay path (consent, body) is exercised too."""
        def h(route, request):
            st, body = http_get(request.url)
            t = re.sub(r"heldServices:\s*\[[^\]]*\]", "heldServices: []", body.decode("utf-8"))
            route.fulfill(status=200, content_type="application/javascript", body=t)
        c.route(re.compile(r"/services\.config\.js"), h)

    def pay_capture_or_check(self, p, path: str, unheld: bool = False) -> dict:
        """Click every pay/request button of `path` in a fresh context, network stubbed; returns service id -> record."""
        br = p.chromium.launch()
        c0 = self.ctx(br, viewport={"width": 1440, "height": 900})
        pg, status, sink = self.open(c0, path)
        btns = pg.evaluate("""() => [...document.querySelectorAll('a[data-pay], a[data-request]')].map((b, i) => ({i,
          id: b.dataset.serviceId, kind: b.hasAttribute('data-pay') ? 'pay' : 'request',
          where: (b.closest('[id]') || {}).id || ''}))""")
        c0.close()
        recs: dict = {}
        for b in btns:
            c = self.ctx(br, viewport={"width": 1440, "height": 900})
            bodies = []

            def api(route, request):
                if request.method == "POST" and "/api/orders" in request.url:
                    try:
                        bodies.append(json.loads(request.post_data or "{}"))
                    except Exception:
                        bodies.append({"raw": request.post_data})
                    return route.fulfill(status=503, headers={"access-control-allow-origin": "*"}, body="{}",
                                         content_type="application/json")
                return route.fallback()
            c.route(re.compile(r"/api/orders"), api)
            if unheld:
                self.unhold(c)
            pg, status, sink = self.open(c, path)
            sel = f"(a[data-pay], a[data-request]) >> nth={b['i']}"
            rec = {"kind": b["kind"], "where": b["where"]}
            try:
                el = pg.locator("a[data-pay], a[data-request]").nth(b["i"])
                el.scroll_into_view_if_needed()
                el.click()
                pg.wait_for_timeout(400)
                st = pg.evaluate("""() => { const pd = document.getElementById('pay-dialog'), od = document.getElementById('order-dialog');
                  return {pay: !!pd && pd.open, order: !!od && od.open,
                    consent: [...document.querySelectorAll('[data-consent-for]')].filter(e => !e.hidden).map(e => e.getAttribute('data-consent-for')),
                    service: ((document.getElementById(pd && pd.open ? 'pay-service' : 'order-service') || {}).textContent || '').trim(),
                    price: ((document.getElementById(pd && pd.open ? 'pay-price' : 'order-price') || {}).textContent || '').trim()}; }""")
                rec.update(dialog="pay" if st["pay"] else ("order" if st["order"] else "none"),
                           consent_for=st["consent"], service=st["service"], price=st["price"])
                if st["pay"]:
                    pg.fill("#pay-email", "gate@example.com")
                    pg.fill("#pay-contact", "@gate_test")
                    pg.wait_for_timeout(2100)
                    pg.click("#pay-submit")
                    pg.wait_for_timeout(800)
                    rec["sent_without_consent"] = len(bodies)
                    pg.check("#pay-consent")
                    if pg.locator("#pay-consent-pd").count() and pg.locator("#pay-consent-pd").is_visible():
                        pg.check("#pay-consent-pd")
                    pg.click("#pay-submit")
                    pg.wait_for_timeout(1500)
                    rec["body"] = bodies[-1] if bodies else None
            except Exception as e:
                rec["error"] = str(e)[:120]
            recs.setdefault(b["id"], []).append(rec)
            c.close()
        br.close()
        return recs

    def pay_flow(self, p):
        fx = load_fixture("pay_bodies.json")
        if fx is None:
            self.S["pay_flow_home"] = "nofixture"
            return
        bad, n = [], 0
        for variant in ("live", "unheld"):
            got = self.pay_capture_or_check(p, "/", unheld=variant == "unheld")
            b2, n2 = self.pay_compare(fx[variant], got)
            bad += [variant + " " + x for x in b2]
            n += n2
        self.S["pay_flow_home"] = f"{n - len(bad)}/{n}"
        self.D["pay_bad"] = bad[:12]

    @staticmethod
    def pay_compare(fx: dict, got: dict):
        bad = []
        strip = lambda d: {k: v for k, v in (d or {}).items() if k not in PAY_IGNORE_FIELDS}
        n = 0
        for sid, ref in fx.items():
            r0 = ref[0]
            if sid not in got:
                bad.append(f"{sid}: no button on /")
                n += 1
                continue
            for r in got[sid]:
                n += 1
                if r.get("error"):
                    bad.append(f"{sid}@{r['where']}: {r['error']}")
                elif r["dialog"] != r0["dialog"] or r["consent_for"] != r0["consent_for"] or r["service"] != r0["service"] or r["price"] != r0["price"]:
                    bad.append(f"{sid}@{r['where']}: dialog/consent/service/price {r['dialog']},{r['consent_for']},{r['price']} != {r0['dialog']},{r0['consent_for']},{r0['price']}")
                elif r0["dialog"] == "pay" and (r.get("sent_without_consent") or strip(r.get("body")) != strip(r0.get("body"))):
                    bad.append(f"{sid}@{r['where']}: body {r.get('body')} / no-consent sends {r.get('sent_without_consent')}")
        for sid in set(got) - set(fx):
            bad.append(f"{sid}: button on / not in the fixture")
            n += 1
        return bad, n

    def home_static(self, p):
        br = p.chromium.launch()
        c = self.ctx(br, viewport={"width": 1440, "height": 900})
        pg, status, sink = self.open(c, "/")
        t = pg.evaluate(TARIFF_JS)
        cur = pg.evaluate(CONSENT_JS)
        c.close()
        # consent: compare with origin/master
        if self.want("consent_hash_ok"):
            git("fetch", "--quiet", "origin", "master")
            mtree = tree_of("origin/master")
            with Served(None, root=mtree) as srv:
                c = br.new_context(locale="ru-RU")
                block_metrika(c)
                pg = c.new_page()
                pg.goto(srv.base + "/", wait_until="load")
                ref = pg.evaluate(CONSENT_JS)
                c.close()
            h = lambda d: {k: hashlib.sha256(v.encode()).hexdigest()[:12] for k, v in d.items()}
            hc, hr = h(cur), h(ref)
            diff = sorted(k for k in set(hc) | set(hr) if hc.get(k) != hr.get(k))
            self.S["consent_hash_ok"] = f"{len(hr) - len([k for k in diff if k in hr])}/{len(hr)}"
            self.D["consent_diff"] = diff
            self.D["consent_ref_sha"] = git("rev-parse", "--short", "origin/master")
        br.close()
        bad = [k for k, v in t["ids"].items() if not v]
        if t["pay"] < 5:
            bad.append(f"data-pay={t['pay']}<5")
        if t["req"] < 1:
            bad.append(f"data-request={t['req']}<1")
        if t["shortCards"]:
            bad.append(f"short cards: {t['shortCards']} buttons")
        if not all(t["tarify"]):
            bad.append(f"#tarify oferta/privacy={t['tarify']}")
        if not all(t["dialog"]):
            bad.append(f"#pay-dialog oferta/privacy={t['dialog']}")
        self.S["tariffs_home"] = 0 if bad else 1
        self.D["tariffs_bad"] = bad

    def legal(self, p):
        btree = tree_of(BASE_SHA)
        br = p.chromium.launch()
        texts = {}
        for tag, base, root in (("cur", self.base, None), ("ref", None, btree)):
            ctxm = Served(None, root=root) if root else None
            b = base
            if ctxm:
                ctxm.__enter__()
                b = ctxm.base
            c = br.new_context(locale="ru-RU")
            block_metrika(c)
            for path in ("/oferta.html", "/privacy.html"):
                pg = c.new_page()
                pg.goto(b + path, wait_until="load")
                texts[(tag, path)] = hashlib.sha256(pg.evaluate(LEGAL_JS).encode()).hexdigest()
                pg.close()
            c.close()
            if ctxm:
                ctxm.__exit__(None, None, None)
        br.close()
        same = [p_ for p_ in ("/oferta.html", "/privacy.html") if texts[("cur", p_)] == texts[("ref", p_)]]
        self.S["legal_text_same"] = f"{len(same)}/2"

    def scenes(self, p):
        res = {}
        for key, (path, name) in SCENES.items():
            r = res[key] = {"path": path}
            br = p.chromium.launch()
            # live + test-mode frames, pc and tel
            for vk, vv in (("pc", dict(viewport={"width": 1440, "height": 900})),
                           ("tel", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True))):
                c = self.ctx(br, **vv)
                pg, status, sink = self.open(c, path)
                pr = pg.evaluate(SCENE_JS_PROBE, name) if status == 200 else {"present": False}
                r[vk] = pr
                if pr.get("present"):
                    c2 = self.ctx(br, **vv)
                    pg2, st2, _ = self.open(c2, path + "?scene-test=1")
                    try:
                        sel = f'section[data-scene2="{name}"] :is([data-scene2-stage], .scene2-stage)'
                        pg2.evaluate("() => window.__scene2.go(0)")
                        f0 = pg2.locator(sel).screenshot()
                        pg2.evaluate("() => window.__scene2.go(1)")
                        f1 = pg2.locator(sel).screenshot()
                        r[vk]["ssim_p0"] = ssim(f0, FIX / "scene2" / f"{name}_p0_{vk}.png")
                        # the poster of this screen: with JS the lazy <picture> is not fetched, so currentSrc is empty
                        # and img.src is always the desktop file; scripts/build_scene_posters.py names them by screen
                        poster = ROOT / "assets" / "scene2" / f"{name}_{vk}.webp" if pr.get("posterSrc") else Path("-")
                        r[vk]["ssim_p1"] = ssim(f1, poster)
                        import numpy as np
                        from PIL import Image
                        from skimage.metrics import structural_similarity
                        A = np.asarray(Image.open(io.BytesIO(f0)).convert("L"))
                        B = np.asarray(Image.open(io.BytesIO(f1)).convert("L"))
                        r[vk]["ssim_01"] = float(structural_similarity(A, B, data_range=255))
                        # sticky at P = 0.5 (real scroll, not test mode)
                        top = pr["top"] + 0.5 * (pr["height"] - pr["H"])
                        pg.evaluate(f"window.scrollTo(0, {top})")
                        pg.wait_for_timeout(300)
                        r[vk]["sticky"] = abs(pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top")) < 1
                        r[vk]["live_end"] = pg.evaluate("document.documentElement.classList.contains('scene2-live')")
                    except Exception as e:
                        r[vk]["error"] = str(e)[:120]
                    c2.close()
                c.close()
            br.close()
        # verdicts
        for key, r in res.items():
            ok = all(r[v].get("present") and r[v].get("live") and r[v].get("live_end")
                     and r[v].get("ssim_p0", -1) >= THR["ssim_p0"] and r[v].get("ssim_p1", -1) >= THR["ssim_p1"]
                     and 0 <= r[v].get("ssim_01", 1) <= THR["ssim_diff"] for v in ("pc", "tel"))
            self.S[f"scene_{key}"] = 1 if ok else 0
            a11y = all(r[v].get("canvasHidden") and r[v].get("posterAlt") and r[v].get("link") and 0 <= r[v].get("targetTop", -1)
                       <= (THR["a11y_pc"] if v == "pc" else THR["a11y_tel"]) * r[v].get("H", 0) for v in ("pc", "tel"))
            r["a11y"] = a11y
        self.S["scene_a11y"] = sum(1 for r in res.values() if r["a11y"])
        self.S["scene_sticky"] = 1 if all(r[v].get("sticky") for r in res.values() for v in ("pc", "tel")) else 0
        if self.webkit and self.S["scene_sticky"]:
            br = p.webkit.launch()
            for key, (path, name) in SCENES.items():
                c = self.ctx(br, viewport={"width": 390, "height": 844}, has_touch=True)
                pg, status, sink = self.open(c, path)
                pr = pg.evaluate(SCENE_JS_PROBE, name)
                pg.evaluate(f"window.scrollTo(0, {pr['top'] + 0.5 * (pr['height'] - pr['H'])})")
                pg.wait_for_timeout(400)
                if abs(pg.evaluate(f"document.querySelector('section[data-scene2=\"{name}\"] :is([data-scene2-stage], .scene2-stage)').getBoundingClientRect().top")) >= 1:
                    self.S["scene_sticky"] = 0
                c.close()
            br.close()
        self.D["scenes"] = res

    def scene_static(self, p):
        """no-JS / reduced motion poster, poster weight, poster not fetched with JS, JS weight, frame gaps, LCP."""
        br = p.chromium.launch()
        final_bad, img = [], {"m": 0.0, "d": 0.0}
        poster_dl, jsw, gaps, degraded, lcps = 0, {}, [], 0, {}
        for key, (path, name) in SCENES.items():
            for mode, kw in (("nojs", dict(java_script_enabled=False)), ("rm", dict(reduced_motion="reduce"))):
                for vk, vv in (("m", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)),
                               ("d", dict(viewport={"width": 1440, "height": 900}))):
                    c = self.ctx(br, **vv, **kw)
                    sizes = {}
                    c.on("response", lambda resp, sizes=sizes: sizes.__setitem__(urlparse(resp.url).path, len(resp.body() or b""))
                         if (resp.headers.get("content-type") or "").startswith("image/") else None)
                    pg, status, sink = self.open(c, path)
                    pr = pg.evaluate(SCENE_JS_PROBE, name) if status == 200 else {"present": False}
                    if not pr.get("present"):
                        final_bad.append(f"{key}:{mode}:{vk}: no scene")
                        c.close()
                        continue
                    pg.evaluate(f"window.scrollTo(0, {pr['top']})")
                    pg.wait_for_timeout(800)
                    pr = pg.evaluate(SCENE_JS_PROBE, name)
                    hid = pg.evaluate(PAGE_JS, {}).get("hidden", 0)
                    spin = 0
                    if mode == "rm":
                        spin = pg.evaluate("""async () => { const c = document.querySelector('canvas[data-scene2-canvas]');
                          if (!c || !c.getClientRects().length || getComputedStyle(c).display === 'none') return 0;
                          const a = c.toDataURL(); await new Promise(r => setTimeout(r, 600)); return a === c.toDataURL() ? 0 : 1; }""")
                    if not pr.get("posterLoaded") or hid or spin:
                        final_bad.append(f"{key}:{mode}:{vk}: poster={pr.get('posterLoaded')} hidden={hid} spin={spin}")
                    psrc = urlparse(pr.get("posterSrc", "")).path
                    img[vk] = max(img[vk], round(sizes.get(psrc, 0) / 1024, 1))
                    c.close()
            # with JS: the poster must not be fetched; script weight; LCP element
            c = self.ctx(br, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            got = []
            c.on("response", lambda resp, got=got: got.append((resp.url, resp.headers.get("content-type") or "")))
            pg = c.new_page()
            pg.add_init_script("window.__lcp = null; try { new PerformanceObserver(l => { const e = l.getEntries(); const x = e[e.length - 1];"
                               " if (x) window.__lcp = {t: x.startTime, tag: x.element ? x.element.tagName.toLowerCase() : ''}; })"
                               ".observe({type: 'largest-contentful-paint', buffered: true}); } catch (_) {}")
            pg.goto(self.base + path, wait_until="load")
            settle(pg, 1500)
            lcps[key] = pg.evaluate("window.__lcp") or {}
            pr = pg.evaluate(SCENE_JS_PROBE, name)
            if pr.get("present"):
                pages_h = pg.evaluate("document.documentElement.scrollHeight")
                for y in range(0, int(pages_h), 700):
                    pg.evaluate(f"window.scrollTo(0, {y})")
                    pg.wait_for_timeout(80)
                poster_dl += sum(1 for u, ct in got if "data-scene2-poster" and ct.startswith("image/") and "/assets/scene2/" in u)
                w = 0
                for u in {u for u, ct in got if SCENE_JS.search(urlparse(u).path) and urlparse(u).path.endswith(".js")}:
                    st, body = http_get(u)
                    w += len(gzip.compress(body, 9))
                jsw[key] = round(w / 1024, 1)
            c.close()
            # frame gaps under 4x CPU
            if pr.get("present"):
                c = self.ctx(br, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
                pg = c.new_page()
                pg.add_init_script("window.__plain = 0; document.addEventListener('scene:plain', () => window.__plain++);")
                cdp = c.new_cdp_session(pg)
                cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                pg.goto(self.base + path, wait_until="load")
                settle(pg, 800)
                g = pg.evaluate("""async (p) => { const gaps = []; let last = performance.now(), run = true;
                  const tick = t => { gaps.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
                  requestAnimationFrame(tick);
                  const y0 = p.top, y1 = p.top + p.height - innerHeight, T = 3000, t0 = performance.now();
                  await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - t0) / T);
                    scrollTo(0, y0 + (y1 - y0) * k); if (k < 1) setTimeout(step, 16); else res(); }; step(); });
                  run = false; gaps.shift(); gaps.sort((a, b) => a - b); return {p95: gaps[Math.floor(gaps.length * 0.95)] || 999, plain: window.__plain}; }""",
                                {"top": pr["top"], "height": pr["height"]})
                gaps.append(g["p95"])
                degraded += g["plain"]
                c.close()
        br.close()
        self.S["scene_final_nojs"] = 0 if final_bad else 1
        self.D["scene_final_bad"] = final_bad
        self.S["img_kb_scene_m"], self.S["img_kb_scene_d"] = img["m"], img["d"]
        self.S["poster_shift"] = poster_dl
        self.S["js_gzip_kb_scene"] = max(jsw.values()) if jsw else -1
        self.S["frame_gap_p95_ms"] = round(max(gaps), 1) if gaps else -1
        self.S["scene_degraded"] = degraded
        self.D["lcp_scene"] = lcps

    def lcp(self, p):
        br = p.chromium.launch()
        for key, path in (("builders", "/products.html"), ("rieltor", "/rieltor/"), ("home", "/")):
            c = self.ctx(br, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            pg = c.new_page()
            pg.add_init_script("window.__lcp = null; try { new PerformanceObserver(l => { const e = l.getEntries(); const x = e[e.length - 1];"
                               " if (x) window.__lcp = {t: x.startTime, tag: x.element ? x.element.tagName.toLowerCase() : ''}; })"
                               ".observe({type: 'largest-contentful-paint', buffered: true}); } catch (_) {}")
            pg.goto(self.base + path, wait_until="load")
            pg.wait_for_timeout(2000)
            l = pg.evaluate("window.__lcp") or {}
            self.S[f"lcp_ms_m_{key}"] = round(l.get("t", 99999))
            self.D[f"lcp_{key}"] = l
            c.close()
        br.close()

    def site2(self, p):
        pages = [pp for pp in PAGES if pp not in ("/services/", "/about.html", "/rieltor/", "/", "/products.html", "/spasibo/")]
        pages = [pp for pp in pages if "site2.css" in http_get(self.base + pp)[1].decode("utf-8", "replace")]
        br = p.chromium.launch()
        font, cls = {}, {}
        for path in pages:
            c = self.ctx(br, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            sizes = {}
            c.on("response", lambda resp, sizes=sizes: sizes.__setitem__(resp.url, len(resp.body() or b""))
                 if re.search(r"\.(woff2?|ttf|otf)(\?|$)", resp.url) else None)
            pg = c.new_page()
            pg.add_init_script("window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })"
                               ".observe({type: 'layout-shift', buffered: true}); } catch (_) {}")
            pg.goto(self.base + path, wait_until="load")
            settle(pg, 800)
            font[path] = round(sum(sizes.values()) / 1024, 1)
            cls[path] = round(pg.evaluate("window.__cls"), 3)
            c.close()
        br.close()
        self.S["font_kb_site2"] = max(font.values()) if font else 0
        self.S["cls_site2"] = max(cls.values()) if cls else 0
        self.D["site2"] = {"font": font, "cls": cls}

    def caption_contrast(self, p):
        """Captions over the canvas: background under each caption box from a screenshot at P = 0, 0.5, 1 (test mode)."""
        import numpy as np
        from PIL import Image
        fails, checked = [], 0
        br = p.chromium.launch()
        for key, (path, name) in SCENES.items():
            c = self.ctx(br, viewport={"width": 1440, "height": 900})
            pg, status, sink = self.open(c, path + "?scene-test=1")
            if not pg.evaluate("() => !!(window.__scene2 && document.querySelector('section[data-scene2] [data-scene2-cap]'))"):
                c.close()
                continue
            for P in (0, 0.5, 1):
                pg.evaluate(f"() => window.__scene2.go({P})")
                caps = pg.evaluate("""() => [...document.querySelectorAll('section[data-scene2] [data-scene2-cap]')].filter(e => e.getClientRects().length)
                  .map((e, i) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e).color; e.dataset.gateI = i;
                    return {i, x: r.x, y: r.y, w: r.width, h: r.height, color: c, fs: parseFloat(getComputedStyle(e).fontSize)}; })""")
                pg.evaluate("() => document.querySelectorAll('[data-gate-i]').forEach(e => e.style.setProperty('color', 'transparent', 'important'))")
                shot = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
                pg.evaluate("() => document.querySelectorAll('[data-gate-i]').forEach(e => e.style.removeProperty('color'))")
                for cp in caps:
                    m = re.findall(r"[\d.]+", cp["color"])
                    tc = [float(v) for v in m[:3]]
                    box = np.asarray(shot.crop((int(cp["x"]), int(cp["y"]), int(cp["x"] + cp["w"]), int(cp["y"] + cp["h"])))).reshape(-1, 3)
                    if not len(box):
                        continue
                    lt = lum(tc)
                    ratios = sorted((max(lt, lum(px)) + 0.05) / (min(lt, lum(px)) + 0.05) for px in box[:: max(1, len(box) // 4000)].astype(float))
                    worst = ratios[int(len(ratios) * 0.02)]
                    checked += 1
                    if worst < (3 if cp["fs"] >= 24 else 4.5):
                        fails.append(f"{key} P={P} cap{cp['i']} {worst:.2f}")
            c.close()
        br.close()
        self.S["contrast_fail"] = self.S.get("contrast_fail", 0) + len(fails)
        self.D["caption_contrast"] = {"checked": checked, "fails": fails}

    def build_match(self):
        files = ["index.html", "services/index.html", "assets/redirect-map.js", "assets/pay.js", "assets/tokens.css"]
        ok = 0
        for f in files:
            st, body = http_get(f"{self.base}/{f}?cb={int(time.time())}")
            loc = ROOT / f
            if st == 200 and loc.exists() and hashlib.sha256(body).hexdigest() == hashlib.sha256(loc.read_bytes()).hexdigest():
                ok += 1
        self.S["build_match"] = f"{ok}/{len(files)}"

    # run -------------------------------------------------------------
    def run(self):
        from playwright.sync_api import sync_playwright
        self.files()
        with sync_playwright() as p:
            steps = [
                (("pages_200", "console_errors", "csp_violations", "duplicate_ids", "nav_ok", "metrika_pageviews", "old_links_in_site", "contrast_fail"), self.pages),
                (("hidden_nojs", "hidden_at_rest_rm"), self.nojs_rm),
                (("overflow_pages_m",), self.overflow),
                (("redirects_ok",), self.redirects),
                (("redirect_referrer",), self.referrer),
                (("pay_flow_home",), self.pay_flow),
                (("tariffs_home", "consent_hash_ok"), self.home_static),
                (("legal_text_same",), self.legal),
                (("scene_builders", "scene_rieltor", "scene_sticky", "scene_a11y"), self.scenes),
                (("scene_final_nojs", "img_kb_scene_m", "img_kb_scene_d", "poster_shift", "js_gzip_kb_scene", "frame_gap_p95_ms", "scene_degraded"), self.scene_static),
                (("lcp_ms_m_builders", "lcp_ms_m_rieltor", "lcp_ms_m_home"), self.lcp),
                (("font_kb_site2", "cls_site2"), self.site2),
                (("contrast_fail",), self.caption_contrast),
            ]
            for keys, fn in steps:
                if not self.want(*keys):
                    continue
                t0 = time.time()
                try:
                    fn(p)
                except Exception as e:
                    self.D["notes"][fn.__name__] = f"{type(e).__name__}: {str(e)[:200]}"
                    for k in keys:
                        self.S.setdefault(k, "error")
                self.D.setdefault("timing", {})[fn.__name__] = round(time.time() - t0, 1)
        if self.remote:
            self.build_match()


def frac_ok(v) -> bool:
    if not isinstance(v, str) or "/" not in v or "(" in v:
        return False
    a, b = v.split("/")
    return a == b and int(b) > 0


def verdict(S: dict, remote: bool, only: set | None) -> list[str]:
    base2 = load_fixture("site2_baseline.json") or {}
    checks = {
        "pages_200": frac_ok, "redirects_ok": frac_ok, "redirect_referrer": lambda v: v == "3/3",
        "metrika_pageviews": frac_ok, "old_links_in_site": lambda v: v == 0, "duplicate_ids": lambda v: v == 0,
        "nav_ok": lambda v: v == 1, "tariffs_home": lambda v: v == 1, "pay_flow_home": frac_ok,
        "consent_hash_ok": frac_ok, "legal_text_same": lambda v: v == "2/2",
        "scene_builders": lambda v: v == 1, "scene_rieltor": lambda v: v == 1, "scene_sticky": lambda v: v == 1,
        "scene_final_nojs": lambda v: v == 1, "scene_a11y": lambda v: v == len(SCENES),
        "hidden_nojs": lambda v: v == 0, "hidden_at_rest_rm": lambda v: v == 0, "overflow_pages_m": lambda v: v == 0,
        "frame_gap_p95_ms": lambda v: 0 <= v <= THR["frame_gap_p95_ms"], "scene_degraded": lambda v: v == 0,
        "poster_shift": lambda v: v == 0, "js_gzip_kb_scene": lambda v: 0 <= v <= THR["js_gzip_kb_scene"],
        "img_kb_scene_m": lambda v: 0 < v <= THR["img_kb_scene_m"], "img_kb_scene_d": lambda v: 0 < v <= THR["img_kb_scene_d"],
        "lcp_ms_m_builders": lambda v: v <= THR["lcp_ms_m"], "lcp_ms_m_rieltor": lambda v: v <= THR["lcp_ms_m"],
        "lcp_ms_m_home": lambda v: v <= THR["lcp_ms_m"],
        "font_kb_site2": lambda v: v <= base2.get("font_kb_site2", 0) + 0.5,
        "cls_site2": lambda v: v <= base2.get("cls_site2", 0) + 0.01,
        "hex_outside_tokens": lambda v: v == 0, "contrast_fail": lambda v: v == 0,
        "console_errors": lambda v: v == 0, "csp_violations": lambda v: v == 0,
    }
    if remote:
        checks["build_match"] = lambda v: v == "5/5"
    miss = []
    for k, f in checks.items():
        if only and k not in only:
            continue
        if k not in S:
            if not remote or REMOTE_REQUIRED.search(k):
                miss.append(k)
            continue
        try:
            if not f(S[k]):
                miss.append(k)
        except Exception:
            miss.append(k)
    return miss


# ---------------------------------------------------------------- Э0 modes
def capture_fixtures():
    sha = git("rev-parse", "--short=7", "HEAD")
    if not git("rev-parse", "HEAD").startswith(BASE_SHA):
        print(f"capture refused: HEAD {sha} is not {BASE_SHA}; fixtures are taken from the tree before the change")
        return 1
    from playwright.sync_api import sync_playwright
    FIX.mkdir(parents=True, exist_ok=True)
    with Served(None) as srv, sync_playwright() as p:
        g = Gate(srv.base, False, None, False)
        recs = {v: g.pay_capture_or_check(p, "/services/", unheld=v == "unheld") for v in ("live", "unheld")}
        (FIX / "pay_bodies.json").write_text(json.dumps(recs, ensure_ascii=False, indent=1), encoding="utf-8")
        g.pages(p)
        mp = sorted({r["path"] for r in g.D["rows"] if r.get("metrika")})
        (FIX / "metrika_pages.json").write_text(json.dumps(mp, ensure_ascii=False, indent=1), encoding="utf-8")
        g.site2(p)
        (FIX / "site2_baseline.json").write_text(json.dumps({"sha": BASE_SHA, "font_kb_site2": g.S["font_kb_site2"],
                                                            "cls_site2": g.S["cls_site2"], **g.D["site2"]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"captured: pay_bodies {sum(len(v) for r in recs.values() for v in r.values())} button records; metrika_pages {len(mp)}; site2 {g.S['font_kb_site2']} KB, CLS {g.S['cls_site2']}")
    return 0


def shots(out: str):
    from playwright.sync_api import sync_playwright
    d = Path(out)
    d.mkdir(parents=True, exist_ok=True)
    n = 0
    with Served(None) as srv, sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in ((360, 640), (390, 844), (1440, 900)):
            for path in PAGES:
                c = br.new_context(locale="ru-RU", viewport={"width": w, "height": h}, reduced_motion="reduce",
                                   **({"is_mobile": True, "has_touch": True} if w < 1000 else {}))
                block_metrika(c)
                preview_api_stub(c, srv.base)
                pg = c.new_page()
                pg.goto(srv.base + path, wait_until="load")
                settle(pg, 600)
                name = (path.strip("/").replace("/", "_").replace(".html", "") or "home")
                pg.screenshot(path=str(d / f"{name}_{w}.png"), full_page=True)
                n += 1
                c.close()
        br.close()
    print(f"shots: {n} files in {d}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--exp", default="run")
    ap.add_argument("--json")
    ap.add_argument("--only", help="comma-separated keys (debug; the verdict covers only them)")
    ap.add_argument("--no-webkit", action="store_true")
    ap.add_argument("--capture-fixtures", action="store_true")
    ap.add_argument("--shots")
    a = ap.parse_args(argv)
    if a.capture_fixtures:
        return capture_fixtures()
    if a.shots:
        return shots(a.shots)
    only = set(a.only.split(",")) if a.only else None
    try:
        with Served(a.base) as srv:
            sha, dirty = git_info(ROOT)
            head = git("rev-parse", "--short", "HEAD")
            if not a.base and sha != head:
                print(f"GATE status=fail miss=served_sha({sha}!={head})")
                return 1
            g = Gate(srv.base, bool(a.base), only, not a.no_webkit)
            g.run()
    except Exception as e:
        print(f"GATE_ERROR {type(e).__name__}: {str(e)[:300]}")
        print("GATE status=fail miss=gate_error")
        return 1
    S = g.S
    if a.base:
        local_only = ["hex_outside_tokens", "old_links_in_site", "js_gzip_kb_scene"]
        print("SKIPPED file keys computed on the local tree " + git("rev-parse", "--short", "HEAD") + ": " + ",".join(local_only))
    miss = verdict(S, bool(a.base), only)
    print(f"SCORE suite=site-v3 exp={a.exp} sha={sha} dirty={dirty}: " + " ".join(f"{k}={v}" for k, v in S.items()))
    for k, v in g.D["notes"].items():
        print(f"  note {k}: {v}")
    for k in ("pages_200_bad", "nav_bad", "redirects_bad", "pay_bad", "tariffs_bad", "consent_diff", "scene_final_bad", "overflow_bad", "metrika_bad"):
        if g.D.get(k):
            print(f"  {k}: {json.dumps(g.D[k], ensure_ascii=False)[:400]}")
    if a.json:
        Path(a.json).write_text(json.dumps({"score": S, "miss": miss, "detail": g.D}, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print("GATE " + ("status=ok" if not miss else "status=fail miss=" + ",".join(miss)))
    return 1 if miss else 0


if __name__ == "__main__":
    sys.exit(main())
