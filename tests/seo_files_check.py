#!/usr/bin/env python
"""SEO files gate: robots.txt, sitemap.xml, llms.txt and the JSON-LD blocks agree with the pages.

    python tests/seo_files_check.py [--root DIR]

Offline, stdlib only. Checks over the repository (or DIR):
  a. `scripts/build_seo_files.py --check` passes - the committed files are what the generator writes;
  b. sitemap.xml is valid XML and lists exactly the self-canonical pages without noindex;
  c. robots.txt, read by RFC 9309 (longest match wins, Allow wins a tie), leaves every sitemap path
     and /assets/site2.css open for *, Googlebot, YandexBot, GPTBot, ClaudeBot, PerplexityBot,
     and names the sitemap;
  d. every price in roubles, every label and every explanation of llms.txt is found word for word
     in the pages;
  e. index.html and services/index.html carry exactly one generated JSON-LD block, the JSON parses,
     and the Offer price equals the digits of `#pokaz .price`.
Built-in negative probes (each one must be caught): `Disallow: /`; `Allow: /` + `Disallow: /services/`;
a price that is on no page; a trailing comma in the JSON.
Last line: SEO_FILES_CHECK status=<ok|fail> pages=<n> neg=<caught>/4
"""
from __future__ import annotations

import html as htmllib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

SITE = "https://ai-vibes.ru"
SKIP_DIRS = {".git", "node_modules", "tests", "docs", "idm", "scripts", "out", ".next"}
AGENTS = ["*", "Googlebot", "YandexBot", "GPTBot", "ClaudeBot", "PerplexityBot"]
EXTRA_PATHS = ["/assets/site2.css"]
LD_PAGES = ["index.html", "services/index.html"]
BEGIN = "<!-- seo:jsonld:begin (scripts/build_seo_files.py) -->"
END = "<!-- seo:jsonld:end -->"
LD_SCRIPT = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S | re.I)
FORBIDDEN_KEYS = {"jobTitle", "worksFor", "legalName", "taxID", "vatID", "telephone", "address", "birthDate"}
PRICE = re.compile(r"(?:от )?\d[\d ]*\d ₽|\d ₽")
SM_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def norm(s: str) -> str:
    s = htmllib.unescape(s or "").replace(" ", " ").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


class Page(HTMLParser):
    """Visible text plus attribute values of one page; script and style bodies are skipped."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text, self.attrs, self.canonical, self.noindex, self._skip = [], [], None, False, 0

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag in ("script", "style", "noscript", "template"):
            self._skip += 1
            return
        if tag == "meta" and (a.get("name") or "").lower() == "robots" and "noindex" in a.get("content", "").lower():
            self.noindex = True
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonical = a.get("href")
        self.attrs.extend(norm(v) for v in a.values() if v)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template"):
            self._skip = max(0, self._skip - 1)

    def handle_data(self, data):
        if not self._skip:
            self.text.append(data)


def read(path: Path) -> str:
    return path.read_bytes().decode("utf-8")


def load_pages(root: Path) -> dict[str, Page]:
    out = {}
    for f in sorted(root.rglob("*.html")):
        rel = f.relative_to(root).as_posix()
        if set(rel.split("/")[:-1]) & SKIP_DIRS:
            continue
        p = Page()
        p.feed(read(f))
        p.close()
        out[rel] = p
    return out


def loc_of(rel: str) -> str:
    return SITE + "/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)


def expected_locs(pages: dict[str, Page]) -> set[str]:
    return {loc_of(rel) for rel, p in pages.items() if p.canonical == loc_of(rel) and not p.noindex}


# --- b. sitemap ---------------------------------------------------------------------------------
def check_sitemap(xml_text: str, expected: set[str]) -> list[str]:
    try:
        tree = ET.fromstring(xml_text.encode("utf-8"))
    except ET.ParseError as e:
        return [f"sitemap.xml is not valid XML: {e}"]
    locs = [(el.text or "").strip() for el in tree.iter(SM_NS + "loc")]
    bad = []
    if len(locs) != len(set(locs)):
        bad.append("sitemap.xml lists a page twice")
    if set(locs) - expected:
        bad.append(f"in sitemap.xml but not a self-canonical page: {sorted(set(locs) - expected)}")
    if expected - set(locs):
        bad.append(f"self-canonical page missing from sitemap.xml: {sorted(expected - set(locs))}")
    return bad


# --- c. robots (RFC 9309) -----------------------------------------------------------------------
def parse_robots(text: str) -> tuple[list[tuple[list[str], list[tuple[str, str]]]], list[str]]:
    groups, sitemaps, agents, rules, in_rules = [], [], [], [], False
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "sitemap":
            sitemaps.append(value)
        elif key == "user-agent":
            if in_rules:
                groups.append((agents, rules))
                agents, rules, in_rules = [], [], False
            agents.append(value.lower())
        elif key in ("allow", "disallow") and agents:
            in_rules = True
            if value:
                rules.append((key, value))
    if agents:
        groups.append((agents, rules))
    return groups, sitemaps


def _rule_matches(pattern: str, path: str) -> bool:
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    rx = "".join(".*" if ch == "*" else re.escape(ch) for ch in body)
    return re.match(rx + ("$" if anchored else ""), path) is not None


def robots_allows(text: str, agent: str, path: str) -> bool:
    groups, _ = parse_robots(text)
    own = [r for names, rs in groups if agent.lower() in names for r in rs]
    star = [r for names, rs in groups if "*" in names for r in rs]
    named = any(agent.lower() in names for names, _ in groups)
    best_len, best_allow = -1, True
    for kind, pattern in (own if named else star):
        if _rule_matches(pattern, path):
            if len(pattern) > best_len or (len(pattern) == best_len and kind == "allow"):
                best_len, best_allow = len(pattern), kind == "allow"
    return best_allow


def check_robots(text: str, paths: list[str]) -> list[str]:
    bad = [f"robots.txt closes {path} for {agent}"
           for agent in AGENTS for path in paths if not robots_allows(text, agent, path)]
    if f"{SITE}/sitemap.xml" not in parse_robots(text)[1]:
        bad.append("robots.txt has no Sitemap line for the site map")
    return bad


# --- d. llms.txt --------------------------------------------------------------------------------
def has_price(corpus: str, price: str) -> bool:
    return re.search(r"(?<!\d)(?<!\d )" + re.escape(price), corpus) is not None


def check_llms(text: str, pages: dict[str, Page]) -> list[str]:
    visible = norm(" ".join(norm("".join(p.text)) for p in pages.values()))
    values = {v for p in pages.values() for v in p.attrs}
    bad = []

    def found(fragment: str) -> bool:
        fragment = norm(fragment)
        return not fragment or fragment in visible or fragment in values

    for price in PRICE.findall(text):
        if not has_price(visible + " " + " ".join(sorted(values)), norm(price)):
            bad.append(f"llms.txt price is on no page: {price!r}")
    for line in text.splitlines():
        if line.startswith("## ") or not line.strip():
            continue
        if line.startswith("# "):
            parts = [line[2:]]
        elif line.startswith("> "):
            parts = [line[2:]]
        else:
            m = re.fullmatch(r"- \[(.+?)\]\((\S+?)\)(?:: (.*))?", line)
            if not m:
                bad.append(f"llms.txt line of unknown shape: {line[:60]!r}")
                continue
            label, url, detail = m.group(1), m.group(2), m.group(3) or ""
            parts = [label] + detail.split(" · ")
            if not (url.startswith(SITE + "/") or url in values):
                bad.append(f"llms.txt link is on no page: {url}")
        for part in parts:
            if not found(part):
                bad.append(f"llms.txt text is on no page: {norm(part)[:70]!r}")
    return bad


# --- e. JSON-LD ---------------------------------------------------------------------------------
def _keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from _keys(v)
    elif isinstance(node, list):
        for v in node:
            yield from _keys(v)


def pokaz_price_digits(raw: str) -> str:
    m = re.search(r'id="pokaz"', raw)
    if not m:
        return ""
    m2 = re.search(r'class="price"[^>]*>([^<]+)<', raw[m.end():])
    return re.sub(r"\D", "", htmllib.unescape(m2.group(1))) if m2 else ""


def check_jsonld(rel: str, raw: str) -> list[str]:
    bad = []
    if raw.count(BEGIN) != 1 or raw.count(END) != 1:
        return [f"{rel}: expected exactly one generated JSON-LD block, markers {raw.count(BEGIN)}/{raw.count(END)}"]
    block = raw[raw.index(BEGIN): raw.index(END)]
    scripts = LD_SCRIPT.findall(raw)
    if len(scripts) != 1 or scripts[0] not in block:
        return [f"{rel}: expected one ld+json script inside the markers, found {len(scripts)}"]
    eol = "\r\n" if "\r\n" in raw.replace(block, "") else "\n"
    if eol == "\n" and "\r" in block or eol == "\r\n" and re.search(r"(?<!\r)\n", block):
        bad.append(f"{rel}: the JSON-LD block does not keep the line endings of the file")
    try:
        data = json.loads(scripts[0])
    except ValueError as e:
        return bad + [f"{rel}: JSON-LD does not parse: {e}"]
    extra = FORBIDDEN_KEYS & set(_keys(data))
    if extra:
        bad.append(f"{rel}: JSON-LD carries fields that must not be published: {sorted(extra)}")
    if rel == "services/index.html":
        want = pokaz_price_digits(raw)
        offers = [n.get("offers", {}).get("price") for n in data.get("@graph", []) if n.get("@type") == "Service"]
        if want and offers != [want]:
            bad.append(f"{rel}: Offer price {offers} differs from #pokaz .price {want!r}")
        if not want and offers:
            bad.append(f"{rel}: a Service is published but the page has no #pokaz price")
    return bad


# --- run ----------------------------------------------------------------------------------------
def negative_probes(robots: str, llms: str, pages: dict[str, Page], paths: list[str], svc_raw: str) -> int:
    caught = 0
    caught += bool(check_robots("User-agent: *\nDisallow: /\n\nSitemap: %s/sitemap.xml\n" % SITE, paths))
    caught += bool(check_robots("User-agent: *\nAllow: /\nDisallow: /services/\n\nSitemap: %s/sitemap.xml\n" % SITE, paths))
    first = PRICE.search(llms)
    probe = llms.replace(first.group(0), "1 500 ₽", 1) if first else llms + "- [x](%s/): 1 500 ₽\n" % SITE
    caught += bool(check_llms(probe, pages))
    caught += bool(check_jsonld("services/index.html", svc_raw.replace("}</script>", ",}</script>", 1)))
    return caught


def main() -> int:
    root = Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv else Path(__file__).resolve().parents[1]
    here = Path(__file__).resolve().parents[1]
    bad = []
    gen = subprocess.run([sys.executable, str(here / "scripts" / "build_seo_files.py"), "--root", str(root), "--check"],
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    if gen.returncode != 0:
        bad.append("generator --check: " + (gen.stdout.strip().splitlines() or ["no output"])[-1])
    pages = load_pages(root)
    expected = expected_locs(pages)
    paths = sorted(loc[len(SITE):] for loc in expected) + EXTRA_PATHS
    try:
        robots, sitemap, llms = read(root / "robots.txt"), read(root / "sitemap.xml"), read(root / "llms.txt")
    except FileNotFoundError as e:
        print(f"FAIL missing file: {e.filename}")
        print(f"SEO_FILES_CHECK status=fail pages={len(expected)} neg=0/4")
        return 1
    bad += check_sitemap(sitemap, expected)
    bad += check_robots(robots, paths)
    bad += check_llms(llms, pages)
    raws = {rel: read(root / rel) for rel in LD_PAGES}
    for rel, raw in raws.items():
        bad += check_jsonld(rel, raw)
    neg = negative_probes(robots, llms, pages, paths, raws["services/index.html"])
    for line in bad:
        print("FAIL " + line)
    ok = not bad and neg == 4
    print(f"SEO_FILES_CHECK status={'ok' if ok else 'fail'} pages={len(expected)} neg={neg}/4")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
