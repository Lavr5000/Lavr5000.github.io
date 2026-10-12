#!/usr/bin/env python
"""Generates robots.txt, sitemap.xml, llms.txt and the JSON-LD block of index.html and services/index.html
from the site's own HTML (services and prices: the order links `a[data-pay]` / `a[data-request]` of /services/
and /products.html, contacts: the #contact block, archived services of services.js are skipped). Stdlib only, deterministic (no dates), keeps each HTML file's line endings.

DO NOT EDIT the generated files or the block between the seo:jsonld markers by hand:
change the page and run `python scripts/build_seo_files.py --write`.

    python scripts/build_seo_files.py [--root DIR] [--write | --check]

Without a flag: dry run (prints what would change). Last line:
    SEO_FILES status=ok|stale|error pages=N files=<changed, comma-separated>
Exit 0 only for status=ok (in --check) or after a successful --write.

A page gets into sitemap.xml when it carries a self-referencing <link rel="canonical"> on
https://ai-vibes.ru/ and no noindex (so /spasibo/ stays out).
Independent from scripts/build_chrome.py: this script owns only the block between the seo:jsonld markers and
the other one never touches it, so running them in any order gives the same files. Every fact in llms.txt and JSON-LD is read from the pages.
"""
from __future__ import annotations

import html as htmllib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = "https://ai-vibes.ru"
PERSON_NAME = "Денис Лавров"
SKIP_DIRS = {".git", "node_modules", "tests", "docs", "idm", "scripts", "out", ".next"}
TITLE_ONLY = {"about.html"}  # page summary omitted from llms.txt by policy
CONTACT_PREFIXES = ("https://max.ru/", "https://t.me/lavr5000", "mailto:")
SERVICE_PAGES = [("services/index.html", "/services/"), ("products.html", "/products.html")]  # llms.txt order
ROBOTS = ("User-agent: *\nDisallow: /docs/\nDisallow: /idm/\nDisallow: /scripts/\n\n"
          f"Sitemap: {SITE}/sitemap.xml\n")
BEGIN = "<!-- seo:jsonld:begin (scripts/build_seo_files.py) -->"
END = "<!-- seo:jsonld:end -->"
LD_BLOCK = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\r?\n?", re.S)

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def norm(s: str) -> str:
    s = htmllib.unescape(s or "")
    s = re.sub(r"[    ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


class Doc(HTMLParser):
    """Collects what the generator needs; text inside script/style is ignored."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.meta, self.canonical, self.robots = "", {}, None, ""
        self.stack = []          # open elements: (tag, id, class)
        self.orders = []         # (kind pay|request, service-id, data-order, data-price-label, nearest enclosing id)
        self.links = []          # (href, text, enclosing ids, enclosing classes)
        self._a = None
        self._cap = None         # text being captured: ["title", buffer]
        self._skip = 0

    def _ids(self):
        return [i for _, i, _ in self.stack if i]

    def _in(self, ident):
        return ident in self._ids()

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag in ("script", "style", "noscript", "template"):
            self._skip += 1
            return
        if tag == "meta":
            key = (a.get("name") or a.get("property") or "").lower()
            if key:
                self.meta[key] = a.get("content", "")
                if key == "robots":
                    self.robots += " " + a.get("content", "").lower()
            return
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonical = a.get("href")
            return
        if tag in ("br", "img", "input", "hr", "source", "wbr"):
            return
        self.stack.append((tag, a.get("id", ""), a.get("class", "")))
        if tag == "title":
            self._cap = ["title", []]
        if "data-pay" in a or "data-request" in a:
            card = next(iter(reversed(self._ids())), "")
            self.orders.append(("pay" if "data-pay" in a else "request", a.get("data-service-id", ""),
                                a.get("data-order", ""), a.get("data-price-label", ""), card))
        if tag == "a" and a.get("href"):
            self._a = [a["href"], [], self._ids(), [c for _, _, c in self.stack]]

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template"):
            self._skip = max(0, self._skip - 1)
            return
        if tag == "a" and self._a:
            href, txt, ids, classes = self._a
            self.links.append((href, norm("".join(txt)), ids, classes))
            self._a = None
        if self._cap and tag == "title":
            self.title = norm("".join(self._cap[1]))
            self._cap = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self._skip:
            return
        if self._cap:
            self._cap[1].append(data)
        if self._a is not None:
            self._a[1].append(data)


def archived_ids(root: Path) -> set[str]:
    """Ids of services.js records marked `archived: true` (kept for id stability, never published)."""
    f = root / "services.js"
    if not f.exists():
        return set()
    recs = re.split(r"\n  \{", f.read_bytes().decode("utf-8"))
    return {m.group(1) for r in recs if re.search(r"\barchived:\s*true\b", r)
            for m in [re.search(r'\bid:\s*"([^"]+)"', r)] if m}


def read_html(path: Path) -> tuple[str, str]:
    raw = path.read_bytes().decode("utf-8")
    eol = "\r\n" if "\r\n" in raw else "\n"
    return raw, eol


def parse(raw: str) -> Doc:
    d = Doc()
    d.feed(LD_BLOCK.sub("", raw))
    d.close()
    return d


def pages(root: Path) -> list[tuple[str, str, Doc]]:
    out = []
    for f in sorted(root.rglob("*.html")):
        rel = f.relative_to(root).as_posix()
        if set(rel.split("/")[:-1]) & SKIP_DIRS:
            continue
        doc = parse(read_html(f)[0])
        loc = SITE + "/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)
        if doc.canonical == loc and "noindex" not in doc.robots:
            out.append((loc, rel, doc))
    return sorted(out, key=lambda t: t[0])


def contacts(doc: Doc) -> list[tuple[str, str]]:
    seen, out = set(), []
    for href, text, ids, classes in doc.links:
        if "contact" in ids and href.startswith(CONTACT_PREFIXES) and href not in seen:
            seen.add(href)
            out.append((href, text))
    return out


def build(root: Path) -> tuple[dict, list[str], list[str]]:
    idx = parse(read_html(root / "index.html")[0])
    svc = parse(read_html(root / "services" / "index.html")[0])
    site_name = idx.meta.get("og:site_name", "")
    cts = contacts(svc)
    email = next((h[len("mailto:"):] for h, _ in cts if h.startswith("mailto:")), "")
    if not site_name or not email:
        raise SystemExit("SEO_FILES status=error pages=0 files= reason=no og:site_name or mailto in #contact")
    warns = []
    skip = archived_ids(root)
    pg = pages(root)
    out = {"robots.txt": ROBOTS}
    out["sitemap.xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                          + "".join(f"  <url><loc>{loc}</loc></url>\n" for loc, _, _ in pg) + "</urlset>\n")
    L = [f"# {site_name}", "", f"> {norm(idx.meta.get('description', ''))}", "", "## Услуги"]
    seen, tariffs = set(), []
    for rel, path in SERVICE_PAGES:
        doc = svc if rel == "services/index.html" else parse(read_html(root / rel)[0])
        for kind, sid, name, price, card in doc.orders:
            if sid in seen or sid in skip:
                continue
            seen.add(sid)
            url = f"{SITE}{path}{'#' + card if card else ''}"
            L.append(f"- [{norm(name)}]({url}): {norm(price)}")
            if rel == "services/index.html" and kind == "pay":
                tariffs.append((name, price, url))
    if not tariffs:
        warns.append("no a[data-pay] tariff on /services/")
    L += ["", "## Контакты"] + [f"- [{t}]({h})" for h, t in cts] + ["", "## Страницы"]
    for loc, rel, doc in pg:
        desc = "" if rel in TITLE_ONLY else norm(doc.meta.get("description", ""))
        L.append(f"- [{doc.title}]({loc})" + (f": {desc}" if desc else ""))
    out["llms.txt"] = "\n".join(L) + "\n"

    org = {"@type": "Organization", "@id": f"{SITE}/#org", "name": site_name, "url": f"{SITE}/",
           "email": email, "member": {"@id": f"{SITE}/#person"}}
    person = {"@type": "Person", "@id": f"{SITE}/#person", "name": PERSON_NAME, "url": f"{SITE}/about.html",
              "sameAs": [h for h, _ in cts if not h.startswith("mailto:")]}
    website = {"@type": "WebSite", "@id": f"{SITE}/#website", "name": site_name, "url": f"{SITE}/", "inLanguage": "ru"}
    graphs = {"index.html": [website, org, person], "services/index.html": [org, person]}
    for name, price, url in tariffs:
        graphs["services/index.html"].append(
            {"@type": "Service", "@id": url, "name": norm(name), "url": url, "provider": {"@id": f"{SITE}/#org"},
             "offers": {"@type": "Offer", "price": re.sub(r"\D", "", price), "priceCurrency": "RUB", "url": url}})
    for rel, graph in graphs.items():
        raw, eol = read_html(root / rel)
        data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False,
                          separators=(",", ":")).replace("</", "<\\/")
        block = f'{BEGIN}{eol}<script type="application/ld+json">{data}</script>{eol}{END}{eol}'
        body = LD_BLOCK.sub("", raw)
        i = body.lower().find("</head>")
        if i < 0:
            raise SystemExit(f"SEO_FILES status=error pages={len(pg)} files= reason=no </head> in {rel}")
        out[rel] = body[:i] + block + body[i:]
    return out, warns, [loc for loc, _, _ in pg]


def main() -> int:
    root = Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv else Path(__file__).resolve().parents[1]
    out, warns, locs = build(root)
    changed = []
    for rel, text in out.items():
        f = root / rel
        cur = f.read_bytes().decode("utf-8") if f.exists() else None
        if cur != text:
            changed.append(rel)
            if "--write" in sys.argv:
                f.write_bytes(text.encode("utf-8"))
    for w in warns:
        print(f"WARN {w}")
    if "--check" in sys.argv:
        status = "ok" if not changed else "stale"
    elif "--write" in sys.argv:
        status = "ok"
    else:
        status = "ok" if not changed else "stale"
        print("dry run: would change " + (", ".join(changed) or "nothing"))
    print(f"SEO_FILES status={status} pages={len(locs)} files={','.join(changed)}")
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
