#!/usr/bin/env python3
"""P2 acceptance check (PO 14.11 19:05): the home page on a phone is compact, its sections let the moving backdrop
show through, the tariff cards open from a short collapsed view, and the builders page does not promise e-mail only.

Serves this worktree like v3_gate.py (helpers of v2_gate.py) and prints one line per key, then
`P2 status=ok|fail`. Thresholds are frozen from the baseline of e7ea2ea (`--baseline` prints the raw numbers).

Keys
  home_tel_h_ratio      document height of / at 390x844 divided by the frozen baseline        <= 0.70
  home_pc_h_ratio       the same at 1440x900                                                   <= 1.05
  backdrop_seen_tel     share of scroll stops (every half screen) where >= 20 % of a 6x12 point
                        grid reaches the scene backdrop through see-through layers              >= 0.85
  backdrop_seen_pc      the same at 1440x900                                                   >= 0.85
  translucent_contrast_fail  text inside a see-through layer whose contrast is < 4.5 against its layer
                        colour composited over black OR over white (worst case of the backdrop)  = 0
  tariff_collapsed      cards of / (390 and 1440) that start collapsed: a toggle with
                        aria-expanded=false or a closed <details>, the list hidden, price and pay
                        button visible, card height <= 360 px on 390                           = N/N
  tariff_expand         after one click on the toggle the list is visible (390, JS on)          = N/N
  tariff_nojs           with JavaScript off the full list can still be reached (visible, or one
                        click on <summary> shows it)                                            = N/N
  pay_buttons_home      [data-pay] buttons on / with the same data-* as e7ea2ea                 = baseline set
  builders_mail_only    text blocks of /products.html (outside the pay dialog, contact block and
                        footer) that mention mail without MAX                                   = 0
The backdrop is position:fixed under <main> and ignores the pointer: a point "reaches" it when every element
above <main> at that point is see-through. A layer is "see-through" when its computed background colour alpha is <= 0.80 and it has no background image.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
import v2_gate as V2  # noqa: E402

BASE = {"home_tel_h": 10030, "home_pc_h": 10587, "pay_attrs": None}
FIX = ROOT / "tests" / "fixtures" / "p2_baseline.json"
if FIX.exists():
    BASE.update(json.loads(FIX.read_text(encoding="utf-8")))

JS_LAYERS = r"""
(() => {
  const parse = (c) => { let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; } return null; };
  const alpha = (c) => { const v = parse(c); return v ? v[3] : 1; };
  const bd = document.querySelector('[data-scene-bg]');
  const head = document.querySelector('header');
  const top = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
  let hit = 0, n = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) {
    const x = innerWidth * (i + 0.5) / 6, y = top + (innerHeight - top) * (j + 0.5) / 12;
    n++;
    let ok = false;
    for (const el of document.elementsFromPoint(x, y)) {
      /* the fixed backdrop ignores the pointer, so reaching <main>/<body> through see-through layers means it shows */
      if ((bd && (el === bd || bd.contains(el))) || el.tagName === 'MAIN' || el === document.body || el === document.documentElement) { ok = true; break; }
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') break;
      if (alpha(cs.backgroundColor) > 0.80) break;
    }
    if (ok) hit++;
  }
  return hit / n;
})()
"""

JS_CONTRAST = r"""
(() => {
  const parse = (c) => { let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; } return null; };
  const rgba = parse;
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bd = document.querySelector('[data-scene-bg]');
  const bad = [];
  for (const el of document.querySelectorAll('main p, main li, main h1, main h2, main h3, main span, main a, main strong, main label')) {
    if (!el.offsetParent || !el.textContent.trim()) continue;
    if (bd && bd.contains(el)) continue;
    let own = null;
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0.01) { own = c; break; }
    }
    if (!own || own[3] > 0.80) continue;           // opaque or no layer: checked by the main gate
    const fg = rgba(getComputedStyle(el).color);
    if (!fg) continue;
    const a = own[3];
    for (const under of [[0, 0, 0], [255, 255, 255]]) {
      const bg = [0, 1, 2].map((k) => own[k] * a + under[k] * (1 - a));
      if (ratio(fg.slice(0, 3), bg) < 4.5) { bad.push(el.tagName + ':' + el.textContent.trim().slice(0, 30)); break; }
    }
  }
  return bad;
})()
"""

JS_TARIFF = r"""
((stage) => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  return [...document.querySelectorAll('article.tariff')].map((card) => {
    const list = card.querySelector('.tariff-list');
    const det = card.querySelector('details');
    const btn = card.querySelector('[aria-expanded]');
    const toggle = det ? det.querySelector('summary') : btn;
    return {
      id: card.id,
      toggle: !!toggle,
      closed: det ? !det.open : (btn ? btn.getAttribute('aria-expanded') === 'false' : false),
      list: vis(list),
      price: vis(card.querySelector('.tariff-price')),
      pay: vis(card.querySelector('[data-pay]')),
      h: Math.round(card.getBoundingClientRect().height),
    };
  });
})()
"""

JS_PAY = "[...document.querySelectorAll('[data-pay]')].map(b => [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).sort().join('|')).sort()"

JS_MAIL = r"""
(() => {
  const skip = (el) => el.closest('dialog, #contact, .contact, footer, [data-chrome-foot], .pay-dlg');
  let n = 0; const hits = [];
  for (const el of document.querySelectorAll('main p, main h1, main h2, main h3, main li')) {
    if (skip(el)) continue;
    const t = el.textContent.replace(/\s+/g, ' ');
    if (/почт/i.test(t) && !/MAX/.test(t)) { n++; hits.push(t.slice(0, 60)); }
  }
  return {n, hits};
})()
"""


def scroll_stops(pg):
    total = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    step = pg.evaluate("innerHeight") / 2
    seen, y = [], 0
    while True:
        pg.evaluate(f"window.scrollTo(0,{int(y)})")
        pg.wait_for_timeout(60)
        seen.append(pg.evaluate(JS_LAYERS))
        if y >= total:
            break
        y = min(total, y + step)
    return seen


def ctx(br, w, h, js=True):
    c = br.new_context(locale="ru-RU", viewport={"width": w, "height": h}, java_script_enabled=js,
                       **({"is_mobile": True, "has_touch": True} if w < 1000 else {}))
    V2.block_metrika(c)
    return c


def main(argv=None) -> int:
    from playwright.sync_api import sync_playwright
    baseline = "--baseline" in (argv or sys.argv[1:])
    S, fails = {}, []
    with V2.Served(None) as srv, sync_playwright() as p:
        br = p.chromium.launch()
        b = srv.base
        for tag, w, h in (("tel", 390, 844), ("pc", 1440, 900)):
            c = ctx(br, w, h)
            V2.preview_api_stub(c, b)
            pg = c.new_page()
            pg.goto(b + "/", wait_until="load")
            V2.settle(pg, 600)
            S[f"home_{tag}_h"] = pg.evaluate("document.documentElement.scrollHeight")
            stops = scroll_stops(pg)
            S[f"backdrop_seen_{tag}"] = round(sum(1 for s in stops if s >= 0.20) / len(stops), 3)
            pg.evaluate("window.scrollTo(0,0)")
            S.setdefault("translucent_contrast_bad", []).extend(pg.evaluate(JS_CONTRAST))
            cards = pg.evaluate(JS_TARIFF)
            S[f"tariff_{tag}"] = cards
            if tag == "tel":
                S["pay_attrs"] = pg.evaluate(JS_PAY)
                exp = 0
                for card in cards:
                    loc = pg.locator(f"article#{card['id']} details > summary, article#{card['id']} [aria-expanded]").first
                    if card["toggle"] and loc.count():
                        loc.click()
                        pg.wait_for_timeout(250)
                        exp += pg.evaluate(f"(() => {{ const l = document.querySelector('article#{card['id']} .tariff-list'); return !!l && l.getClientRects().length > 0; }})()")
                S["tariff_expand_n"] = exp
            c.close()
        # no JS
        c = ctx(br, 390, 844, js=False)
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
                nojs += pg.evaluate(f"(() => {{ const l = document.querySelector('article#{card['id']} .tariff-list'); return !!l && l.getClientRects().length > 0; }})()")
        S["tariff_nojs_n"] = nojs
        c.close()
        c = ctx(br, 390, 844)
        pg = c.new_page()
        pg.goto(b + "/products.html", wait_until="load")
        S["builders_mail"] = pg.evaluate(JS_MAIL)
        c.close()
        br.close()

    if baseline:
        print(json.dumps({k: S[k] for k in ("home_tel_h", "home_pc_h", "pay_attrs")}, ensure_ascii=False, indent=1))
        print(json.dumps({k: v for k, v in S.items() if k not in ("pay_attrs",)}, ensure_ascii=False)[:3000])
        return 0

    n = len(S["tariff_tel"])

    def key(name, val, ok):
        print(f"{name}={val}")
        if not ok:
            fails.append(name)

    r = S["home_tel_h"] / BASE["home_tel_h"]
    key("home_tel_h_ratio", f"{r:.2f}({S['home_tel_h']}/{BASE['home_tel_h']})", r <= 0.70)
    r = S["home_pc_h"] / BASE["home_pc_h"]
    key("home_pc_h_ratio", f"{r:.2f}({S['home_pc_h']}/{BASE['home_pc_h']})", r <= 1.05)
    key("backdrop_seen_tel", S["backdrop_seen_tel"], S["backdrop_seen_tel"] >= 0.85)
    key("backdrop_seen_pc", S["backdrop_seen_pc"], S["backdrop_seen_pc"] >= 0.85)
    bad = sorted(set(S["translucent_contrast_bad"]))
    key("translucent_contrast_fail", f"{len(bad)}{(' ' + '; '.join(bad[:5])) if bad else ''}", not bad)
    col = 0
    for tag, lim in (("tel", 360), ("pc", 10 ** 6)):
        for cd in S[f"tariff_{tag}"]:
            col += cd["toggle"] and cd["closed"] and not cd["list"] and cd["price"] and cd["pay"] and cd["h"] <= lim
    key("tariff_collapsed", f"{col}/{2 * n} heights_tel={[cd['h'] for cd in S['tariff_tel']]}", col == 2 * n and n > 0)
    key("tariff_expand", f"{S['tariff_expand_n']}/{n}", S["tariff_expand_n"] == n and n > 0)
    key("tariff_nojs", f"{S['tariff_nojs_n']}/{n}", S["tariff_nojs_n"] == n and n > 0)
    same = BASE["pay_attrs"] is not None and S["pay_attrs"] == BASE["pay_attrs"]
    key("pay_buttons_home", f"{'same' if same else 'changed'}({len(S['pay_attrs'])})", same)
    m = S["builders_mail"]
    key("builders_mail_only", f"{m['n']}{(' ' + ' | '.join(m['hits'][:3])) if m['n'] else ''}", m["n"] == 0)
    print(f"P2 status={'ok' if not fails else 'fail'}" + (f" miss={','.join(fails)}" if fails else ""))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
