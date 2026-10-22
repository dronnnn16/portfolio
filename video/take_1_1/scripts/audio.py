"""Builds the three audio stems for the HyperFrames mix:
  audio/voice.wav  - the take from the first word to the end, cleaned and levelled
  audio/music.wav  - minimal piano/pluck bed composed here, ducked under the voice,
                     filtered out before the payoff word, cut on the black
  audio/sfx.wav    - ticks / whooshes / hits / riser on the cue frames (mixed at 0.3)
"""
import json
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve

SR = 48000
FPS = 30
OFFSET = 84
S = json.load(open("data/sync.json"))
F = lambda k: round(S[k] * FPS) - OFFSET  # output frame of a cue
T = lambda k: F(k) / FPS  # output seconds of a cue
END = F("end") / FPS
TOTAL = END + 18 / FPS
N = int(round(TOTAL * SR))
rng = np.random.default_rng(3)
meter = pyln.Meter(SR)


def lufs(x):
    return meter.integrated_loudness(x if x.ndim == 1 else x)


def gain_to(x, target):
    return x * 10 ** ((target - lufs(x)) / 20)


# ---------------------------------------------------------------- voice
def voice():
    x, sr = sf.read("data/voice_src.wav")
    assert sr == SR
    x = x[int(OFFSET / FPS * SR):int(S["end"] * SR)]
    x = sosfiltfilt(butter(2, 80, "highpass", fs=SR, output="sos"), x)
    # gentle RMS compressor, 3:1 above -24 dBFS
    env = np.sqrt(np.convolve(x**2, np.ones(240) / 240, "same")) + 1e-9
    db = 20 * np.log10(env)
    gr = np.minimum(0, (-24 - db) * (1 - 1 / 3))
    a, r = np.exp(-1 / (0.005 * SR)), np.exp(-1 / (0.12 * SR))
    sm = np.empty_like(gr)
    g = 0.0
    for i, v in enumerate(gr):
        g = a * g + (1 - a) * v if v < g else r * g + (1 - r) * v
        sm[i] = g
    x = x * 10 ** (sm / 20)
    x[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))  # no click on the black
    x = gain_to(x, -14.0)
    out = np.zeros(N)
    out[: len(x)] = x
    return out


# ---------------------------------------------------------------- music
def note_hz(n):
    return 440 * 2 ** ((n - 69) / 12)


def piano(hz, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    y = np.zeros_like(t)
    for k in range(1, 9):
        f = hz * k * (1 + 0.0004 * k * k)
        if f > 16000:
            break
        y += (1 / k**1.4) * np.exp(-t * (1.1 + 0.9 * k)) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    att = np.minimum(1, t / 0.004)
    return vel * y * att


def pluck(hz, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    y = sum((0.6**k) * np.sin(2 * np.pi * hz * (k + 1) * t) for k in range(5))
    return vel * y * np.exp(-t * 7.5) * np.minimum(1, t / 0.002)


def pad(hz, dur):
    t = np.arange(int(dur * SR)) / SR
    y = sum(np.sin(2 * np.pi * hz * d * t) for d in (0.997, 1.0, 1.003)) / 3
    return y * np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.6)


def music():
    bpm = 90
    beat = 60 / bpm
    bar = 4 * beat
    # A minor, slightly emotional: Am  F  C  G | Am  F  C  Em | F  G
    prog = [
        (57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62]),
        (57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (52, [55, 59, 64]),
        (53, [53, 57, 60]), (55, [55, 59, 62]),
    ]
    L = N + SR
    y = np.zeros(L)
    for i, (root, ch) in enumerate(prog):
        t0 = i * bar
        if t0 > TOTAL:
            break

        def put(sig, at):
            s = int(at * SR)
            if s < L:
                y[s:s + len(sig)] += sig[: L - s]

        put(0.55 * piano(note_hz(root - 12), 3.2), t0)
        for n in ch:
            put(0.32 * piano(note_hz(n), 3.0), t0 + 0.012 * (n % 3))
        put(0.18 * pad(note_hz(root - 12), bar), t0)
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]
        for j in range(8):  # eighth-note pluck arpeggio
            put(0.13 * pluck(note_hz(arp[j % 4]), 0.6, 0.8 if j % 2 else 1.0), t0 + j * beat / 2)
    # small room: exponentially decaying noise IR
    ir_t = np.arange(int(1.8 * SR)) / SR
    ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t * 3.2)
    ir = sosfilt(butter(1, 5000, "lowpass", fs=SR, output="sos"), ir)
    wet = fftconvolve(y, ir)[:L]
    y = y + 0.22 * wet / np.max(np.abs(wet)) * np.max(np.abs(y))
    y = y[:N]
    y = sosfiltfilt(butter(2, 60, "highpass", fs=SR, output="sos"), y)
    return y


def duck(m, v):
    """Bed at ~-20 LUFS under the voice, lifting ~4 dB in the gaps."""
    m = gain_to(m, -20.0)
    env = np.sqrt(np.convolve(v**2, np.ones(2400) / 2400, "same"))
    active = (20 * np.log10(env + 1e-9) > -38).astype(float)
    a, r = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.35 * SR))
    g = np.empty_like(active)
    s = 0.0
    for i, v_ in enumerate(active):
        s = a * s + (1 - a) * v_ if v_ > s else r * s + (1 - r) * v_
        g[i] = s
    gain_db = 4.0 * (1 - g)  # +4 dB when the voice rests
    m = m * 10 ** (gain_db / 20)
    # drop out before the payoff word: low-pass + dip over the last 0.5 s before "sikhao"
    p = T("sikhao2")
    i0, i1 = int((p - 0.5) * SR), int(p * SR)
    lp = sosfilt(butter(2, 350, "lowpass", fs=SR, output="sos"), m)
    w = np.zeros(N)
    w[i0:i1] = 1
    w = np.convolve(w, np.hanning(960) / np.hanning(960).sum(), "same")
    m = m * (1 - w) + 0.35 * lp * w
    # everything stops on the black
    e = int(END * SR)
    m[e - 96:e] *= np.linspace(1, 0, 96)
    m[e:] = 0
    return m


# ---------------------------------------------------------------- sfx
def tick():
    t = np.arange(int(0.03 * SR)) / SR
    return 0.35 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260) + 0.15 * rng.normal(0, 1, len(t)) * np.exp(-t * 500)


def whoosh(pre=0.28, post=0.18):
    n = int((pre + post) * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    # sweep a band-pass upward into the cut, then let it fall
    for k in range(0, n, 480):
        c = 400 + 4200 * (min(t[k], pre) / pre) ** 2
        seg = noise[k:k + 480]
        out[k:k + 480] = sosfilt(butter(2, [c * 0.7, c * 1.3], "bandpass", fs=SR, output="sos"), seg)
    env = np.where(t < pre, (t / pre) ** 2, np.exp(-(t - pre) * 18))
    return 0.9 * out * env / (np.max(np.abs(out * env)) + 1e-9), pre


def hit(big=True):
    t = np.arange(int(1.2 * SR)) / SR
    f = 52 + 70 * np.exp(-t * 28)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (3.2 if big else 6))
    click = sosfilt(butter(2, 3000, "lowpass", fs=SR, output="sos"), rng.normal(0, 1, len(t))) * np.exp(-t * 60)
    return (1.0 if big else 0.55) * (0.9 * sub + 0.35 * click)


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    for k in range(0, n, 480):
        c = 300 + 5000 * (t[k] / dur) ** 2
        out[k:k + 480] = sosfilt(butter(2, [c * 0.8, c * 1.25], "bandpass", fs=SR, output="sos"), noise[k:k + 480])
    tone = np.sin(2 * np.pi * np.cumsum(220 + 440 * (t / dur) ** 2) / SR)
    env = (t / dur) ** 2.2
    y = (out / (np.max(np.abs(out)) + 1e-9) + 0.25 * tone) * env
    y[-240:] *= np.linspace(1, 0, 240)
    return 0.8 * y


TICKS = """y2026 ke tumhe bache hain1 khud ko tumhari feed mein ye1 banda trading1 se1 ye2 gin raha1 hai
koi bhi2 kahan2 se2 ye3 shanka mera naam professionally trading2 bahut saare comments aate hain2
bhaiya humein1 bhi3 bhi4""".split()
WHOOSH = ["kahan1", "paanch", "ye1", "kahan2", "mera", "trading2", "humein2"]
HITS_BIG = ["nahi1", "nahi2", "ye4"]
HITS_LIGHT = ["saat", "prove", "aath", "sikhao1"]


def sfx():
    y = np.zeros(N + SR)

    def put(sig, at):
        s = max(0, int(at * SR))
        y[s:s + len(sig)] += sig[: len(y) - s]

    for k in TICKS:
        put(0.5 * tick(), T(k))
    for k in WHOOSH:
        w, pre = whoosh()
        put(w, T(k) - pre)
    for k in HITS_BIG:
        put(hit(True), T(k))
    for k in HITS_LIGHT:
        put(hit(False), T(k))
    r0, r1 = T("kyun"), T("kyunki")
    put(riser(r1 - r0), r0)
    y = y[:N]
    e = int(END * SR)
    y[e:] = 0  # nothing on the black
    return y


def stereo(x):
    return np.stack([x, x], axis=1).astype(np.float32)


if __name__ == "__main__":
    import os

    os.makedirs("audio", exist_ok=True)
    v = voice()
    m = duck(music(), v)
    s = sfx()
    sf.write("audio/voice.wav", stereo(v), SR, subtype="PCM_24")
    sf.write("audio/music.wav", stereo(m), SR, subtype="PCM_24")
    sf.write("audio/sfx.wav", stereo(s), SR, subtype="PCM_24")
    print(f"voice {lufs(v):.1f} LUFS | music {lufs(m):.1f} LUFS | sfx@0.3 {lufs(0.3 * s):.1f} LUFS | {N / SR:.3f}s")
