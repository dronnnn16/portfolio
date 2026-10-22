"""Builds still assets: award cutout (from the take) and the candlestick fill texture."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "public/assets"

def award():
    src = Image.open("data/award_frame.png").convert("RGB")
    # plaque corners in the 1920x1080 frame at 21.5 s (mic arm covers the lower part)
    poly = [(421, 451), (695, 491), (699, 905), (424, 905)]
    x0, y0, x1, y1 = 410, 440, 710, 905
    crop = src.crop((x0, y0, x1, y1))
    mask = Image.new("L", src.size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    mask = mask.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(1.2))
    # fade the bottom so the cut above the mic arm reads as light falling off
    m = np.asarray(mask, dtype=np.float32) / 255
    h = m.shape[0]
    fade = np.clip((h - 25 - np.arange(h)) / 150, 0, 1) ** 1.6
    m *= fade[:, None]
    scale = 3
    crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    alpha = Image.fromarray((m * 255).astype(np.uint8)).resize(crop.size, Image.LANCZOS)
    crop.putalpha(alpha)
    crop.save(f"{OUT}/award.png")

def candles(w=1920, h=1080, seed=7):
    rng = np.random.default_rng(seed)
    y = np.linspace(0, 1, h)[:, None, None]
    bg = (1 - y) * np.array([0.36, 0.55, 0.85]) + y * np.array([0.04, 0.31, 0.75])
    img = Image.fromarray((np.broadcast_to(bg, (h, w, 3)) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for gy in range(0, h, 54):
        d.line([(0, gy), (w, gy)], fill=(120, 160, 230), width=2)
    # dense, rising chart so the texture reads inside heavy letters
    n = 26
    cw = w / n
    prev = 0.12
    for i in range(n):
        trend = 0.12 + 0.74 * i / (n - 1)
        o = prev
        c = trend + rng.normal(0, 0.07) + (0.1 if i % 4 != 3 else -0.08)
        hi, lo = max(o, c) + rng.uniform(0.03, 0.09), min(o, c) - rng.uniform(0.03, 0.09)
        up = c >= o
        col = (255, 255, 255) if up else (8, 32, 92)
        x = i * cw + cw / 2
        d.line([(x, (1 - hi) * h), (x, (1 - lo) * h)], fill=col, width=8)
        d.rectangle([x - cw * 0.38, (1 - max(o, c)) * h, x + cw * 0.38, (1 - min(o, c)) * h + 6], fill=col)
        prev = c
    img.save(f"{OUT}/candles.jpg", quality=92)

if __name__ == "__main__":
    import os; os.makedirs(OUT, exist_ok=True)
    award(); candles()
