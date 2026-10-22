"""Spectrogram + envelope per line with estimated word onsets, for manual sync checks."""
import json, sys
import numpy as np, soundfile as sf
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.signal import spectrogram

x, sr = sf.read(sys.argv[1]); W = json.load(open(sys.argv[2])); outdir = sys.argv[3]
lines = sorted({w["line"] for w in W})
for l in lines:
    ws = [w for w in W if w["line"] == l]
    a, b = ws[0]["start"] - 0.15, ws[-1]["end"] + 0.1
    seg = x[int(a * sr):int(b * sr)]
    f, t, S = spectrogram(seg, sr, nperseg=1024, noverlap=1024 - 240)
    fig, ax = plt.subplots(figsize=(22, 4.5), dpi=80)
    ax.pcolormesh(t + a, f, 10 * np.log10(S + 1e-12), shading="auto", cmap="magma", vmin=-110, vmax=-40)
    ax.set_ylim(0, 9000)
    for k in np.arange(np.ceil(a * 10) / 10, b, 0.1):
        ax.axvline(k, color="w", lw=0.3, alpha=0.4)
    for w in ws:
        ax.axvline(w["start"], color="cyan", lw=1)
        ax.text(w["start"], 8300, w["w"], color="cyan", fontsize=11, rotation=0)
    ax.set_xticks(np.arange(np.ceil(a * 10) / 10, b, 0.1)); ax.tick_params(axis="x", labelsize=7, rotation=90)
    fig.tight_layout(); fig.savefig(f"{outdir}/line{l}.png"); plt.close(fig)
