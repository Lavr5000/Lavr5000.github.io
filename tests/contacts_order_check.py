#!/usr/bin/env python
"""Contact order gate (2026-10-03, reworked for the v2 layout 2026-10-11): MAX, then Telegram, then e-mail.

    python tests/contacts_order_check.py [--root DIR] [--allow-placeholders]

Static check over index.html, about.html, products.html and services/index.html in the repository
(or in DIR, e.g. page bodies saved from production with the same relative paths). Per block:
  * index, about, products, services: the whole `#contact` element (from its opening tag to the
    matching closing tag);
  * index, products, services: the order dialog `dialog#order-dialog` (all three carry the dialogs block
    of scripts/build_chrome.py);
the block passes when it has a link whose href is exactly the MAX profile URL, a link starting with the
personal Telegram URL after it, and a mailto: link after that. (The v1 gate checked MAX before Telegram
only and read the "Заявка" stamp of services/; the stamp no longer exists, the dialog check covers it.)
A page carrying data-po-decision (an unfilled placeholder for a decision of the site owner) fails unless
--allow-placeholders is given.
Last line: CONTACTS_ORDER status=<ok|fail> blocks=<n> failed=<n>
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MAX_URL = "https://max.ru/u/f9LHodD0cOJVteiYLPGUodY6uw7J5k_M_QzRJTDzXbK31nlTIokaEh5ebeM"
TG_URL = "https://t.me/lavr5000"
BLOCKS = [  # (page, container id, container tag)
    ("index.html", "contact", "section"),
    ("about.html", "contact", "section"),
    ("products.html", "contact", "section"),
    ("services/index.html", "contact", "section"),
    ("index.html", "order-dialog", "dialog"),
    ("products.html", "order-dialog", "dialog"),
    ("services/index.html", "order-dialog", "dialog"),
]


def block_hrefs(html: str, container_id: str, tag: str):
    """hrefs of all links inside <tag id="container_id"> ... its matching </tag> (nesting of the same tag counted)."""
    m = re.search(r'<%s\b[^>]*\bid="%s"[^>]*>' % (tag, re.escape(container_id)), html)
    if not m:
        return None
    depth, pos = 1, m.end()
    for t in re.finditer(r"<(/?)%s\b[^>]*>" % tag, html[pos:]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            return re.findall(r'<a\b[^>]*\bhref="([^"]*)"', html[pos:pos + t.start()])
    return None


def block_ok(hrefs) -> bool:
    if not hrefs or MAX_URL not in hrefs:
        return False
    tg = [i for i, h in enumerate(hrefs) if h.startswith(TG_URL)]
    mail = [i for i, h in enumerate(hrefs) if h.startswith("mailto:")]
    return bool(tg) and bool(mail) and hrefs.index(MAX_URL) < tg[0] < mail[0]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument("--allow-placeholders", action="store_true")
    a = ap.parse_args()
    root = Path(a.root)
    failed = 0
    pages = {}
    for page in sorted({b[0] for b in BLOCKS}):
        p = root / page
        pages[page] = p.read_text(encoding="utf-8") if p.exists() else ""
    for page, cid, tag in BLOCKS:
        hrefs = block_hrefs(pages[page], cid, tag)
        ok = block_ok(hrefs)
        failed += 0 if ok else 1
        print(f"BLOCK {page}#{cid} <{tag}> ok={int(ok)} links={len(hrefs or [])}")
    extra = 0
    for page, html in pages.items():
        if not html:
            print(f"PAGE {page} missing")
            extra += 1
        elif "data-po-decision" in html:
            print(f"PLACEHOLDER {page} data-po-decision present"
                  + (" (allowed)" if a.allow_placeholders else " — fail"))
            extra += 0 if a.allow_placeholders else 1
    status = "ok" if failed == 0 and extra == 0 else "fail"
    print(f"CONTACTS_ORDER status={status} blocks={len(BLOCKS)} failed={failed + extra}")
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
