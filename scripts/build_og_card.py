#!/usr/bin/env python3
"""Render the link-preview card into assets/og-setup-1200x630.jpg.

The card is drawn from the site's own tokens and self-hosted fonts, so the link
preview and the page it opens look like one thing. Nothing is generated at runtime
and nothing leaves the machine: a local static server + Chromium screenshot.

    python scripts/build_og_card.py            # rebuild the asset
    python scripts/build_og_card.py --check    # verify the committed asset is current
"""
from __future__ import annotations

import argparse
import functools
import http.server
import io
import socketserver
import sys
import threading
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent

CARD_HTML = """<!doctype html>
<meta charset="utf-8" />
<link rel="stylesheet" href="/assets/fonts.css" />
<style>
:root{
    --void:#120A0D; --wine:#261017;
    --cream:#F3E9DE; --cream-2:#C6B2A6; --cream-3:#948076;
    --brass:#D9A961; --brass-2:#F0C888; --brass-line:rgba(217,169,97,.42);
    --line:rgba(243,233,222,.10);
    --display:'Prata','Times New Roman',serif;
    --sans:'Golos Text','Segoe UI',system-ui,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,'Consolas',monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:var(--void)}

  .card{
    position:relative;width:1200px;height:630px;overflow:hidden;isolation:isolate;
    background:var(--void);color:var(--cream);font-family:var(--sans);
    padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between;
  }
  .atmos{position:absolute;inset:0;z-index:-1;pointer-events:none}
  .atmos::before{
    content:"";position:absolute;inset:0;
    background:
      radial-gradient(58% 46% at 78% 8%,rgba(217,169,97,.20) 0%,rgba(217,169,97,.07) 34%,transparent 66%),
      radial-gradient(70% 60% at 18% 96%,rgba(122,26,48,.34) 0%,transparent 62%),
      radial-gradient(120% 90% at 50% 0%,#2A1119 0%,#180C11 46%,var(--void) 78%);
  }
  .atmos::after{
    content:"";position:absolute;inset:0;
    background:
      repeating-linear-gradient(to right,rgba(243,233,222,.05) 0 1px,transparent 1px 88px),
      repeating-linear-gradient(to bottom,rgba(243,233,222,.05) 0 1px,transparent 1px 88px);
    -webkit-mask-image:radial-gradient(74% 62% at 62% 30%,#000 0%,transparent 78%);
    mask-image:radial-gradient(74% 62% at 62% 30%,#000 0%,transparent 78%);
  }

  .top{display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px}
  .brand-mark{
    display:grid;place-items:center;width:40px;height:40px;
    border:1px solid var(--brass-line);border-radius:4px;background:rgba(217,169,97,.08);
  }
  .brand-mark svg{width:22px;height:22px;fill:none;stroke:var(--brass);stroke-width:1.6;
    stroke-linecap:round;stroke-linejoin:round}
  .brand-name{font-family:var(--display);font-size:27px;letter-spacing:.01em}
  .host{font-family:var(--mono);font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:var(--cream-3)}

  .eyebrow{display:flex;align-items:center;gap:14px;margin-bottom:22px;
    font-family:var(--mono);font-size:14px;font-weight:500;letter-spacing:.18em;
    text-transform:uppercase;color:var(--brass)}
  .eyebrow s{display:block;width:34px;height:1px;background:var(--brass-line);text-decoration:none}

  h1{margin:0;font-family:var(--display);font-weight:400;font-size:62px;line-height:1.1;
    letter-spacing:-.012em;max-width:19ch}
  h1 .em{color:var(--brass-2)}

  .plates{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .plate{
    border:1px solid var(--line);border-radius:4px;padding:18px 22px 20px;
    background:linear-gradient(160deg,var(--wine) 0%,rgba(24,12,17,.72) 100%);
  }
  .plate-top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}
  .plate-no{font-family:var(--mono);font-size:12px;letter-spacing:.2em;color:var(--brass);text-transform:uppercase}
  .plate-price{font-family:var(--mono);font-size:15px;font-weight:500;color:var(--cream);white-space:nowrap}
  .plate-title{font-family:var(--display);font-size:25px;line-height:1.22;letter-spacing:-.012em}
</style>
<div class="card" id="card">
  <div class="atmos" aria-hidden="true"></div>

  <div class="top">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M15 3.5v3.5h3.5"/><path d="M9 14l2 2 4-4.5"/></svg>
      </span>
      <span class="brand-name">AI Vibes</span>
    </div>
    <span class="host">ai-vibes.ru</span>
  </div>

  <div>
    <div class="eyebrow"><s></s>Внедрение AI в ваш рабочий день</div>
    <h1>Ставлю AI на ваш компьютер и довожу до <span class="em">рабочего состояния</span></h1>
  </div>

  <div class="plates">
    <div class="plate">
      <div class="plate-top"><span class="plate-no">Услуга 01</span><span class="plate-price">15 000 ₽</span></div>
      <div class="plate-title">Claude Code на рабочем месте</div>
    </div>
    <div class="plate">
      <div class="plate-top"><span class="plate-no">Услуга 02</span><span class="plate-price">15 000 ₽</span></div>
      <div class="plate-title">Hermes Agent: ноутбук + телефон</div>
    </div>
  </div>
</div>
"""

TMP_NAME = ".og-card.build.html"   # живёт только на время рендера
OUT = REPO / "assets" / "og-setup-1200x630.jpg"
W, H, SCALE, QUALITY = 1200, 630, 2, 88


def render() -> bytes:
    from playwright.sync_api import sync_playwright

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(REPO))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as srv:
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        port = srv.server_address[1]
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": W, "height": H},
                                    device_scale_factor=SCALE)
            # Карточка кладётся временным файлом в корень репозитория и оттуда
            # открывается: так /assets/fonts.css резолвится в настоящие шрифты репо.
            # set_content здесь не годится — страница сайта отдаёт CSP default-src 'self',
            # и подставленный инлайновый <style> просто не применяется.
            tmp = REPO / TMP_NAME
            tmp.write_text(CARD_HTML, encoding="utf-8")
            try:
                page.goto(f"http://127.0.0.1:{port}/{TMP_NAME}", wait_until="networkidle")
                page.evaluate("document.fonts.ready")
                shot = page.locator("#card").screenshot(type="png")
            finally:
                tmp.unlink(missing_ok=True)
            browser.close()
        srv.shutdown()

    img = Image.open(io.BytesIO(shot)).convert("RGB").resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="не писать файл; сравнить размеры и вернуть 1 при расхождении")
    args = ap.parse_args()

    data = render()
    if args.check:
        # Байтовое равенство JPEG между машинами не гарантировано (версия Chromium,
        # хинтинг шрифтов), поэтому проверяем то, что важно потребителю превью:
        # файл на месте, это 1200x630 JPEG и он не пустой.
        if not OUT.exists():
            print(f"FAIL: {OUT.name} отсутствует", file=sys.stderr)
            return 1
        img = Image.open(OUT)
        ok = img.format == "JPEG" and img.size == (W, H) and OUT.stat().st_size > 20_000
        print(f"og card: {OUT.name} {img.format} {img.size} {OUT.stat().st_size} Б "
              f"(свежий рендер {len(data)} Б) -> {'OK' if ok else 'FAIL'}")
        return 0 if ok else 1

    OUT.write_bytes(data)
    print(f"og card: {OUT.relative_to(REPO)} {len(data)} Б, {W}x{H}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
