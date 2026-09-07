"""Gera variantes do logo PIENG para o Pepilene."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "img" / "LOGO_PIENG.png"
out_dir = ROOT / "public" / "brand"
img_brand = ROOT / "img" / "brand"
out_dir.mkdir(parents=True, exist_ok=True)
img_brand.mkdir(parents=True, exist_ok=True)

im = Image.open(src).convert("RGBA")
arr = np.array(im)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
white = (r > 245) & (g > 245) & (b > 245)
arr[white, 3] = 0
soft = (r > 235) & (g > 235) & (b > 235) & ~white
factor = ((255 - np.maximum(np.maximum(r[soft], g[soft]), b[soft])) / 20.0).clip(0, 1)
arr[soft, 3] = (arr[soft, 3].astype(np.float32) * factor).astype(np.uint8)
clean = Image.fromarray(arr)

bbox = clean.getbbox()
if not bbox:
    raise SystemExit("Logo sem conteúdo após remover fundo.")
trim = clean.crop(bbox)
tarr = np.array(trim)
alpha = tarr[:, :, 3]
# Colunas com conteúdo significativo
col_fill = (alpha > 20).sum(axis=0)
# Acha o primeiro vão largo (espaço entre emblema e texto)
gap_start = None
gap_run = 0
icon_end = trim.width // 3
for x, fill in enumerate(col_fill):
    if x < int(trim.height * 0.55):
        continue
    if fill < trim.height * 0.04:
        gap_run += 1
        if gap_run >= 8 and gap_start is None:
            gap_start = x - gap_run + 1
            break
    else:
        gap_run = 0
if gap_start is None:
    gap_start = int(trim.height * 0.95)
icon_end = gap_start
print("icon_end", icon_end, "trim", trim.size)

pad = 8
full = Image.new("RGBA", (trim.width + pad * 2, trim.height + pad * 2), (0, 0, 0, 0))
full.paste(trim, (pad, pad), trim)

icon = trim.crop((0, 0, icon_end, trim.height))
ib = icon.getbbox()
if ib:
    icon = icon.crop(ib)
side = max(icon.width, icon.height)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)

targets = {
    "logo-full.png": full,
    "logo-stamp.png": full,
    "logo-mark.png": sq.resize((256, 256), Image.Resampling.LANCZOS),
    "logo-mark-64.png": sq.resize((64, 64), Image.Resampling.LANCZOS),
    "favicon-192.png": sq.resize((192, 192), Image.Resampling.LANCZOS),
    "favicon-32.png": sq.resize((32, 32), Image.Resampling.LANCZOS),
}

wm = full.copy()
wm_arr = np.array(wm)
wm_arr[:, :, 3] = (wm_arr[:, :, 3].astype(np.float32) * 0.16).astype(np.uint8)
targets["logo-watermark.png"] = Image.fromarray(wm_arr)

for name, image in targets.items():
    image.save(out_dir / name, optimize=True)
    image.save(img_brand / name, optimize=True)

favicon32 = targets["favicon-32.png"]
favicon32.save(ROOT / "public" / "favicon.png", optimize=True)
favicon32.save(ROOT / "public" / "favicon.ico")

# SVG favicon referencing PNG isn't ideal; keep PNG links in HTML.
Image.open(src).save(img_brand / "LOGO_PIENG-source.png")
print("ok", sorted(p.name for p in out_dir.iterdir()))
print("icon", sq.size, "full", full.size)
