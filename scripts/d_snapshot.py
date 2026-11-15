#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Снимки страниц «до D» и попиксельная сверка «до/после» перевода цветов на токены.

shoot   — снимки всех опубликованных страниц (кроме meta-refresh) на трёх ширинах;
compare — снимает «после» тем же способом, строит ожидаемое изображение
          («до», где пиксели, точно равные ключу карты цветов, заменены на значение)
          и сравнивает попиксельно вне маски областей сцен.

В печать: ASCII только, последняя строка D_SNAP .../ D_DIFF ....
"""
import argparse
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIDTHS = [(360, 800), (390, 844), (1440, 900)]
SKIP_DIRS = {".git", "tests", "scripts", "docs", "node_modules", "evals"}
PCT_FAIL = 0.5  # порог провала, %% пикселей вне маски
CHAN_TOL = 8

MASK_SEL = [
    "section[data-scene2] [data-scene2-stage]",
    "[data-scene3-stage]",
    "img[data-scene2-poster]",
]
MASK_JS = (
    "() => { const sels = %s; const out = [];"
    " for (const sel of sels)"
    "  for (const el of document.querySelectorAll(sel)) {"
    "   const r = el.getBoundingClientRect();"
    "   if (r.width > 1 && r.height > 1)"
    "    out.push([r.left + window.scrollX, r.top + window.scrollY, r.width, r.height]);"
    " }"
    " return out; }" % json.dumps(MASK_SEL)
)
# доскролл до конца страницы: догрузка loading="lazy" картинок до снимка
SCROLL_JS = (
    "async () => {"
    " const step = Math.max(200, window.innerHeight);"
    " const max = document.documentElement.scrollHeight;"
    " for (let y = 0; y <= max; y += step)"
    "  { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }"
    " window.scrollTo(0, 0);"
    " await new Promise(r => setTimeout(r, 120));"
    " return true; }"
)


def serve():
    """http.server на свободном порту 127.0.0.1, корень — репозиторий."""
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return proc, "http://127.0.0.1:%d" % port


def discover_pages():
    """Все опубликованные *.html (кроме meta-refresh), обходом вне служебных папок."""
    pages = []
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        try:
            html = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if 'http-equiv="refresh"' in html:
            continue
        pages.append("/" + rel.as_posix())
    return pages


def snap_name(page, w):
    return page.lstrip("/").replace("/", "__") + "_%d" % w


def shoot(out_dir: Path) -> int:
    from playwright.sync_api import sync_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = discover_pages()
    if not pages:
        raise SystemExit("no pages found")
    proc, base = serve()
    n = 0
    try:
        with sync_playwright() as p:
            br = p.chromium.launch()
            for w, h in WIDTHS:
                ctx = br.new_context(viewport={"width": w, "height": h},
                                     device_scale_factor=1,
                                     reduced_motion="reduce")
                ctx.route("**/mc.yandex.ru/**", lambda r: r.abort())
                pg = ctx.new_page()
                for path in pages:
                    pg.goto("%s%s?scene-test=1" % (base, path), wait_until="load")
                    pg.evaluate("() => document.fonts.ready.then(() => true)")
                    pg.evaluate(SCROLL_JS)
                    rects = pg.evaluate(MASK_JS)
                    name = snap_name(path, w)
                    pg.screenshot(path=str(out_dir / (name + ".png")), full_page=True)
                    (out_dir / (name + ".mask.json")).write_text(
                        json.dumps(rects), encoding="utf-8")
                    n += 1
                    print("snap %s" % name, file=sys.stderr)
                ctx.close()
            br.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    return n


# ---------------------------------------------------------------- сравнение

def hex2rgb(s: str):
    s = s.strip()
    if not s.startswith("#") or len(s) != 7:
        raise SystemExit("bad hex color: %r (need #rrggbb)" % s)
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def load_colormap(path: Path):
    data = json.loads(path.read_text(encoding="utf-8") or "{}")
    return {hex2rgb(k): hex2rgb(v) for k, v in data.items()}


def load_intended(path: Path):
    names = set()
    if not path.exists():
        return names
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        names.add(line.split()[0])
    return names


def apply_colormap(arr, cmap):
    """Точная замена пикселей, цвет которых равен ключу карты, на значение."""
    import numpy as np
    if not cmap:
        return arr
    packed = (arr[:, :, 0].astype(np.uint32) << 16) | \
             (arr[:, :, 1].astype(np.uint32) << 8) | arr[:, :, 2].astype(np.uint32)
    keys = np.array([(r << 16) | (g << 8) | b for r, g, b in cmap], dtype=np.uint32)
    vals = np.array([cmap[k] for k in cmap], dtype=np.uint8)
    order = np.argsort(keys)
    keys, vals = keys[order], vals[order]
    pos = np.clip(np.searchsorted(keys, packed), 0, len(keys) - 1)
    hit = keys[pos] == packed
    out = arr.copy()
    out[hit] = vals[pos][hit]
    return out


def mask_path(png: Path) -> Path:
    return png.with_name(png.name[:-len(".png")] + ".mask.json")


def load_ignore(mask_json: Path, wh):
    import numpy as np
    w, h = wh
    ignore = np.zeros((h, w), dtype=bool)
    if not mask_json.exists():
        return ignore
    try:
        rects = json.loads(mask_json.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ignore
    for x, y, bw, bh in rects:
        x0, y0 = max(int(x), 0), max(int(y), 0)
        x1, y1 = min(int(x + bw), w), min(int(y + bh), h)
        if x1 > x0 and y1 > y0:
            ignore[y0:y1, x0:x1] = True
    return ignore


def compare_pair(before_png: Path, after_png: Path, cmap):
    """-> (pct, bad(массив общего поля), высоты) либо (None, msg, ...)."""
    import numpy as np
    from PIL import Image
    b = np.asarray(Image.open(before_png).convert("RGB"), dtype=np.uint8)
    a = np.asarray(Image.open(after_png).convert("RGB"), dtype=np.uint8)
    b = apply_colormap(b, cmap)
    hb, wb = b.shape[:2]
    ha, wa = a.shape[:2]
    ch, cw = min(hb, ha), min(wb, wa)
    ig = load_ignore(mask_path(before_png), (wb, hb))[:ch, :cw] | \
         load_ignore(mask_path(after_png), (wa, ha))[:ch, :cw]
    diff = np.abs(b[:ch, :cw].astype(np.int16) - a[:ch, :cw].astype(np.int16)).max(axis=2)
    bad = (diff > CHAN_TOL) & ~ig
    extra = abs(hb - ha) * max(wb, wa)  # разница высот — сразу в отличия
    num = int(bad.sum()) + extra
    den = int((~ig).sum()) + extra
    pct = (100.0 * num / den) if den else 0.0  # проценты, не доля
    return pct, bad


def save_diff_png(bad, after_png: Path, out_png: Path):
    import numpy as np
    from PIL import Image
    base = np.asarray(Image.open(after_png).convert("RGB"), dtype=np.uint8)
    vis = (base[:bad.shape[0], :bad.shape[1]] // 3).astype(np.uint8)
    vis[bad] = (255, 0, 255)
    Image.fromarray(vis).save(out_png)


def run_compare(args) -> int:
    before_dir, after_dir = resolve(args.before), resolve(args.after)
    n = shoot(after_dir)
    print("shot after: %d" % n, file=sys.stderr)
    cmap = load_colormap(resolve(args.colormap))
    intended = load_intended(resolve(args.intended))
    before = {p.name for p in before_dir.glob("*.png") if not p.name.endswith(".diff.png")}
    after = {p.name for p in after_dir.glob("*.png") if not p.name.endswith(".diff.png")}
    names = sorted(before | after)
    fails = 0
    shots = 0
    worst = 0.0
    for fname in names:
        stem = fname[:-len(".png")]
        shots += 1
        if fname not in before or fname not in after:
            side = "after" if fname not in after else "before"
            print("%s pct=100.0000 missing=%s" % (stem, side))
            fails += 1
            worst = max(worst, 100.0)
            continue
        pct, bad = compare_pair(before_dir / fname, after_dir / fname, cmap)
        worst = max(worst, pct)
        if pct > PCT_FAIL and stem not in intended:
            fails += 1
            print("%s pct=%.4f" % (stem, pct))
            save_diff_png(bad, after_dir / fname, after_dir / (stem + ".diff.png"))
    status = "fail" if fails else "ok"
    print("D_DIFF status=%s shots=%d fail=%d worst=%.4f" % (status, shots, fails, worst))
    return 1 if fails else 0


def resolve(p: str) -> Path:
    q = Path(p)
    return q if q.is_absolute() else ROOT / q


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("shoot", help="снять снимки страниц")
    s.add_argument("--out", required=True)
    c = sub.add_parser("compare", help="снять «после» и сверить с «до»")
    c.add_argument("--before", required=True)
    c.add_argument("--after", required=True)
    c.add_argument("--colormap", required=True)
    c.add_argument("--intended", required=True)
    args = ap.parse_args()
    if args.cmd == "shoot":
        print("D_SNAP status=ok shots=%d" % shoot(resolve(args.out)))
        return 0
    return run_compare(args)


if __name__ == "__main__":
    sys.exit(main())
