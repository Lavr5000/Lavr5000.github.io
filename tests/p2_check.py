#!/usr/bin/env python3
"""P2 acceptance check (PO 14.11 19:05): the home page on a phone is compact, its sections let the moving backdrop
show through, the tariff cards open from a short collapsed view, and the builders page says "в MAX или на почту".

Serves this worktree like v3_gate.py (helpers of v2_gate.py) or checks an external base URL (`--url`), prints one line
per key, then `P2 status=ok|fail`. Numbers of the baseline (e7ea2ea == f30c40d outside tests/) live in
tests/fixtures/p2_baseline.json; `--baseline` prints the raw numbers and `--write-baseline` refreshes the fixture.
`--inject-css FILE` adds a stylesheet to every page (prototypes and cheat mutants for the check itself).

Keys
  home_tel_h_ratio      document height of / at 390x844 / baseline                                  <= 0.75
  home_pc_h_ratio       the same at 1440x900                                                        <= 1.05
  backdrop_seen_tel/pc  share of scroll stops (every half screen) where >= 20 % of the viewport below the
                        header changes when the scene backdrop is painted magenta vs green (a pixel
                        test: any layer, pseudo-element, opacity or stacking counts as it really renders;
                        a channel difference > 45 of 255 = the stack above lets >= ~18 % through)    >= 0.85
  scene_pinned_tel      the backdrop is position:fixed and covers the viewport at every stop on 390 with
                        the CPU slowed 4x (scene3.js unpins it when the device does not keep up)     = all stops
  no_backdrop_filter    elements in <main> with backdrop-filter (repaint cost on phones, blurs the spark)      = 0
  translucent_contrast_fail  text whose background stack is not opaque: the stack of all ancestor
                        backgrounds (and the text colour alpha) composited over black AND over white
                        must give contrast >= 4.5; run with the tariff <details> closed and open    = 0
  text_same_home/_builders  word multiset of the rendered text (innerText, all <details> open) equals the baseline; allowed additions:
                        "Подробнее" (home), the R5 words (builders); nothing removed               = ok
  font_min_tel          smallest computed font-size of visible text in <main> on 390 >= baseline
  font_same_tel         every text element of <main> on 390 (matched by its text) keeps a font-size >= baseline
  other_pages_style     hash of computed styles of every element of the other pages and /products.html on 390
                        and 1440 equals the baseline (a recoloured token or a global rule changes it)
  tap_small_tel         links/buttons/summary in <main> on 390 smaller than 44 px both ways     <= baseline
  line_height_tel       median line-height/font-size of <main> paragraphs on 390 in [1.40, 1.55]
  other_pages_h         height of the other pages (390 and 1440) within 1 % of the baseline
  tariff_collapsed      cards of / (390 and 1440) start collapsed (closed <details> or aria-expanded=false),
                        list hidden, price and pay button visible, height <= 360 px on 390        = N/N
  tariff_expand         one click on the toggle shows the list (390, JS on)                        = N/N
  tariff_nojs           with JavaScript off the list is reachable (visible, or a click on <summary>)= N/N
  tariff_webkit         collapsed + expands in WebKit on 390 (Safari: the phone of the owner)      = N/N
  pay_buttons_home      [data-pay] buttons on / with the same data-* as the baseline               = same
  builders_mail_only    text blocks of /products.html (outside the pay dialog, contacts, footer) that
                        mention почт / e-mail / письм without MAX                                  = 0
  builders_max_phrase   occurrences of "в MAX или на почту" on /products.html                     >= 2
"""
import io
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
import v2_gate as V2  # noqa: E402

FIX = ROOT / "tests" / "fixtures" / "p2_baseline.json"
BASE = json.loads(FIX.read_text(encoding="utf-8")) if FIX.exists() else {}
OTHER = ["/rieltor/", "/oferta.html", "/privacy.html", "/rate.html", "/vedomost.html", "/pdf-tables.html"]
ALLOW_HOME = Counter({"подробнее": 3})
ALLOW_BUILD = Counter({"в": 2, "max": 2, "или": 2, "на": 1, "почту": 1, "результат": 1, "приходит": 1})

PARSE = r"""const parse = (c) => { let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; } return null; };"""

JS_CONTRAST = r"""
(() => {
  """ + PARSE + r"""
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((k) => top[k] * a + under[k] * (1 - a)); };
  const bd = document.querySelector('[data-scene-bg]');
  const bad = [];
  for (const el of document.querySelectorAll('main p, main li, main h1, main h2, main h3, main span, main a, main strong, main label, main summary, main dt, main dd')) {
    if (!el.getClientRects().length || !el.textContent.trim() || getComputedStyle(el).visibility === 'hidden') continue;
    if (bd && bd.contains(el)) continue;
    const stack = [];                       /* backgrounds from the element up to <main> (body/html excluded: the scene covers them) */
    let opaque = false, op = 1;
    for (let p = el; p && p.tagName !== 'MAIN' && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      op *= parseFloat(cs.opacity || '1');
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) { opaque = true; break; }
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0.004) { stack.push(c); if (c[3] >= 0.995) { opaque = true; break; } }
    }
    if (opaque && op >= 0.995) continue;   /* fully opaque stack: the main gate (contrast_fail) checks it */
    let fg = parse(getComputedStyle(el).color);
    if (!fg) continue;
    for (const under of [[0, 0, 0, 1], [255, 255, 255, 1]]) {
      let bg = under.slice(0, 3);
      for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
      const f = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
      if (ratio(f, bg) < 4.5) { bad.push(el.tagName + ':' + el.textContent.trim().slice(0, 30)); break; }
    }
  }
  return bad;
})()
"""

JS_TARIFF = r"""
(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  return [...document.querySelectorAll('article.tariff')].map((card) => {
    const list = card.querySelector('.tariff-list');
    const det = card.querySelector('details');
    const btn = card.querySelector('[aria-expanded]');
    const toggle = det ? det.querySelector('summary') : btn;
    return {
      id: card.id, toggle: !!toggle,
      closed: det ? !det.open : (btn ? btn.getAttribute('aria-expanded') === 'false' : false),
      list: vis(list), price: vis(card.querySelector('.tariff-price')), pay: vis(card.querySelector('[data-pay]')),
      h: Math.round(card.getBoundingClientRect().height),
    };
  });
})()
"""

JS_LIST_VISIBLE = "(id) => { const l = document.querySelector('article#' + id + ' .tariff-list'); return !!l && l.getClientRects().length > 0 && getComputedStyle(l).visibility !== 'hidden'; }"

JS_PAY = "[...document.querySelectorAll('[data-pay]')].map(b => [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).sort().join('|')).sort()"

JS_TEXT = r"""
(() => { const d = [...document.querySelectorAll('details')].filter(x => !x.open); d.forEach(x => x.open = true);
  const t = document.body.innerText; d.forEach(x => x.open = false); return t; })()
"""

JS_MAIL = r"""
(() => {
  const skip = (el) => el.closest('dialog, #contact, .contact, footer, [data-chrome-foot], .pay-dlg');
  let n = 0; const hits = [];
  for (const el of document.querySelectorAll('main p, main h1, main h2, main h3, main li, main dd, main summary')) {
    if (skip(el)) continue;
    const t = el.textContent.replace(/\s+/g, ' ');
    if (/почт|e-?mail|письм/i.test(t) && !/MAX/.test(t)) { n++; hits.push(t.slice(0, 60)); }
  }
  const phrase = (document.querySelector('main').textContent.replace(/\s+/g, ' ').match(/в MAX или на почту/g) || []).length;
  return {n, hits, phrase};
})()
"""

JS_TYPO = r"""
(() => {
  let fmin = 99, small = 0; const lh = [];
  for (const el of document.querySelectorAll('main p, main li, main dd, main summary, main a, main span, main h2, main h3')) {
    if (!el.getClientRects().length || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    fmin = Math.min(fmin, parseFloat(cs.fontSize));
    if (el.tagName === 'P' && cs.lineHeight.endsWith('px')) lh.push(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize));
  }
  for (const el of document.querySelectorAll('main a, main button, main summary')) {
    if (!el.getClientRects().length) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1) continue;
    if (r.width < 44 && r.height < 44) small++;
  }
  return {fmin, small, lh, bf: [...document.querySelectorAll('main *')].filter(e => { const v = getComputedStyle(e).backdropFilter; return v && v !== 'none'; }).length};
})()
"""

JS_PINNED = r"""
(() => { const bd = document.querySelector('[data-scene-bg]'); if (!bd) return false;
  const cs = getComputedStyle(bd), r = bd.getBoundingClientRect();
  return cs.position === 'fixed' && r.top <= 80 && r.bottom >= innerHeight - 2 && cs.visibility !== 'hidden'; })()
"""

JS_FONTS = r"""
(() => { const out = {};
  for (const el of document.querySelectorAll('main p, main li, main dd, main summary, main h1, main h2, main h3, main a')) {
    if (!el.getClientRects().length) continue;
    const k = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 48); if (!k) continue;
    const f = parseFloat(getComputedStyle(el).fontSize); out[k] = Math.min(out[k] || 99, f);
  }
  return out; })()
"""

JS_STYLE = r"""
(() => { const P = ['color','backgroundColor','backgroundImage','fontSize','lineHeight','fontWeight','paddingTop',
  'paddingBottom','paddingLeft','marginTop','marginBottom','borderRadius','backdropFilter','gap'];
  let s = ''; for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script,style,noscript,svg,canvas,picture')) continue;
    const cs = getComputedStyle(el); s += el.tagName + '|' + P.map(k => String(cs[k]).split(location.origin).join('')).join('|') + ';'; }
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16); })()
"""

STYLE_PAGES = OTHER + ["/products.html"]

PAINT = "[data-scene-bg]{background:%s !important} [data-scene-bg] *{visibility:hidden !important}"


def words(text):
    return Counter(w.lower() for w in re.findall(r"\w+", text))


def ctx(br, w, h, js=True, css=None):
    c = br.new_context(locale="ru-RU", viewport={"width": w, "height": h}, java_script_enabled=js, bypass_csp=True,
                       **({"is_mobile": True, "has_touch": True} if w < 1000 and br.browser_type.name == "chromium" else {}))
    V2.block_metrika(c)
    if css:
        c.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');"
                          "s.textContent=" + json.dumps(css) + ";document.head.appendChild(s);});")
    return c


def shot(pg, top):
    from PIL import Image
    w, h = pg.viewport_size["width"], pg.viewport_size["height"]
    img = Image.open(io.BytesIO(pg.screenshot(clip={"x": 0, "y": top, "width": w, "height": h - top}))).convert("RGB")
    return img.resize((max(1, img.width // 3), max(1, img.height // 3)))


def see_through(pg):
    """Share of the viewport below the header where the backdrop colour reaches the screen."""
    from PIL import ImageChops
    top = pg.evaluate("(() => { const h = document.querySelector('header'); return h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0; })()")
    shots = []
    for col in ("#ff00ff", "#00ff00"):
        pg.evaluate("(css) => { let s = document.getElementById('p2bg'); if (!s) { s = document.createElement('style'); s.id = 'p2bg'; document.head.appendChild(s); } s.textContent = css; }",
                    PAINT % col)
        pg.wait_for_timeout(40)
        shots.append(shot(pg, top))
    pg.evaluate("document.getElementById('p2bg').textContent = ''")
    diff = list(ImageChops.difference(*shots).getdata())
    return sum(1 for px in diff if max(px) > 45) / max(1, len(diff))


def scroll_stops(pg, fn):
    total = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    step = pg.evaluate("innerHeight") / 2
    out, y = [], 0
    while True:
        pg.evaluate(f"window.scrollTo(0,{int(y)})")
        pg.wait_for_timeout(80)
        out.append(fn(pg))
        if y >= total:
            break
        y = min(total, y + step)
    return out


def contrast_both(pg):
    bad = pg.evaluate(JS_CONTRAST)
    pg.evaluate("document.querySelectorAll('main details').forEach(d => d.open = true)")
    pg.wait_for_timeout(100)
    bad += pg.evaluate(JS_CONTRAST)
    pg.evaluate("document.querySelectorAll('main details').forEach(d => d.open = false)")
    return bad


def collect(br_c, br_w, b, css):
    S = {}
    for tag, w, h in (("tel", 390, 844), ("pc", 1440, 900)):
        c = ctx(br_c, w, h, css=css)
        V2.preview_api_stub(c, b)
        pg = c.new_page()
        pg.goto(b + "/", wait_until="load")
        V2.settle(pg, 600)
        S[f"home_{tag}_h"] = pg.evaluate("document.documentElement.scrollHeight")
        S[f"backdrop_{tag}"] = [round(v, 3) for v in scroll_stops(pg, see_through)]
        pg.evaluate("window.scrollTo(0,0)")
        S.setdefault("contrast_bad", []).extend(contrast_both(pg))
        S[f"tariff_{tag}"] = pg.evaluate(JS_TARIFF)
        if tag == "tel":
            S["pay_attrs"] = pg.evaluate(JS_PAY)
            S["text_home"] = dict(words(pg.evaluate(JS_TEXT)))
            S["typo_tel"] = pg.evaluate(JS_TYPO)
            S["fonts_tel"] = pg.evaluate(JS_FONTS)
            exp = 0
            for card in S["tariff_tel"]:
                loc = pg.locator(f"article#{card['id']} details > summary, article#{card['id']} [aria-expanded]").first
                if card["toggle"] and loc.count():
                    loc.click()
                    pg.wait_for_timeout(250)
                    exp += pg.evaluate(JS_LIST_VISIBLE, card["id"])
            S["tariff_expand_n"] = exp
        c.close()
    # the backdrop stays pinned on a slow phone (CPU 4x)
    c = ctx(br_c, 390, 844, css=css)
    V2.preview_api_stub(c, b)
    pg = c.new_page()
    cdp = c.new_cdp_session(pg)
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    pg.goto(b + "/", wait_until="load")
    V2.settle(pg, 600)
    pins = []
    total = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    for k in range(0, 41):                      # a steady scroll top -> bottom in ~6 s, then read every stop
        pg.mouse.wheel(0, total / 40)
        pg.wait_for_timeout(150)
        if k % 4 == 0:
            pins.append(pg.evaluate(JS_PINNED))
    S["pinned_tel"] = pins
    c.close()
    # no JS
    c = ctx(br_c, 390, 844, js=False, css=css)
    pg = c.new_page()
    pg.goto(b + "/", wait_until="load")
    nojs = 0
    for card in pg.evaluate(JS_TARIFF):
        if card["list"]:
            nojs += 1
            continue
        loc = pg.locator(f"article#{card['id']} details > summary").first
        if loc.count():
            loc.click()
            pg.wait_for_timeout(150)
            nojs += pg.evaluate(JS_LIST_VISIBLE, card["id"])
    S["tariff_nojs_n"] = nojs
    c.close()
    # builders page
    c = ctx(br_c, 390, 844, css=css)
    pg = c.new_page()
    pg.goto(b + "/products.html", wait_until="load")
    S["builders_mail"] = pg.evaluate(JS_MAIL)
    S["text_builders"] = dict(words(pg.evaluate(JS_TEXT)))
    c.close()
    # other pages keep their height
    S["other_h"], S["other_style"] = {}, {}
    for tag, w, h in (("tel", 390, 844), ("pc", 1440, 900)):
        c = ctx(br_c, w, h, css=css)
        V2.preview_api_stub(c, b)
        pg = c.new_page()
        for path in STYLE_PAGES:
            try:
                pg.goto(b + path, wait_until="load")
                V2.settle(pg, 300)
                if path in OTHER:
                    S["other_h"][f"{tag}{path}"] = pg.evaluate("document.documentElement.scrollHeight")
                S["other_style"][f"{tag}{path}"] = pg.evaluate(JS_STYLE)
            except Exception:  # noqa: BLE001
                S["other_h"][f"{tag}{path}"] = -1
                S["other_style"][f"{tag}{path}"] = None
        c.close()
    # WebKit: the owner's phone
    S["tariff_webkit"] = None
    if br_w is not None:
        c = ctx(br_w, 390, 844, css=css)
        V2.preview_api_stub(c, b)
        pg = c.new_page()
        pg.goto(b + "/", wait_until="load")
        V2.settle(pg, 600)
        ok = 0
        cards = pg.evaluate(JS_TARIFF)
        for card in cards:
            good = card["toggle"] and card["closed"] and not card["list"] and card["pay"] and card["h"] <= 360
            loc = pg.locator(f"article#{card['id']} details > summary, article#{card['id']} [aria-expanded]").first
            if good and loc.count():
                loc.click()
                pg.wait_for_timeout(250)
                ok += bool(pg.evaluate(JS_LIST_VISIBLE, card["id"]))
        S["tariff_webkit"] = [ok, len(cards)]
        pg.screenshot(path=str(ROOT / "tests" / "_p2_webkit_tel.png"), full_page=False) if "--shots" in sys.argv else None
        c.close()
    return S


def main(argv=None) -> int:
    from playwright.sync_api import sync_playwright
    argv = sys.argv[1:] if argv is None else argv
    url = argv[argv.index("--url") + 1] if "--url" in argv else None
    css = Path(argv[argv.index("--inject-css") + 1]).read_text(encoding="utf-8") if "--inject-css" in argv else None
    with V2.Served(url) as srv, sync_playwright() as p:
        bc = p.chromium.launch()
        try:
            bw = p.webkit.launch()
        except Exception:  # noqa: BLE001
            bw = None
        S = collect(bc, bw, srv.base, css)
        bc.close()
        if bw:
            bw.close()

    if "--write-baseline" in argv:
        FIX.write_text(json.dumps({
            "home_tel_h": S["home_tel_h"], "home_pc_h": S["home_pc_h"], "pay_attrs": S["pay_attrs"],
            "text_home": S["text_home"], "text_builders": S["text_builders"],
            "font_min_tel": S["typo_tel"]["fmin"], "tap_small_tel": S["typo_tel"]["small"], "other_h": S["other_h"],
            "fonts_tel": S["fonts_tel"], "other_style": S["other_style"],
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        print("baseline written", FIX)
    if "--baseline" in argv or "--write-baseline" in argv:
        S2 = {k: v for k, v in S.items() if not k.startswith("text_") and k != "pay_attrs"}
        print(json.dumps(S2, ensure_ascii=False)[:4000])
        return 0

    fails = []

    def key(name, val, ok):
        print(f"{name}={val}")
        if not ok:
            fails.append(name)

    n = len(S["tariff_tel"])
    r = S["home_tel_h"] / BASE["home_tel_h"]
    key("home_tel_h_ratio", f"{r:.2f}({S['home_tel_h']}/{BASE['home_tel_h']})", r <= 0.75)
    r = S["home_pc_h"] / BASE["home_pc_h"]
    key("home_pc_h_ratio", f"{r:.2f}({S['home_pc_h']}/{BASE['home_pc_h']})", r <= 1.05)
    for tag in ("tel", "pc"):
        st = S[f"backdrop_{tag}"]
        share = round(sum(1 for v in st if v >= 0.20) / len(st), 3)
        key(f"backdrop_seen_{tag}", f"{share} stops={len(st)} min={min(st)}", share >= 0.85)
    pins = S["pinned_tel"]
    key("scene_pinned_tel", f"{sum(pins)}/{len(pins)}", all(pins))
    key("no_backdrop_filter", S["typo_tel"]["bf"], S["typo_tel"]["bf"] == 0)
    bad = sorted(set(S["contrast_bad"]))
    key("translucent_contrast_fail", f"{len(bad)}{(' ' + '; '.join(bad[:5])) if bad else ''}", not bad)
    for page, allow in (("home", ALLOW_HOME), ("builders", ALLOW_BUILD)):
        base, now = Counter(BASE.get(f"text_{page}", {})), Counter(S[f"text_{page}"])
        removed, added = base - now, (now - base) - allow
        key(f"text_same_{page}", "ok" if not removed and not added and base else
            f"removed={dict(list(removed.items())[:6])} added={dict(list(added.items())[:6])}",
            bool(base) and not removed and not added)
    t = S["typo_tel"]
    key("font_min_tel", f"{t['fmin']}(base {BASE.get('font_min_tel')})", t["fmin"] >= BASE.get("font_min_tel", 99))
    key("tap_small_tel", f"{t['small']}(base {BASE.get('tap_small_tel')})", t["small"] <= BASE.get("tap_small_tel", -1))
    bf = BASE.get("fonts_tel", {})
    smaller = {k: (S["fonts_tel"][k], v) for k, v in bf.items() if k in S["fonts_tel"] and S["fonts_tel"][k] < v - 0.01}
    key("font_same_tel", f"{'ok' if not smaller else 'smaller=' + str(dict(list(smaller.items())[:4]))} n={len(bf)}",
        bool(bf) and not smaller)
    med = round(statistics.median(t["lh"]), 3) if t["lh"] else 0
    key("line_height_tel", med, 1.40 <= med <= 1.55)
    drift = {k: (v, BASE.get("other_h", {}).get(k)) for k, v in S["other_h"].items()
             if not BASE.get("other_h", {}).get(k) or abs(v - BASE["other_h"][k]) > 0.01 * BASE["other_h"][k]}
    key("other_pages_h", "same" if not drift else f"drift={drift}", not drift)
    sd = [k for k, v in S["other_style"].items() if v is None or v != BASE.get("other_style", {}).get(k)]
    key("other_pages_style", "same" if not sd else f"changed={sd}", not sd and bool(BASE.get("other_style")))
    col = 0
    for tag, lim in (("tel", 360), ("pc", 10 ** 6)):
        for cd in S[f"tariff_{tag}"]:
            col += cd["toggle"] and cd["closed"] and not cd["list"] and cd["price"] and cd["pay"] and cd["h"] <= lim
    key("tariff_collapsed", f"{col}/{2 * n} heights_tel={[cd['h'] for cd in S['tariff_tel']]}", col == 2 * n and n > 0)
    key("tariff_expand", f"{S['tariff_expand_n']}/{n}", S["tariff_expand_n"] == n and n > 0)
    key("tariff_nojs", f"{S['tariff_nojs_n']}/{n}", S["tariff_nojs_n"] == n and n > 0)
    wk = S["tariff_webkit"]
    key("tariff_webkit", f"{wk[0]}/{wk[1]}" if wk else "no-webkit", bool(wk) and wk[0] == wk[1] == n)
    same = S["pay_attrs"] == BASE.get("pay_attrs")
    key("pay_buttons_home", f"{'same' if same else 'changed'}({len(S['pay_attrs'])})", same)
    m = S["builders_mail"]
    key("builders_mail_only", f"{m['n']}{(' ' + ' | '.join(m['hits'][:3])) if m['n'] else ''}", m["n"] == 0)
    key("builders_max_phrase", m["phrase"], m["phrase"] >= 2)
    print(f"P2 status={'ok' if not fails else 'fail'}" + (f" miss={','.join(fails)}" if fails else ""))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
