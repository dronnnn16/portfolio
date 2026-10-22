# EDIT_PLAN — take_1_1 → final_take_1_1.mp4

Status: **draft, waiting for approval.** Nothing is rendered yet.

- Output: 1920×1080, 30 fps, H.264 + AAC, normalised to −14 LUFS
- Length: **24.33 s of edited speech + 0.60 s hard black = 24.93 s** (source 29.07 s)
- Structure (from the reference): HOOK → WORD CARDS → PATTERN → CREDENTIALS → AWARD (premium) → TURN (second setup) → MONTAGE that builds the sentence → PAYOFF on A-roll → CUT TO BLACK
- Every word on screen is a word you said. Nothing is added. Words are only dropped to shorten lines.

---

## 1. Tightened A-roll (dead air removed)

The lead-in silence (0–2.73 s) and every pause are cut. Each cut keeps one frame of handle so no syllable is clipped. Source in/out points are on frame boundaries.

| Seg | Source in → out | Output start | Line(s) |
|---|---|---|---|
| S1 | 2.733 → 5.400 | 0.000 | 2026 ke 7 mahine kahan chale gaye, tumhe bhi nahi pata. |
| S2 | 5.767 → 8.033 | 2.667 | 5 mahine bache hain tumhare paas khud ko prove karne ke liye. |
| S3 | 8.267 → 12.400 | 4.933 | Achha, tumhari feed mein reels bhi aati hongi … gaddiyan gin raha hai. |
| S4 | 12.667 → 15.067 | 9.067 | Lekin koi bhi aake nahi bata raha ki kahan se shuru karein. |
| S5 | 15.333 → 20.333 | 11.467 | Ye shanka … door kar deta hoon. / Mera naam hai Abhishek … trade kar raha hoon. |
| S6 | 20.667 → 23.167 | 16.467 | Ye mujhe IIT Guwahati ne diya tha jab main wahan par |
| S7 | 23.433 → 24.667 | 18.967 | trading sessions karne gaya tha. |
| S8 | 24.900 → 29.033 | 20.200 | Ab main yahan par kyun aaya hoon? Kyunki … humein bhi sikhao. |
| — | black | 24.333 → 24.933 | (no sound) |

The voice track is continuous across these joins. The visual cuts below are placed *on* words and don't have to line up with the joins. Each join gets a 2 ms audio crossfade so it doesn't click.

Two optional trims, **off by default** (tell me if you want them):
- (a) Drop the filler "Achha," at the start of S3 (≈0.35 s).
- (b) Close the 0.14 s gap between "deta hoon." and "Mera naam" inside S5.

---

## 2. Design system (exactly 3 voices)

| Voice | Font (OFL, bundled via @fontsource) | Use | Colour |
|---|---|---|---|
| **Logic** | Inter 700 (small build-ups) / Inter 900 (image-filled word cards, "8 SAAL") | connector words: *ke, bache hain, ye banda, kahan se, mera naam* | `#5B8BD9` on white · white on blue/footage |
| **Emotion** | Pinyon Script | value / feeling words: *7 mahine, prove, gaadi, gaddiyan, Abhishek, IIT Guwahati, Sikhao* | white on footage/black · `#5B8BD9` on white |
| **Contrast** | Anton (condensed caps), full width | only the negations: **NAHI PATA**, **NAHI BATA RAHA** | white on `#0A4FC0 → #2F6FE0` gradient |

- Sizes: small build-up words ≈ 3% of frame height (≈32 px); hero words 25–45% (270–480 px).
- Surfaces:
  - white `#FFFFFF` cards with a soft grey edge vignette
  - white cards with soft blue corner light-leaks
  - royal-blue gradient cards
  - pure black for the award
  - B&W with crushed blacks for the montage
  - A-roll: neutral, slightly cool grade
- Letterbox: black bars, 12% top and bottom, on the hook (B1) and the final payoff (B21) only. They bookend the video.

### Motion rules (baked into one shared component)

- Small words: opacity 0→1 + scale 0.92→1.0 over 5 frames, starting on the syllable onset.
- Hero words: scale 1.15→1.0 + blur 8→0 px over 6 frames, then a drift of 1.0→0.94 over the hold.
- Logos/objects: scale 1.08→1.0 over the hold, or a 10-frame slide.
- A-roll jump cuts alternate between punch-ins of 1.00 and 1.15, so a cut never lands on the same framing twice.
- Transitions: hard cuts only. No dissolves and no zoom-blur.
- No frame sits unchanged for more than 1.2 s, except the one deliberate breath at the TURN (B18).

---

## 3. Beat map (output timeline)

Times are output seconds and are approximate until the word-alignment pass (§5). The line-level times are accurate to ±0.1 s. Word onsets inside a line are estimates for now.
Voice: **L** = Logic, **E** = Emotion, **C** = Contrast.
SFX: `tick` = small pop, `whoosh` = section swap, `hit` = impact, `riser` = into montage.

### A · HOOK — "2026 ke 7 mahine kahan chale gaye, tumhe bhi nahi pata."

| # | Out time | Visual | On-screen text (synced) | SFX |
|---|---|---|---|---|
| B1 | 0.00–1.05 | A-roll, letterboxed, wide (1.00) | small white **L** beside your face: `2026` → `ke` (tick each), then giant white **E** **7 mahine** slams over them | tick, tick, hit (light) |
| B2 | 1.05–1.40 | White card, grey vignette | one word per card, **L 900** filled with a candlestick-chart texture: **KAHAN** | whoosh |
| B3 | 1.40–1.80 | White card (cut on the word) | **CHALE GAYE** (same treatment) | — |
| B4 | 1.80–2.15 | A-roll punch-in 1.15 | small white **L**: `tumhe bhi` | tick |
| B5 | 2.15–2.67 | Blue gradient card, empty for 3 frames, then slam | **C** **NAHI PATA.** full width | hit |

### B · WORD CARDS — "5 mahine bache hain tumhare paas khud ko prove karne ke liye."

| # | Out time | Visual | On-screen text | SFX |
|---|---|---|---|---|
| B6 | 2.67–3.75 | White card with blue corner light-leak | blue **E** **5 mahine** lands huge, echoing "7 mahine" from the hook; small blue **L** `bache hain` builds under it | whoosh, tick |
| B7 | 3.75–4.93 | A-roll 1.00 | small white **L** `khud ko` → giant white **E** **prove** on the syllable, drifting | tick, hit (light) |

("tumhare paas" and "karne ke liye" are spoken but not shown, to shorten the line.)

### C · PATTERN — reels → gaadi → gaddiyan → NAHI BATA RAHA → shuru

Your script has a natural two-item list plus a negation, so this keeps the reference's "same shape, new subject, then contrast" rhythm. I'm not padding it to four repetitions with claims you didn't make.

| # | Out time | Visual | On-screen text | SFX |
|---|---|---|---|---|
| B8 | 4.93–6.20 | A-roll punch-in 1.15 | small white **L** `tumhari feed mein` builds → white **E** **reels** | tick ×3, light hit |
| B9 | 6.20–7.60 | **Rep 1:** white card, 9:16 rounded "reel" inset with drop shadow slides up (10 f); inside is a blue gradient | blue **L** `ye banda` (outside the inset) → `trading se` → white **E** **gaadi** inside the inset | whoosh, tick, tick |
| B10 | 7.60–9.07 | **Rep 2:** the same inset shape cuts to a new one (faster, no slide) | **L** `ye` → **E** **gaddiyan**, letters filled with the candlestick texture → small `gin raha hai` | tick, tick |
| B11 | 9.07–10.30 | A-roll 1.00, cut on "Lekin" | small white **L** `koi bhi` builds | tick |
| B12 | 10.30–10.80 | Blue gradient card, empty 0.2 s, then slam | **C** **NAHI BATA RAHA** full width | **hit** |
| B13 | 10.80–11.47 | White card with blue light-leak, fastest beat | blue **L** `kahan se` → blue **E** **shuru karein?** | tick |

### D · CREDENTIALS — "Ye shanka tumhari main door kar deta hoon. Mera naam hai Abhishek … 8 saalon se professionally trade kar raha hoon."

| # | Out time | Visual | On-screen text | SFX |
|---|---|---|---|---|
| B14 | 11.47–13.20 | A-roll punch-in 1.15, then a cut to 1.00 at "main" | small white **L** `ye shanka` → white **E** **door** | tick, tick |
| B15 | 13.20–14.25 | White card, grey vignette | small blue **L** `mera naam` → huge blue **E** **Abhishek** | whoosh, light hit |
| B16 | 14.25–15.30 | Blue gradient card | white **L 900** **8 SAAL** fills about 40% of the height (this is the logic voice at its heaviest weight, not the negation font) | tick |
| B17 | 15.30–16.47 | A-roll 1.00 | small white **L** `professionally` → white **E** **trade** | tick |

### E · AWARD (premium beat) — "Ye mujhe IIT Guwahati ne diya tha jab main wahan par trading sessions karne gaya tha."

| # | Out time | Visual | On-screen text | SFX |
|---|---|---|---|---|
| B18a | 16.47–17.10 | A-roll punch-in 1.15 toward the award; this is the real footage of you lifting it | none | — |
| B18b | 17.10–18.97 | **Pure black.** A clean cutout of the award (rembg from source frame ≈21.5 s, where it is frontal and sharp) scales 1.08→1.0 over the hold, with a faint warm rim glow | on "IIT": big white **E** **IIT Guwahati** lands under the award | **hit** (bass) on the cut to black |
| B19 | 18.97–20.20 | Black stays; the award shrinks to the left third | small white **L** `trading` → white **E** **sessions** | tick |

### F · TURN (second "setup", calm) — "Ab main yahan par kyun aaya hoon?"

| # | Out time | Visual | On-screen text | SFX |
|---|---|---|---|---|
| B20 | 20.20–21.25 | **Fake second camera:** punch-in 1.35, reframed so you sit on the right third. Moody grade: −35% saturation, crushed blacks, cooler tone, vignette. Slight 1.0→1.02 push | **Text behind the subject:** large grey (`#8E949C`) **L** **kyun?** sits behind you, cut out with a person mask (rembg `u2net_human_seg`, per frame). This is the one deliberate breath (≈1.05 s with no new element) | riser starts at the end |

### G · MONTAGE → PAYOFF — "Kyunki mere paas bahut saare comments aate hain ki bhaiya, humein bhi sikhao, humein bhi sikhao."

There is no external B-roll, so the montage uses **B&W cinematic crops of your own take**: eyes and glasses, hands mid-gesture, the mic, the monitor glow, the door panel. All are taken from moments where your mouth is out of frame, so mismatched lip-sync can't show. A new crop comes every ≈0.4–0.5 s.

| # | Out time | Visual | On-screen text (one small centred caption that grows across cuts) | SFX |
|---|---|---|---|---|
| B21a | 21.25–22.25 | B&W crops ×2 | `comments` → `comments aate hain` | riser continues |
| B21b | 22.25–23.20 | B&W crops ×2–3 | `bhaiya,` → `bhaiya, humein` → `bhaiya, humein bhi` → **Sikhao.** lands as big white **E** on the first "sikhao" | hit (light) on Sikhao |
| B22 | 23.20–23.70 | White card with blue light-leak | **E** two-word line **humein bhi**, filled with the candlestick texture | whoosh |
| B23 | 23.70–24.33 | **A-roll #1 again**, letterboxed like the hook | small white **L** `humein bhi` → big bold white **L 900** **sikhao** on the final syllable | — |
| END | 24.33–24.93 | **Hard cut to black**, on the last syllable | none | **nothing** |

---

## 4. Sound (HyperFrames mix over the Remotion render)

- **Voice:** source take with a light high-pass at 80 Hz, de-click on the joins and gentle compression, then gain to sit at about −14 LUFS short-term.
- **Music bed:**
  - Minimal, modern, slightly emotional piano/pluck (≈90 BPM), running from frame 0 with no silent gaps.
  - Ducked to about −20 LUFS under the voice using sidechain ducking from the voice track.
  - Low-pass filtered for the ≈0.5 s before the final "sikhao" (23.70–24.20).
  - Everything stops on the cut to black.
- **SFX** at 0.3 volume, placed as in the beat map: tick on small pops, whoosh on new-section card swaps, impact/bass hit on both "NAHI …" slams and the award reveal, riser into the montage, silence on black.
- **Master:** loudness-normalise the whole mix to −14 LUFS integrated, with a −1 dBTP limit.

---

## 5. Sync method (≤1 frame)

Your `words.json` wasn't attached, so I'll do the word alignment here:

1. Detect syllable onsets from the voice's energy and spectral flux, at 10 ms resolution.
2. Snap each on-screen word to the onset of its first syllable, inside the line windows above.
3. Check by rendering a 3-frame-per-word strip (frames −1, 0, +1) with the waveform burned in, so we can both review it frame by frame.

If you have `words.json`, send it and I'll use it as the starting point.

---

## 6. Asset list

| Asset | Source | Status |
|---|---|---|
| A-roll | `take_1_1_compressed.mp4` (10 MB, compressed) | ✅ have it. **Send the uncompressed take if you can**: the 1.35 punch-in and the montage crops will be visibly soft from the compressed file |
| Award cutout | rembg on source frame ≈21.5 s | ✅ can make. A clean photo of the award would look better |
| Person mask (TURN, B20) | rembg `u2net_human_seg`, per frame, ≈32 frames | ✅ can make |
| Candlestick-chart texture (image-filled letters) | generated in code: a stylised blue chart, no real data or numbers shown | ✅ can make |
| Fonts | Inter, Pinyon Script, Anton (all OFL, from npm @fontsource) | ✅ |
| Music bed | **no track supplied**, and stock-music sites are probably blocked from this environment | ⚠️ see decision 1 |
| SFX (tick, whoosh, hit, riser) | synthesised in code (filtered noise, sub drop) | ✅ can make |
| Tooling | Remotion 4.0.537 (visuals), HyperFrames 0.8.185 (mix), ffmpeg | ✅ installable |

The finished project goes in `video/take_1_1/` in this repo: Remotion source, mix config, asset scripts and the render. Large media (the source take and the final mp4) will be git-ignored and delivered as files unless you want them committed.

---

## 7. Decisions I need from you

1. **Music:** do you have a licensed track to send? If not, I'll compose a simple piano/pluck bed in code. It will be clean and royalty-free, but plainer than a library track.
2. **Optional trims** (a) "Achha," and (b) the S5 gap: keep them, or cut them?
3. **Uncompressed take:** do you have it, for sharper punch-ins?
4. **Script font:** Pinyon Script, which is closest to the reference, or Playfair Display Italic, which reads more easily on a phone?

After you approve: §5 alignment → contact sheet (one frame per beat change, B1–END) for review → full render.
