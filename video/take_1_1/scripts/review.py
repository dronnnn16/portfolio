"""Review sheets from the rendered picture:
  review/contact_sheet.jpg - one frame per beat change (the beat's fully built state)
  review/sync_strip_*.jpg  - every on-screen word at frames onset-1 / onset / onset+1,
                             with the voice spectrogram slice under each, for a frame-by-frame check
"""
import json, subprocess, sys
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import spectrogram

FPS, OFFSET = 30, 84
S = json.load(open("data/sync.json"))
F = lambda k: round(S[k] * FPS) - OFFSET
VIDEO = sys.argv[1] if len(sys.argv) > 1 else "out/visual.mp4"
FONT = ImageFont.load_default(size=22)

BEATS = [
    ("B1 hook", 0, "kahan1"), ("B2 KAHAN", "kahan1", "chale"), ("B3 CHALE GAYE", "chale", "tumhe"),
    ("B4 tumhe", "tumhe", "bhi1"), ("B5 NAHI PATA", "bhi1", "paanch"), ("B6 5 mahine", "paanch", "khud"),
    ("B7 prove", "khud", "achha"), ("B8 reels", "achha", "ye1"), ("B9 gaadi", "ye1", "ye2"),
    ("B10 gaddiyan", "ye2", "lekin"), ("B11 koi bhi", "lekin", "aake"), ("B12 NAHI BATA RAHA", "aake", "kahan2"),
    ("B13 shuru", "kahan2", "ye3"), ("B14 door", "ye3", "mera"), ("B15 Abhishek", "mera", "aath"),
    ("B16 8 SAAL", "aath", "professionally"), ("B17 trade", "professionally", "ye4"),
    ("B18 award / IIT Guwahati", "ye4", "jab"), ("B19 award in hand", "jab", "trading2"),
    ("B20 sessions", "trading2", "ab"), ("B21 TURN kyun?", "ab", "kyunki"),
    ("B22a montage", "kyunki", "bhaiya"), ("B22b Sikhao.", "bhaiya", "humein2"),
    ("B23 humein", "humein2", "bhi4"), ("B24 sikhao", "bhi4", "end"), ("END black", "end", None),
]
WORDS = """y2026 ke saat mahine1 kahan1 chale gaye tumhe nahi1 pata paanch mahine2 bache hain1 khud ko prove
tumhari feed mein reels ye1 banda trading1 se1 gaadi ye2 gaddiyan gin raha1 hai koi bhi2 nahi2 bata raha2
kahan2 se2 shuru karein ye3 shanka door mera naam abhishek aath saalon professionally trade iit guwahati
trading2 sessions kyun bahut saare comments aate hain2 bhaiya humein1 bhi3 sikhao1 humein2 bhi4 sikhao2 end""".split()

fr = lambda k: k if isinstance(k, int) else F(k)


def grab(frames, w=480):
    """Exact frames by index (decode once, keep the ones we need)."""
    want = sorted(set(frames))
    sel = "+".join(f"eq(n\\,{n})" for n in want)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", VIDEO, "-vf", f"select='{sel}',scale={w}:-1", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    h = w * 9 // 16
    n = len(raw) // (w * h * 3)
    imgs = [Image.frombytes("RGB", (w, h), raw[i * w * h * 3:(i + 1) * w * h * 3]) for i in range(n)]
    return dict(zip(want, imgs))


def label(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 30], fill=(0, 0, 0))
    d.text((8, 4), text, fill=(255, 230, 0), font=FONT)
    return img


def contact_sheet():
    rows = []
    for name, a, b in BEATS:
        a_, b_ = fr(a), (fr(b) if b else fr(a) + 17)
        rows.append((name, a_, b_ - 1))
    imgs = grab([b for _, _, b in rows])
    cols, w, h = 5, 480, 270
    sheet = Image.new("RGB", (cols * w, ((len(rows) + cols - 1) // cols) * (h + 4)), (30, 30, 30))
    for i, (name, a, b) in enumerate(rows):
        im = label(imgs[b].copy(), f"{name}  {a / FPS:.2f}-{(b + 1) / FPS:.2f}s")
        sheet.paste(im, ((i % cols) * w, (i // cols) * (h + 4)))
    sheet.save("review/contact_sheet.jpg", quality=88)


def sync_strips():
    x, sr = sf.read("data/voice_src.wav")
    frames = []
    for k in WORDS:
        frames += [F(k) - 1, F(k), F(k) + 1]
    imgs = grab([f for f in frames if f >= 0], w=320)
    per = 14
    for p in range(0, len(WORDS), per):
        chunk = WORDS[p:p + per]
        tile_w, tile_h, spec_h = 320, 180, 90
        sheet = Image.new("RGB", (3 * tile_w, len(chunk) * (tile_h + spec_h + 6)), (20, 20, 20))
        for r, k in enumerate(chunk):
            y0 = r * (tile_h + spec_h + 6)
            for c, d in enumerate((-1, 0, 1)):
                f = F(k) + d
                if f in imgs:
                    sheet.paste(label(imgs[f].copy(), f"{k} f{f} ({'onset' if d == 0 else f'{d:+d}'})"), (c * tile_w, y0))
            # spectrogram of the 3 frames (+-1 frame), onset frame boundaries marked
            t0 = (F(k) - 1 + OFFSET) / FPS
            seg = x[int(t0 * sr):int((t0 + 3 / FPS) * sr)]
            _, _, Sx = spectrogram(seg, sr, nperseg=256, noverlap=224)
            Sx = 10 * np.log10(Sx[:120] + 1e-12)
            Sx = np.clip((Sx + 110) / 70, 0, 1)[::-1]
            spec = Image.fromarray((Sx * 255).astype(np.uint8)).resize((3 * tile_w, spec_h)).convert("RGB")
            dd = ImageDraw.Draw(spec)
            for c in (1, 2):
                dd.line([(c * tile_w, 0), (c * tile_w, spec_h)], fill=(0, 255, 255), width=2)
            sheet.paste(spec, (0, y0 + tile_h))
        sheet.save(f"review/sync_strip_{p // per + 1}.jpg", quality=85)


if __name__ == "__main__":
    import os
    os.makedirs("review", exist_ok=True)
    contact_sheet()
    sync_strips()
    print("ok")
