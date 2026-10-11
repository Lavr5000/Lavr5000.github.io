#!/usr/bin/env python3
"""Shared header, footer, dialogs and head assets for every page of ai-vibes.ru.

One menu on every page: the markup lives here and is written between marker comments
(same approach as the JSON-LD block of scripts/build_seo_files.py):

    <!-- chrome:head:begin (scripts/build_chrome.py) --> ... <!-- chrome:head:end -->
    <!-- chrome:header:begin (scripts/build_chrome.py) --> ... <!-- chrome:header:end -->
    <!-- chrome:footer:begin (scripts/build_chrome.py) --> ... <!-- chrome:footer:end -->
    <!-- chrome:dialogs:begin (scripts/build_chrome.py) --> ... <!-- chrome:dialogs:end -->

Usage:
    python scripts/build_chrome.py            dry run, prints what would change
    python scripts/build_chrome.py --write    rewrite the pages
    python scripts/build_chrome.py --check    exit 1 when a page is out of date

A page without markers is migrated on --write: the legacy <header class="nav">…</header> plus its
drawer, and the legacy <footer class="foot">…</footer>, are replaced by the marker blocks.
Line endings of each file are kept. Last line: CHROME status=ok pages=N build=<id>.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_PERSONAL = "https://max.ru/u/f9LHodD0cOJVteiYLPGUodY6uw7J5k_M_QzRJTDzXbK31nlTIokaEh5ebeM"
MAX_CHANNEL = "https://max.ru/channel_ai_vibes"
TG_PERSONAL = "https://t.me/lavr5000"
TG_CHANNEL = "https://t.me/ai_vibes_coding_ru"
MAIL = "lavr5000xxx@gmail.com"

# (menu label, href, key)
MENU = [
    ("Помощник", "/", "home"),
    ("Тарифы", "/services/", "tariffs"),
    ("Для строителей", "/products.html", "builders"),
    ("Статьи", "/blog/", "blog"),
    ("Об авторе", "/about.html", "about"),
]

# page path -> (active menu key, has pay dialogs)
PAGES: dict[str, tuple[str, bool]] = {
    "index.html": ("home", True),
    "services/index.html": ("tariffs", True),
    "products.html": ("builders", True),
    "about.html": ("about", False),
    "blog/index.html": ("blog", False),
    "apps/transkribator/index.html": ("builders", False),
    "oferta.html": ("", False),
    "privacy.html": ("", False),
    "vedomost.html": ("builders", False),
    "nakladnaya.html": ("builders", False),
    "rate.html": ("", False),
    "spasibo/index.html": ("", False),
}
# files whose normalised text forms the build id (a new article does not change it)
BUILD_INPUTS = ["assets/chrome.css", "assets/chrome.js", "assets/site3.css", "assets/site3.js",
                "assets/scene.js", "assets/pay.js", "services.config.js"]

MARK = "(scripts/build_chrome.py)"


def pages() -> dict[str, tuple[str, bool]]:
    found = dict(PAGES)
    for p in sorted((ROOT / "blog").glob("*/index.html")):
        found[p.relative_to(ROOT).as_posix()] = ("blog", False)
    return {k: v for k, v in found.items() if (ROOT / k).is_file()}


def norm(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").lstrip("﻿")


def menu_links(active: str, indent: str) -> str:
    out = []
    for label, href, key in MENU:
        cur = ' aria-current="page"' if key == active else ""
        out.append(f'{indent}<a href="{href}"{cur}>{label}</a>')
    return "\n".join(out)


def header(active: str) -> str:
    return f"""<header class="chrome" data-chrome>
  <div class="chrome-in">
    <a class="chrome-brand" href="/" aria-label="AI Vibes — на главную">
      <span class="chrome-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M15 3.5v3.5h3.5"/><path d="M9 14l2 2 4-4.5"/></svg></span>
      <span class="chrome-name">AI Vibes</span>
    </a>
    <nav class="chrome-nav" aria-label="Разделы сайта">
{menu_links(active, "      ")}
    </nav>
    <a class="chrome-cta" href="/#tarify">Выбрать тариф</a>
    <button class="chrome-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="chrome-panel" aria-label="Открыть меню"><span></span><span></span><span></span></button>
  </div>
  <div class="chrome-panel" id="chrome-panel" data-menu-panel hidden>
{menu_links(active, "    ")}
    <a class="chrome-cta" href="/#tarify">Выбрать тариф</a>
  </div>
  <span class="chrome-progress" data-progress aria-hidden="true"></span>
</header>"""


def footer() -> str:
    return f"""<footer class="chrome-foot" data-chrome-foot>
  <div class="chrome-foot-in">
    <div class="chrome-foot-about">
      <p class="chrome-foot-name">AI Vibes</p>
      <p>Настройка рабочего помощника на компьютере и телефоне. Сервисы для строительных документов.</p>
    </div>
    <div>
      <h2>Разделы</h2>
      <ul>
        <li><a href="/">Помощник</a></li>
        <li><a href="/services/">Тарифы</a></li>
        <li><a href="/products.html">Для строителей</a></li>
        <li><a href="/blog/">Статьи</a></li>
        <li><a href="/about.html">Об авторе</a></li>
      </ul>
    </div>
    <div>
      <h2>Каналы</h2>
      <ul>
        <li><a href="{MAX_CHANNEL}" target="_blank" rel="noopener">Канал в MAX</a></li>
        <li><a href="{TG_CHANNEL}" target="_blank" rel="noopener">Канал в Telegram</a></li>
      </ul>
    </div>
    <div>
      <h2>Документы</h2>
      <ul>
        <li><a href="/oferta.html">Оферта</a></li>
        <li><a href="/privacy.html">Конфиденциальность</a></li>
      </ul>
    </div>
  </div>
  <p class="chrome-foot-legal">AI Vibes · ИП Лаврова Ю.Н. · ИНН 644404692540 · 2026</p>
</footer>"""


def dialogs() -> str:
    return f"""<dialog class="dlg" id="order-dialog" aria-labelledby="order-title">
  <div class="dlg-in">
    <button class="dlg-close" type="button" data-dlg-close aria-label="Закрыть">×</button>
    <p class="dlg-kicker">Заявка</p>
    <h2 id="order-title">Напишите — договоримся о времени</h2>
    <div class="dlg-item"><strong id="order-service"></strong><span id="order-price"></span></div>
    <p>Напишите в MAX, Telegram или на почту: отвечу, уточню задачу и пришлю счёт или ссылку на оплату.</p>
    <div class="dlg-channels">
      <a class="btn-pay" id="order-max" href="{MAX_PERSONAL}" target="_blank" rel="noopener">Написать в MAX</a>
      <a class="btn-line" id="order-tg" href="{TG_PERSONAL}" target="_blank" rel="noopener">Написать в Telegram</a>
      <a class="btn-line" id="order-mail" href="mailto:{MAIL}">Написать на почту</a>
    </div>
    <p class="dlg-note">Кнопки ничего не списывают и не отправляют данные с этой страницы.</p>
  </div>
</dialog>
<dialog class="dlg ym-hide-content" id="pay-dialog" aria-labelledby="pay-title">
  <div class="dlg-in">
    <button class="dlg-close" type="button" data-dlg-close aria-label="Закрыть">×</button>
    <p class="dlg-kicker">Оплата</p>
    <h2 id="pay-title">Оплата настройки</h2>
    <div class="dlg-item"><strong id="pay-service"></strong><span id="pay-price"></span></div>
    <form class="ym-disable-keys" id="pay-form" novalidate>
      <div class="dlg-fields">
        <label for="pay-email">Почта для кассового чека
          <input class="ym-disable-keys" id="pay-email" name="email" type="email" inputmode="email" autocomplete="email" required />
        </label>
        <label for="pay-contact">Телефон или ник в мессенджере
          <input class="ym-disable-keys" id="pay-contact" name="contact" type="text" autocomplete="tel" maxlength="80" required />
          <span class="dlg-hint">По нему свяжусь, чтобы договориться о времени настройки.</span>
        </label>
        <input class="dlg-trap" id="pay-site" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <label class="dlg-consent" for="pay-consent">
          <input id="pay-consent" name="consent" type="checkbox" required />
          <span id="pay-consent-text">Я принимаю условия <a href="/oferta.html" target="_blank" rel="noopener">оферты</a> и даю согласие на обработку моих персональных данных — адреса электронной почты и контакта для связи — для оформления заказа, отправки кассового чека и связи со мной по этому заказу, как описано в <a href="/privacy.html" target="_blank" rel="noopener">политике конфиденциальности</a>.</span>
        </label>
        <button class="btn-pay" id="pay-submit" type="submit">Перейти к оплате</button>
        <p class="dlg-status" id="pay-status" data-state="idle" role="status" aria-live="polite"></p>
        <p class="dlg-note">Оплата проходит на странице Т-Банка, картой или через СБП. Чек придёт на почту.
          Не получается оплатить — <a href="{MAX_PERSONAL}" target="_blank" rel="noopener">напишите в MAX</a>,
          <a href="{TG_PERSONAL}" target="_blank" rel="noopener">в Telegram</a> или на
          <a href="mailto:{MAIL}">{MAIL}</a>.</p>
      </div>
    </form>
  </div>
</dialog>"""


def build_id() -> str:
    h = hashlib.sha256()
    for rel in BUILD_INPUTS:
        p = ROOT / rel
        if p.is_file():
            h.update(rel.encode())
            h.update(norm(p.read_text(encoding="utf-8")).encode("utf-8"))
    for part in (header("x"), footer(), dialogs()):
        h.update(part.encode("utf-8"))
    return h.hexdigest()[:12]


def head_block(bid: str, has_pay: bool) -> str:
    lines = [f'<meta name="build" content="{bid}" />',
             f'<link rel="stylesheet" href="/assets/chrome.css?v={bid}" />',
             f'<script defer src="/assets/chrome.js?v={bid}"></script>']
    if has_pay:
        lines += [f'<script defer src="/services.config.js?v={bid}"></script>',
                  f'<script defer src="/assets/pay.js?v={bid}"></script>']
    return "\n".join(lines)


def block(name: str, body: str) -> str:
    return f"<!-- chrome:{name}:begin {MARK} -->\n{body}\n<!-- chrome:{name}:end -->"


def marker_re(name: str) -> re.Pattern[str]:
    return re.compile(rf"<!-- chrome:{name}:begin [^>]*-->.*?<!-- chrome:{name}:end -->", re.S)


LEGACY_HEADER = re.compile(r'<header class="nav" id="nav">.*?</header>\s*(?:<div class="drawer" id="drawer".*?</div>\s*)?(?=<main)', re.S)
LEGACY_FOOTER = re.compile(r'<footer class="foot">.*?</footer>', re.S)
LEGACY_MODAL = re.compile(r'(?:<!-- =+ МОДАЛКА ЗАЯВКИ =+ -->\s*)?<div class="modal" id="order-modal".*?</div>\s*</div>\s*(?=</body>)', re.S)


def render(rel: str, text: str, bid: str) -> str:
    active, has_pay = pages()[rel]
    nl = "\r\n" if "\r\n" in text else "\n"
    s = norm(text)

    def put(name: str, body: str, legacy: re.Pattern[str] | None, anchor: str) -> None:
        nonlocal s
        new = block(name, body)
        if marker_re(name).search(s):
            s = marker_re(name).sub(lambda _m: new, s, count=1)
        elif legacy is not None and legacy.search(s):
            s = legacy.sub(lambda _m: new + "\n\n", s, count=1)
        elif anchor in s:
            s = s.replace(anchor, new + "\n" + anchor, 1)
        else:
            raise SystemExit(f"{rel}: no place for chrome:{name}")

    put("head", head_block(bid, has_pay), None, "</head>")
    put("header", header(active), LEGACY_HEADER, "<main")
    put("footer", footer(), LEGACY_FOOTER, "</body>")
    if has_pay:
        s = LEGACY_MODAL.sub("", s, count=1)
        put("dialogs", dialogs(), None, "</body>")
    return s.replace("\n", nl)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    bid = build_id()
    stale = []
    for rel in pages():
        p = ROOT / rel
        old = p.read_bytes().decode("utf-8")
        new = render(rel, old, bid)
        if new != old:
            stale.append(rel)
            if a.write:
                p.write_bytes(new.encode("utf-8"))
    n = len(pages())
    if a.check and stale:
        print("stale: " + ", ".join(stale))
        print(f"CHROME status=fail pages={n} stale={len(stale)} build={bid}")
        return 1
    verb = "written" if a.write else "would change"
    if stale:
        print(f"{verb}: " + ", ".join(stale))
    print(f"CHROME status=ok pages={n} build={bid}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
