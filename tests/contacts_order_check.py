#!/usr/bin/env python
"""Contact order gate (2026-10-03): MAX first, Telegram second, in every contact block.

    python tests/contacts_order_check.py [--root DIR] [--allow-placeholders]

Static check over index.html, about.html, products.html and services/index.html in the repository
(or in DIR, e.g. page bodies saved from production with the same relative paths). Per block:
  * index, about, products, services: the first .final-actions inside #contact;
  * services: .modal-actions inside #order-modal (the order dialog);
the block passes when it has a link whose href is exactly the MAX profile URL and that link comes
before the first link starting with the personal Telegram URL. On services/ the header stamp
"Заявка" must name MAX before Telegram. A page carrying data-po-decision (an unfilled placeholder
for a decision of the site owner) fails unless --allow-placeholders is given.
Last line: CONTACTS_ORDER status=<ok|fail> blocks=<n> failed=<n>
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MAX_URL = "https://max.ru/u/f9LHodD0cOJVteiYLPGUodY6uw7J5k_M_QzRJTDzXbK31nlTIokaEh5ebeM"
TG_URL = "https://t.me/lavr5000"
BLOCKS = [  # (page, container id, block class)
    ("index.html", "contact", "final-actions"),
    ("about.html", "contact", "final-actions"),
    ("products.html", "contact", "final-actions"),
    ("services/index.html", "contact", "final-actions"),
    ("services/index.html", "order-modal", "modal-actions"),
]


def block_hrefs(html: str, container_id: str, cls: str):
    m = re.search(r'id="%s"' % re.escape(container_id), html)
    if not m:
        return None
    rest = html[m.end():]
    m2 = re.search(r'<div[^>]*class="[^"]*\b%s\b[^"]*"[^>]*>' % re.escape(cls), rest)
    if not m2:
        return None
    body = rest[m2.end():]
    end = body.find("</div>")
    body = body if end < 0 else body[:end]
    return re.findall(r'<a\b[^>]*\bhref="([^"]*)"', body)


def block_ok(hrefs) -> bool:
    if not hrefs or MAX_URL not in hrefs:
        return False
    tg = [i for i, h in enumerate(hrefs) if h.startswith(TG_URL)]
    return bool(tg) and hrefs.index(MAX_URL) < tg[0]


def stamp_ok(html: str) -> bool:
    m = re.search(r"<dt>Заявка</dt>\s*<dd>(.*?)</dd>", html, re.S)
    if not m:
        return False
    dd = m.group(1)
    return "MAX" in dd and "Telegram" in dd and dd.index("MAX") < dd.index("Telegram")


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
    for page, cid, cls in BLOCKS:
        hrefs = block_hrefs(pages[page], cid, cls)
        ok = block_ok(hrefs)
        failed += 0 if ok else 1
        print(f"BLOCK {page}#{cid} .{cls} ok={int(ok)} links={len(hrefs or [])}")
    extra = 0
    s_ok = stamp_ok(pages["services/index.html"])
    print(f"STAMP services/index.html ok={int(s_ok)}")
    extra += 0 if s_ok else 1
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
