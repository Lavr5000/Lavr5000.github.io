"""Chapter photos of the scroll scenes (assets/scene2/photo.js) from the generated source frames.

Each source (a horizontal photo, any size) becomes
  * assets/scene2/<frame>_pc.webp  - 1440x900, centre crop to 16:10;
  * assets/scene2/<frame>_tel.webp - 600x1300, a vertical crop around the subject (focus x, share of the width).
The sources live outside the repository (gemini-media-contour task folders); the table below is the only place
that names them.

  python scripts/build_scene_photos.py --src <dir with the source jpgs>

Last line: SCENE_PHOTOS status=ok files=N kb_pc_max=… kb_tel_max=…
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# frame -> (source file name in --src, focus x for the phone crop)
FRAMES = {
    "crane_1": ("crane_1.jpg", 0.50),
    "crane_2": ("crane_2.jpg", 0.52),
    "crane_3": ("crane_3.jpg", 0.55),
    "crane_4": ("crane_4.jpg", 0.57),
    "deal_1": ("deal_1.jpg", 0.50),
    "deal_2": ("deal_2.jpg", 0.50),
    "deal_3": ("deal_3.jpg", 0.50),
}
PC, TEL = (1440, 900), (600, 1300)
Q = {"pc": 55, "tel": 55}
# generator grain costs half the bytes and is invisible after the downscale: a light blur first
SOFTEN = 1.0


def crop(im, box_w: int, box_h: int, fx: float):
    from PIL import Image
    W, H = im.size
    r = box_w / box_h
    if W / H > r:
        cw, ch = round(H * r), H
    else:
        cw, ch = W, round(W / r)
    x0 = min(max(round(fx * W - cw / 2), 0), W - cw)
    y0 = (H - ch) // 2
    return im.crop((x0, y0, x0 + cw, y0 + ch)).resize((box_w, box_h), Image.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    a = ap.parse_args()
    from PIL import Image, ImageFilter
    src = Path(a.src)
    out = ROOT / "assets" / "scene2"
    kb = {"pc": 0.0, "tel": 0.0}
    n = 0
    for frame, (name, fx) in FRAMES.items():
        p = src / name
        if not p.exists():
            print(f"{frame}: source {name} missing")
            continue
        im = Image.open(p).convert("RGB").filter(ImageFilter.GaussianBlur(SOFTEN))
        for vk, (bw, bh) in (("pc", PC), ("tel", TEL)):
            f = out / f"{frame}_{vk}.webp"
            crop(im, bw, bh, 0.5 if vk == "pc" else fx).save(f, "WEBP", quality=Q[vk], method=6)
            s = round(f.stat().st_size / 1024, 1)
            kb[vk] = max(kb[vk], s)
            n += 1
            print(f"{f.relative_to(ROOT).as_posix()}: {s} KB")
    print(f"SCENE_PHOTOS status={'ok' if n == 2 * len(FRAMES) else 'partial'} files={n} kb_pc_max={kb['pc']} kb_tel_max={kb['tel']}")
    return 0 if n == 2 * len(FRAMES) else 1


if __name__ == "__main__":
    sys.exit(main())
