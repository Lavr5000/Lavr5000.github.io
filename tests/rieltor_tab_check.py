#!/usr/bin/env python
"""Gate of the «Риэлтор» tab (/rieltor/): catalog tiles, subscription tile, menu item. Plan: razovye-uslugi PLAN.md section 5, E6.

    python tests/rieltor_tab_check.py [base_url]          # without base_url a local http.server is started on a free port
    python tests/rieltor_tab_check.py --list               # case ids and their sha256 (the frozen list)

Playwright, Chromium. Nothing leaves the machine: every request to a foreign host is aborted and counted, the order API
(api.ai-vibes.ru) is intercepted and must never be called. Nothing is paid, nothing is sent.

What is checked (ids are printed as `  ok   <id>` / `  FAIL <id>: <reason>`):
  * the catalog copy `uslugi.catalog.js`: its sha256 is the canonical one, it equals the kit catalog (if the kit is found:
    USLUGI_KIT_ROOT or the default working copy) - otherwise that case is SKIP, not counted;
  * the static fallback list between `<!-- USLUGI:BEGIN -->` and `<!-- USLUGI:END -->` (what a visitor without scripts sees)
    equals the catalog: ids, order, prices, bot links, enabled flags, hash;
  * the rendered page (scripts on): tiles are `#uslugi-tiles > [data-uslugi-id]`; the subscription tile is first and bigger,
    its price = catalog = services.js, its button leads to the subscription card; the number of tiles = 1 + services + backlog;
    `enabled=false` and backlog tiles say «скоро» and have neither price nor button; an enabled tile carries the price and
    the button «Заказать в боте» with `?start=usl-<id>`; the tiles follow the catalog when it changes (the copy is intercepted);
    the line «оплата и выдача результата - в боте MAX»; no amount outside the catalog;
  * the menu item «Риэлтор» is on every page with the shared header, highlighted (aria-current) only on /rieltor/;
  * hygiene: no page error, no CSP violation, no foreign request, no call of the order API, no horizontal overflow at
    390/901/1024/1440 px, links of the tiles go only to the site itself or to max.ru.

How the next suite finds things (for tools/dev/rieltor_eval/suites/_uslugi_site.py):
  tile:            `#uslugi-tiles > [data-uslugi-id]`   attributes data-uslugi-id, data-enabled ("1"/"0"), data-kind (subscription|service|backlog)
  title / price:   `.rl-title` / `.rl-price` (absent on «скоро» tiles)
  «скоро» label:   `.rl-soon` (text «скоро»); enabled tile has none; a «скоро» tile has no `a` and no `button` inside
  button:          the only `a.rl-btn` of the tile
Last line: RIELTOR-TAB status=ok|fail cases=N pass=K skip=S
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts"))
from v2_gate import Served, block_metrika, METRIKA, settle   # noqa: E402

NB = " "
API = "https://api.ai-vibes.ru"
BOT = "https://max.ru/id644404692540_3_bot?start="
PAGE = "/rieltor/"
KIT_DEFAULT = Path(os.path.expanduser("~")) / ".claude" / "0 ProEKTi" / "client-agent-kit-rl-uslugi"
MARK_B, MARK_E = "<!-- USLUGI:BEGIN -->", "<!-- USLUGI:END -->"
PAY_NOTE = "оплата и выдача результата — в боте MAX"

SKIP = object()
CASES: list[tuple[str, object, bool]] = []     # (id, function, needs_browser)


def case(cid: str, browser: bool = False):
    def deco(fn):
        CASES.append((cid, fn, browser))
        return fn
    return deco


# ------------------------------------------------------------------------------------------------ data
def read(rel: str) -> str:
    return (ROOT / rel).read_bytes().decode("utf-8")


def parse_catalog_js(text: str) -> dict:
    key = "window.USLUGI_CATALOG = "
    i = text.index(key) + len(key)
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


def catalog() -> dict:
    return parse_catalog_js(read("uslugi.catalog.js"))


def canonical_sha(copy_obj: dict) -> str:
    d = copy.deepcopy(copy_obj)
    d.pop("sha256", None)
    d["subscription"].pop("price_label", None)
    for s in d["services"]:
        s.pop("price_label", None)
    return hashlib.sha256((json.dumps(d, ensure_ascii=False, sort_keys=True, indent=1) + "\n").encode("utf-8")).hexdigest()


def services_js_price(sid: str) -> str:
    m = re.search(r'id:\s*"' + re.escape(sid) + r'".*?priceLabel:\s*\{\s*ru:\s*"([^"]+)"', read("services.js"), re.S)
    assert m, f"services.js has no priceLabel of {sid}"
    return m.group(1)


def flat(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace(NB, " ").replace(" ", " ")).strip()


def expected_tiles(cat: dict) -> list[dict]:
    sub = cat["subscription"]
    out = [dict(id=sub["id"], kind="subscription", enabled=True, title=sub["title"], price=sub["price_label"], href=sub["url"])]
    for s in cat["services"]:
        out.append(dict(id=s["id"], kind="service", enabled=bool(s["enabled"]), title=s["title"],
                        price=s["price_label"] if s["enabled"] else None,
                        href=cat["bot_link_prefix"] + "usl-" + s["id"] if s["enabled"] else None))
    for b in cat["backlog"]:
        out.append(dict(id=b["id"], kind="backlog", enabled=False, title=b["title"], price=None, href=None))
    return out


class Fallback(HTMLParser):
    """Reads the static list between the markers: <li class="uslugi-tile" data-uslugi-id data-enabled>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items, self.ul, self._li, self._cls = [], {}, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "ul":
            self.ul = a
        elif tag == "li":
            self._li = dict(id=a.get("data-uslugi-id"), cls=a.get("class", ""), enabled=a.get("data-enabled"), title="", price=None,
                            soon=False, href=None, btn=None)
            self.items.append(self._li)
        elif tag == "span" and self._li is not None:
            self._cls = a.get("class", "")
        elif tag == "a" and self._li is not None:
            self._li["href"] = a.get("href")
            self._cls = "btn"

    def handle_endtag(self, tag):
        if tag in ("span", "a"):
            self._cls = None
        elif tag == "li":
            self._li = None

    def handle_data(self, data):
        if self._li is None or self._cls is None:
            return
        if "uslugi-title" in self._cls:
            self._li["title"] += data
        elif "uslugi-price" in self._cls:
            self._li["price"] = (self._li["price"] or "") + data
        elif "uslugi-soon" in self._cls:
            self._li["soon"] = True
        elif self._cls == "btn":
            self._li["btn"] = (self._li["btn"] or "") + data


def fallback_block() -> str:
    page = read("rieltor/index.html")
    assert page.count(MARK_B) == 1 and page.count(MARK_E) == 1, "markers of the generated list are missing"
    return page[page.index(MARK_B) + len(MARK_B):page.index(MARK_E)]


# ------------------------------------------------------------------------------------------------ static cases
@case("copy.hash_canonical")
def _(ctx):
    c = catalog()
    assert c.get("sha256") == canonical_sha(c), f"sha256 of the copy {c.get('sha256')} != canonical {canonical_sha(c)}"


@case("copy.equals_kit")
def _(ctx):
    kit = Path(os.environ.get("USLUGI_KIT_ROOT") or KIT_DEFAULT)
    src = kit / "catalog" / "uslugi.json"
    if not src.is_file():
        return SKIP
    data = json.loads(src.read_text(encoding="utf-8"))
    c = catalog()
    assert c["sha256"] == hashlib.sha256((json.dumps(data, ensure_ascii=False, sort_keys=True, indent=1) + "\n").encode("utf-8")).hexdigest(), \
        "the site copy of the catalog differs from the kit catalog"


@case("fallback.equals_catalog")
def _(ctx):
    cat = catalog()
    p = Fallback()
    p.feed(fallback_block())
    exp = expected_tiles(cat)
    assert [i["id"] for i in p.items] == [e["id"] for e in exp], f"ids/order: {[i['id'] for i in p.items]}"
    for it, e in zip(p.items, exp):
        assert flat(it["title"]) == flat(e["title"]), f"{e['id']}: title {it['title']!r}"
        assert (it["enabled"] == "1") == e["enabled"] or e["kind"] == "subscription", f"{e['id']}: enabled flag {it['enabled']!r}"
        if e["kind"] == "subscription" or e["enabled"]:
            assert it["price"] == e["price"], f"{e['id']}: price {it['price']!r} != {e['price']!r}"
            assert it["href"] == e["href"], f"{e['id']}: href {it['href']!r} != {e['href']!r}"
        else:
            assert it["soon"] and it["price"] is None and it["href"] is None, f"{e['id']}: a soon tile must have no price and no link"


@case("fallback.hash_matches_copy")
def _(ctx):
    p = Fallback()
    p.feed(fallback_block())
    assert p.ul.get("data-uslugi-sha256") == catalog()["sha256"], "hash of the fallback list differs from the copy"
    assert p.ul.get("data-uslugi-version") == catalog()["version"], "version of the fallback list differs from the copy"


@case("page.fallback_inside_main_with_h1")
def _(ctx):
    page = read("rieltor/index.html")
    m = re.search(r"<main[^>]*>(.*)</main>", page, re.S)
    assert m and MARK_B in m.group(1), "the generated list must sit inside <main>"
    assert len(re.findall(r"<h1[ >]", page)) == 1, "exactly one h1"
    assert 'src="/uslugi.catalog.js' in page and 'src="/rieltor/rieltor.js' in page, "catalog copy and rieltor.js must be loaded"


@case("copy.price_label_is_formatted")
def _(ctx):
    c = catalog()
    for x in [c["subscription"]] + c["services"]:
        rub, k = divmod(x["price_kop"], 100)
        assert x["price_label"] == f"{rub:,}".replace(",", NB) + (f",{k:02d}" if k else "") + NB + "₽", x["price_label"]


@case("menu.item_on_every_chrome_page")
def _(ctx):
    import build_chrome
    pages = build_chrome.pages()
    assert "rieltor/index.html" in pages, "rieltor/index.html is not in the shared header's page list"
    bad = []
    for rel in pages:
        nav = re.search(r'<nav class="chrome-nav".*?</nav>', read(rel), re.S)
        links = re.findall(r'<a href="([^"]+)"( aria-current="page")?>([^<]+)</a>', nav.group(0)) if nav else []
        hit = [x for x in links if x[2] == "Риэлтор"]
        if len(hit) != 1 or hit[0][0] != PAGE:
            bad.append(f"{rel}: menu item {hit}")
    assert not bad, "; ".join(bad[:4])


@case("menu.current_only_on_rieltor")
def _(ctx):
    import build_chrome
    assert "rieltor/index.html" in build_chrome.pages(), "rieltor/index.html is not in the shared header's page list"
    bad = []
    for rel in build_chrome.pages():
        text = read(rel)
        for scope, rx in (("nav", r'<nav class="chrome-nav".*?</nav>'), ("panel", r'<div class="chrome-panel".*?</div>')):
            m = re.search(rx, text, re.S)
            cur = re.findall(r'<a href="([^"]+)" aria-current="page">([^<]+)</a>', m.group(0)) if m else []
            if rel == "rieltor/index.html":
                if cur != [(PAGE, "Риэлтор")]:
                    bad.append(f"{rel} {scope}: current={cur}")
            elif any(x[1] == "Риэлтор" for x in cur):
                bad.append(f"{rel} {scope}: «Риэлтор» is highlighted")
    assert not bad, "; ".join(bad[:4])


@case("menu.footer_has_link")
def _(ctx):
    foot = re.search(r'<footer class="chrome-foot".*?</footer>', read("services/index.html"), re.S).group(0)
    assert f'<a href="{PAGE}">Риэлтор</a>' in foot, "footer section list has no link to /rieltor/"


@case("build.chrome_id_is_current")
def _(ctx):
    import build_chrome
    bid = build_chrome.build_id()
    for rel in ("rieltor/index.html", "services/index.html"):
        assert f'<meta name="build" content="{bid}" />' in read(rel), f"{rel}: build id is not {bid} (run scripts/build_chrome.py --write)"


@case("subscription.price_equals_catalog_and_services_js")
def _(ctx):
    c = catalog()
    sub = c["subscription"]
    assert sub["id"] == "setup-rieltor"
    assert flat(sub["price_label"]) == flat(services_js_price("setup-rieltor")), \
        f"catalog {sub['price_label']!r} != services.js {services_js_price('setup-rieltor')!r}"
    assert sub["price_kop"] == 990000


@case("subscription.target_card_exists")
def _(ctx):
    url = catalog()["subscription"]["url"]
    path, _, frag = url.partition("#")
    assert path == "/services/" and frag, url
    assert f'id="{frag}"' in read("services/index.html"), f"/services/ has no element #{frag}"
    assert f'data-service-id="setup-rieltor"' in read("services/index.html")


# ------------------------------------------------------------------------------------------------ browser plumbing
class View:
    def __init__(self, br, base, width=1440, height=900, js=True, cat_text=None):
        self.base = base
        self.ctx = br.new_context(viewport={"width": width, "height": height}, locale="ru-RU", java_script_enabled=js)
        host = urlparse(base).netloc
        keep = re.escape(host) + r"|127\.0\.0\.1|localhost"
        self.foreign, self.api, self.errors, self.csp = [], [], [], []
        self.ctx.route(API + "/**", lambda r: (self.api.append(r.request.url), r.fulfill(status=404, body="{}")))
        block_metrika(self.ctx)

        self.ctx.route(re.compile(rf"^https?://(?!(?:{keep})(?:[:/]|$))(?!api\.ai-vibes\.ru)"), lambda r: (
            None if METRIKA.search(r.request.url) else self.foreign.append(r.request.url), r.abort()))
        if cat_text is not None:
            self.ctx.route(re.compile(r"/uslugi\.catalog\.js(\?.*)?$"),
                           lambda r: r.fulfill(status=200, content_type="application/javascript", body=cat_text))
        self.pg = self.ctx.new_page()
        self.pg.add_init_script("document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); });")
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)[:120]))
        self.pg.on("console", lambda m: self.errors.append("console:" + m.text[:120]) if m.type == "error" else None)

    def goto(self, path=PAGE):
        self.pg.goto(self.base + path, wait_until="load")
        settle(self.pg, 300)
        try:
            self.csp = self.pg.evaluate("window.__csp || []")
        except Exception:
            self.csp = []

    def tiles(self):
        return self.pg.evaluate("""() => [...document.querySelectorAll('#uslugi-tiles > [data-uslugi-id]')].map(e => {
          const r = e.getBoundingClientRect(), t = e.querySelector('.rl-title'), p = e.querySelector('.rl-price'), s = e.querySelector('.rl-soon');
          return {id: e.dataset.uslugiId, enabled: e.dataset.enabled, kind: e.dataset.kind, title: t ? t.textContent : null,
            titleSize: t ? parseFloat(getComputedStyle(t).fontSize) : 0, price: p ? p.textContent : null, soon: s ? s.textContent.trim() : null,
            links: [...e.querySelectorAll('a')].map(a => ({text: a.textContent.trim(), href: a.getAttribute('href'), cls: a.className, rel: a.rel})),
            buttons: e.querySelectorAll('button').length, w: r.width, h: r.height, x: r.x, y: r.y, text: e.innerText}; })""")

    def close(self):
        self.ctx.close()


def tiles_of(v: View):
    v.goto()
    t = v.tiles()
    assert t, "no tiles in #uslugi-tiles: the page is not rendered from the catalog"
    return t


# ------------------------------------------------------------------------------------------------ rendered-page cases
@case("render.tiles_present", browser=True)
def _(ctx):
    t = tiles_of(View(ctx.br, ctx.base))
    assert t, "no tiles in #uslugi-tiles: the page is not rendered from the catalog"


@case("render.count_is_sub_plus_services_plus_backlog", browser=True)
def _(ctx):
    cat = catalog()
    t = tiles_of(View(ctx.br, ctx.base))
    n = 1 + len(cat["services"]) + len(cat["backlog"])
    assert len(t) == n, f"{len(t)} tiles, expected {n}"


@case("render.ids_and_kinds_in_catalog_order", browser=True)
def _(ctx):
    exp = expected_tiles(catalog())
    t = tiles_of(View(ctx.br, ctx.base))
    assert [(x["id"], x["kind"]) for x in t] == [(e["id"], e["kind"]) for e in exp], [(x["id"], x["kind"]) for x in t]


@case("render.fallback_replaced_not_duplicated", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto()
    left = v.pg.evaluate("document.querySelectorAll('.uslugi-fallback').length")
    ids = v.pg.evaluate("[...document.querySelectorAll('[data-uslugi-id]')].length")
    assert left == 0 and ids == len(catalog()["services"]) + len(catalog()["backlog"]) + 1, f"fallback lists={left}, tiles with id={ids}"


@case("subscription.first_and_larger", browser=True)
def _(ctx):
    t = tiles_of(View(ctx.br, ctx.base))
    assert t and t[0]["id"] == "setup-rieltor" and t[0]["kind"] == "subscription", "the subscription tile is not first"
    others = [x for x in t[1:] if x["w"] > 0]
    assert others, "no other tiles"
    assert t[0]["w"] >= 1.5 * max(x["w"] for x in others), f"width {t[0]['w']} is not clearly larger than {max(x['w'] for x in others)}"
    assert t[0]["titleSize"] > max(x["titleSize"] for x in others if x["titleSize"]), "subscription title is not the biggest"
    assert all(x["y"] >= t[0]["y"] for x in others), "a tile is above the subscription tile"


@case("subscription.price_and_button", browser=True)
def _(ctx):
    cat = catalog()
    s = tiles_of(View(ctx.br, ctx.base))[0]
    assert flat(s["price"] or "") == flat(services_js_price("setup-rieltor")) == flat(cat["subscription"]["price_label"]), f"price {s['price']!r}"
    assert s["price"] == cat["subscription"]["price_label"], "tile price must be the catalog string byte for byte (NBSP)"
    assert len(s["links"]) == 1 and s["links"][0]["href"] == cat["subscription"]["url"], f"links {s['links']}"
    assert s["links"][0]["text"], "button without a text"


@case("enabled.price_and_bot_link", browser=True)
def _(ctx):
    cat = catalog()
    t = {x["id"]: x for x in tiles_of(View(ctx.br, ctx.base))}
    seen = 0
    for s in cat["services"]:
        if not s["enabled"]:
            continue
        seen += 1
        x = t[s["id"]]
        assert x["enabled"] == "1" and x["price"] == s["price_label"], f"{s['id']}: price {x['price']!r}"
        assert len(x["links"]) == 1 and x["links"][0]["href"] == cat["bot_link_prefix"] + "usl-" + s["id"], f"{s['id']}: links {x['links']}"
        assert x["links"][0]["text"] == "Заказать в боте", x["links"][0]["text"]
        assert "noopener" in x["links"][0]["rel"], "external link without rel=noopener"
        assert x["soon"] is None, "an enabled tile must not say «скоро»"
    assert seen >= 1, "the catalog has no enabled service"


@case("disabled.soon_without_button_or_price", browser=True)
def _(ctx):
    cat = catalog()
    t = {x["id"]: x for x in tiles_of(View(ctx.br, ctx.base))}
    seen = 0
    for s in cat["services"]:
        if s["enabled"]:
            continue
        seen += 1
        x = t[s["id"]]
        assert x["enabled"] == "0" and x["soon"] == "скоро", f"{s['id']}: soon={x['soon']!r} enabled={x['enabled']!r}"
        assert not x["links"] and x["buttons"] == 0, f"{s['id']}: has a button or link {x['links']}"
        assert x["price"] is None and "₽" not in x["text"], f"{s['id']}: shows a price"
    assert seen >= 1


@case("backlog.soon_without_button_or_price", browser=True)
def _(ctx):
    cat = catalog()
    t = {x["id"]: x for x in tiles_of(View(ctx.br, ctx.base))}
    for b in cat["backlog"]:
        x = t[b["id"]]
        assert x["kind"] == "backlog" and x["enabled"] == "0" and x["soon"] == "скоро", f"{b['id']}: {x['kind']} {x['soon']!r}"
        assert not x["links"] and x["buttons"] == 0 and x["price"] is None and "₽" not in x["text"], f"{b['id']}: button or price"
        assert flat(x["title"] or "") == flat(b["title"])


@case("render.follows_catalog_when_it_changes", browser=True)
def _(ctx):
    cat = copy.deepcopy(catalog())
    for s in cat["services"]:
        s["enabled"] = s["id"] == "yurproverka"
    cat["backlog"] = cat["backlog"][:1]
    key = "window.USLUGI_CATALOG = "
    text = read("uslugi.catalog.js")
    head, tail = text[:text.index(key)], text[text.index(key):]
    _, end = json.JSONDecoder().raw_decode(tail[len(key):])
    new = head + key + json.dumps(cat, ensure_ascii=False) + tail[len(key) + end:]
    t = {x["id"]: x for x in tiles_of(View(ctx.br, ctx.base, cat_text=new))}
    assert len(t) == 1 + len(cat["services"]) + 1, f"{len(t)} tiles after the catalog changed"
    y = t["yurproverka"]
    assert y["enabled"] == "1" and y["price"] == cat["services"][1]["price_label"] and y["links"][0]["href"].endswith("?start=usl-yurproverka"), y
    sp = t["spravka-cena"]
    assert sp["soon"] == "скоро" and not sp["links"] and sp["price"] is None, sp


@case("page.pay_note_in_bot", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto()
    body = flat(v.pg.inner_text("main")).lower()
    assert PAY_NOTE.lower() in body, "no «оплата и выдача результата — в боте MAX» on the page"
    enabled = [x for x in v.tiles() if x["enabled"] == "1" and x["kind"] == "service"]
    assert enabled and all(PAY_NOTE.lower() in flat(x["text"]).lower() for x in enabled), "an enabled tile lacks the payment note"


@case("page.no_amount_outside_catalog", browser=True)
def _(ctx):
    cat = catalog()
    allowed = {flat(x["price_label"]) for x in [cat["subscription"]] + cat["services"]}
    v = View(ctx.br, ctx.base)
    v.goto()
    main = flat(v.pg.inner_text("main"))
    found = set(re.findall(r"\d[\d ]*\d ?₽|\d ?₽", main))
    extra = {flat(x) for x in found} - allowed
    assert not extra, f"amounts not in the catalog: {sorted(extra)}"


@case("page.links_only_site_or_max", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto()
    hrefs = v.pg.evaluate("[...document.querySelectorAll('main a[href]')].map(a => a.getAttribute('href'))")
    bad = [h for h in hrefs if not (h.startswith("/") or h.startswith("#") or urlparse(h).netloc == "max.ru")]
    assert hrefs and not bad, f"links: {bad}"


@case("page.hygiene_no_errors_csp_foreign_api", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto()
    v.tiles()
    assert not v.errors, f"page errors: {v.errors[:3]}"
    assert not v.csp, f"CSP violations: {v.csp[:3]}"
    assert not v.foreign, f"foreign requests: {v.foreign[:3]}"
    assert not v.api, f"the order API was called: {v.api[:3]}"


@case("page.no_pay_buttons", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto()
    assert v.pg.evaluate("document.querySelectorAll('[data-pay], #pay-dialog, [data-request]').length") == 0, "payment elements on the tab"


@case("page.no_overflow_at_widths", browser=True)
def _(ctx):
    bad = []
    for w, h in ((390, 800), (901, 800), (1024, 800), (1440, 900)):
        v = View(ctx.br, ctx.base, width=w, height=h)
        v.goto()
        o = v.pg.evaluate("""() => { const de = document.documentElement;
          const nav = document.querySelector('.chrome-in'); return {sw: de.scrollWidth, iw: innerWidth, nav: nav ? nav.scrollWidth - nav.clientWidth : 0}; }""")
        if o["sw"] > o["iw"] or o["nav"] > 0:
            bad.append(f"{w}px: scrollWidth={o['sw']} nav-overflow={o['nav']}")
        v.close()
    assert not bad, "; ".join(bad)


@case("page.mobile_tiles_single_column", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base, width=390, height=800)
    v.goto()
    t = v.tiles()
    assert t and len({round(x["x"]) for x in t}) == 1, f"tiles are not in one column at 390px: {sorted({round(x['x']) for x in t})}"
    assert all(x["w"] <= 390 for x in t)


@case("page.no_script_shows_fallback", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base, js=False)
    v.goto()
    n = v.pg.evaluate("document.querySelectorAll('.uslugi-fallback li').length")
    vis = v.pg.evaluate("(() => { const u = document.querySelector('.uslugi-fallback'); return !!u && u.getBoundingClientRect().height > 0; })()")
    cat = catalog()
    assert n == 1 + len(cat["services"]) + len(cat["backlog"]) and vis, f"fallback items={n} visible={vis}"


@case("menu.rieltor_item_in_browser", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base)
    v.goto(PAGE)
    cur = v.pg.evaluate("[...document.querySelectorAll('.chrome-nav a[aria-current=page]')].map(a => a.textContent.trim() + '|' + a.getAttribute('href'))")
    assert cur == ["Риэлтор|/rieltor/"], f"highlighted: {cur}"
    v.goto("/services/")
    cur2 = v.pg.evaluate("[...document.querySelectorAll('.chrome-nav a[aria-current=page]')].map(a => a.textContent.trim())")
    assert cur2 == ["Тарифы"], f"on /services/ highlighted: {cur2}"
    v.pg.click(".chrome-nav a[href='/rieltor/']")
    v.pg.wait_for_url("**/rieltor/")


@case("menu.mobile_panel_has_rieltor", browser=True)
def _(ctx):
    v = View(ctx.br, ctx.base, width=390, height=800)
    v.goto("/")
    v.pg.click("[data-menu-toggle]")
    v.pg.wait_for_timeout(300)
    assert v.pg.is_visible(".chrome-panel a[href='/rieltor/']"), "the mobile menu has no «Риэлтор»"


# ------------------------------------------------------------------------------------------------ runner
class Ctx:
    br = None
    base = ""


def ids_hash() -> str:
    return hashlib.sha256("\n".join(sorted(c[0] for c in CASES)).encode("utf-8")).hexdigest()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default=None)
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args(argv)
    if a.list:
        for cid, _, _ in CASES:
            print(cid)
        print(f"CASES total={len(CASES)} sha256={ids_hash()}")
        return 0
    from playwright.sync_api import sync_playwright
    ok = fail = skip = 0
    failed: list[str] = []
    ctx = Ctx()
    with Served(a.base) as srv, sync_playwright() as p:
        ctx.base = srv.base
        ctx.br = p.chromium.launch()
        try:
            for cid, fn, _ in CASES:
                try:
                    r = fn(ctx)
                    if r is SKIP:
                        skip += 1
                        print(f"  SKIP {cid}", flush=True)
                    else:
                        ok += 1
                        print(f"  ok   {cid}", flush=True)
                except AssertionError as e:
                    fail += 1
                    failed.append(cid)
                    print(f"  FAIL {cid}: {str(e).strip().splitlines()[0][:220] if str(e).strip() else 'assert'}", flush=True)
                except Exception as e:
                    fail += 1
                    failed.append(cid)
                    msg = str(e).strip().splitlines()[0][:160] if str(e).strip() else ""
                    print(f"  FAIL {cid}: {type(e).__name__}: {msg}", flush=True)
        finally:
            ctx.br.close()
    print(f"RIELTOR-TAB status={'ok' if not fail else 'fail'} cases={len(CASES)} pass={ok} skip={skip}" + (f" fail={fail}" if fail else ""))
    return 0 if not fail else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
