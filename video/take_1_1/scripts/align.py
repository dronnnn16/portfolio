"""Estimate word onsets: syllable nuclei from the voice envelope, mapped onto the
transcript's syllable counts inside each (accurate) line window."""
import json, re, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, find_peaks

LINES = [
    (2.85, 5.35, "2026 ke 7 mahine kahan chale gaye, tumhe bhi nahi pata."),
    (5.82, 7.98, "5 mahine bache hain tumhare paas khud ko prove karne ke liye."),
    (8.31, 12.36, "Achha, tumhari feed mein reels bhi aati hongi ki ye banda trading se gaadi le raha hai, ye gaddiyan gin raha hai."),
    (12.70, 15.04, "Lekin koi bhi aake nahi bata raha ki kahan se shuru karein."),
    (15.38, 16.99, "Ye shanka tumhari main door kar deta hoon."),
    (17.13, 20.28, "Mera naam hai Abhishek aur main pichhle 8 saalon se professionally trade kar raha hoon."),
    (20.69, 23.13, "Ye mujhe IIT Guwahati ne diya tha jab main wahan par"),
    (23.48, 24.62, "trading sessions karne gaya tha."),
    (24.95, 26.90, "Ab main yahan par kyun aaya hoon? Kyunki mere paas bahut saare"),
    (26.90, 29.00, "comments aate hain ki bhaiya, humein bhi sikhao, humein bhi sikhao."),
]
SPOKEN = {"2026": "twenty twenty six", "7": "saat", "5": "paanch", "8": "aath", "IIT": "ai ai tee"}

def syllables(word):
    w = SPOKEN.get(word, word).lower()
    return max(1, len(re.findall(r"[aeiouy]+", w)))

x, sr = sf.read(sys.argv[1])
band = sosfiltfilt(butter(4, [250, 3500], "bandpass", fs=sr, output="sos"), x)
hop = sr // 200  # 5 ms
env = np.sqrt(np.convolve(band**2, np.ones(hop * 6) / (hop * 6), "same"))[::hop]
env = np.convolve(env, np.hanning(9) / np.hanning(9).sum(), "same")
db = 20 * np.log10(env + 1e-6)
t = np.arange(len(env)) * hop / sr

out = []
for li, (a, b, text) in enumerate(LINES):
    words = [w.strip(",.?") for w in text.split()]
    syl = [syllables(w) for w in words]
    i0, i1 = np.searchsorted(t, a - 0.05), np.searchsorted(t, b + 0.05)
    seg = db[i0:i1]
    floor = np.percentile(seg, 20)
    pk, _ = find_peaks(seg, prominence=3, distance=14, height=floor + 6)
    S, N = sum(syl), len(pk)
    # syllable k -> nucleus index, kept monotonic
    first = np.cumsum([0] + syl[:-1])
    for w, k, n in zip(words, first, syl):
        j = min(N - 1, int(round(k * N / S))) if N else 0
        p = pk[j] if N else 0
        # onset: walk back from the nucleus to where energy is 9 dB below it
        q = p
        while q > 0 and seg[q] > seg[p] - 9 and p - q < 40:
            q -= 1
        on = t[i0 + q]
        out.append({"w": w, "line": li, "start": round(float(max(on, a - 0.03)), 3), "syl": n})
    print(f"{a:5.2f}-{b:5.2f} syl={S:2d} nuclei={N:2d}  {text[:50]}")
# enforce monotonic starts per line and derive ends
for i, w in enumerate(out):
    if i and out[i - 1]["line"] == w["line"] and w["start"] <= out[i - 1]["start"]:
        w["start"] = round(out[i - 1]["start"] + 0.08, 3)
for i, w in enumerate(out):
    nxt = out[i + 1]["start"] if i + 1 < len(out) and out[i + 1]["line"] == w["line"] else LINES[w["line"]][1]
    w["end"] = round(nxt, 3)
json.dump(out, open(sys.argv[2], "w"), indent=1)
