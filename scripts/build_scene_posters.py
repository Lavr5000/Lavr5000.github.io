"""Posters and first-frame fixtures of the scroll scenes (assets/scene2.js).

For every scene the page is opened in test mode (`?scene-test=1`) on a local server and painted with
window.__scene2.go(P):
  * P = 1, canvas pixels -> assets/scene2/<name>_pc.webp (1600x1000: a 1440x900 screen at DPR 1.11) and <name>_tel.webp (780x1688, a 390x844 phone
    screen at DPR 2); the poster is what a visitor without scripts or with reduced motion sees;
  * P = 0, screenshot of the stage at 1440x900 and 390x844 -> tests/fixtures/scene2/<name>_p0_{pc,tel}.png (the gate
    compares the live first frame with them).

  python scripts/build_scene_posters.py            # write
  python scripts/build_scene_posters.py --check    # re-render and compare with the committed files (dHash, distance <= 4)

Last line: SCENE_POSTERS status=ok|stale|error files=N worst=<distance>.
"""
from __future__ import annotations

import argparse
import base64
import io
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENES = {"house": "/products.html", "kvartira": "/rieltor/"}
POSTERS = {"pc": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1600 / 1440),
           "tel": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}
FRAMES = {"pc": dict(viewport={"width": 1440, "height": 900}),
          "tel": dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)}
WEBP_Q = {"pc": 80, "tel": 78}
MAX_DIST = 4


def dhash(img, size: int = 16) -> int:
    from PIL import Image
    g = img.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = list(g.tobytes())
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (px[y * (size + 1) + x] > px[y * (size + 1) + x + 1])
    return bits


def serve():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return proc, f"http://127.0.0.1:{port}"


def render(base: str) -> dict:
    """{relative path: PIL image} for every scene present on its page."""
    from PIL import Image
    from playwright.sync_api import sync_playwright
    out = {}
    with sync_playwright() as p:
        br = p.chromium.launch()
        for name, path in SCENES.items():
            for vk, kw in POSTERS.items():
                c = br.new_context(**kw)
                pg = c.new_page()
                pg.goto(f"{base}{path}?scene-test=1", wait_until="load")
                if not pg.evaluate(f"() => !!(window.__scene2 && document.querySelector('section[data-scene2=\"{name}\"]'))"):
                    c.close()
                    break
                pg.evaluate(f"() => window.__scene2.go(1, '{name}')")
                pg.wait_for_timeout(1500)  # frame-sequence drawers fetch the frame for P first; paint again once it is here
                pg.evaluate(f"() => window.__scene2.go(1, '{name}')")
                url = pg.evaluate(f"() => document.querySelector('section[data-scene2=\"{name}\"] canvas[data-scene2-canvas]').toDataURL('image/png')")
                out[f"assets/scene2/{name}_{vk}.webp"] = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
                c.close()
            else:
                for vk, kw in FRAMES.items():
                    c = br.new_context(**kw)
                    pg = c.new_page()
                    pg.goto(f"{base}{path}?scene-test=1", wait_until="load")
                    pg.evaluate(f"() => window.__scene2.go(0, '{name}')")
                    pg.wait_for_timeout(1500)
                    pg.evaluate(f"() => window.__scene2.go(0, '{name}')")
                    shot = pg.locator(f'section[data-scene2="{name}"] :is([data-scene2-stage], .scene2-stage)').screenshot()
                    out[f"tests/fixtures/scene2/{name}_p0_{vk}.png"] = Image.open(io.BytesIO(shot)).convert("RGB")
                    c.close()
        br.close()
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    from PIL import Image
    proc, base = serve()
    try:
        imgs = render(base)
    finally:
        proc.terminate()
    if not imgs:
        print("SCENE_POSTERS status=error files=0 worst=-1 (no scene found)")
        return 2
    worst, stale = 0, []
    for rel, im in sorted(imgs.items()):
        f = ROOT / rel
        if a.check:
            if not f.exists():
                stale.append(f"{rel}: missing")
                continue
            if f.suffix == ".webp":  # the same lossy encoding as the committed poster, so only a real change counts
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=WEBP_Q[f.stem.rsplit("_", 1)[1]], method=6)
                im = Image.open(io.BytesIO(buf.getvalue()))
            d = bin(dhash(im) ^ dhash(Image.open(f))).count("1")
            worst = max(worst, d)
            if d > MAX_DIST:
                stale.append(f"{rel}: dHash distance {d}")
        else:
            f.parent.mkdir(parents=True, exist_ok=True)
            if f.suffix == ".webp":
                vk = f.stem.rsplit("_", 1)[1]
                im.save(f, "WEBP", quality=WEBP_Q[vk], method=6)
            else:
                im.save(f, "PNG", optimize=True)
            print(f"{rel}: {im.size[0]}x{im.size[1]} {round(f.stat().st_size / 1024, 1)} KB")
    for s in stale:
        print(s)
    status = "stale" if stale else "ok"
    print(f"SCENE_POSTERS status={status} files={len(imgs)} worst={worst}")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
