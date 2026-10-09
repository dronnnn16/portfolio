# WhatsApp promo — Remotion

A ~19 s (1140 frames @ 60 fps, 1920×1080) motion-graphics promo built entirely
in code with Remotion (React + TypeScript). Everything is drawn with SVG/CSS — no
footage, no rasters.

## Commands

```console
npm i
npm run dev                      # Remotion Studio
npx remotion still WhatsAppPromo out/f0400.png --frame=400
npx remotion render WhatsAppPromo out/whatsapp-promo.mp4 --codec h264 --crf 16
```

The latest render is committed at `renders/whatsapp-promo.mp4`.

## Structure

| Path | What |
| --- | --- |
| `src/theme.ts` | colors, Inter via `@remotion/google-fonts` (SF Pro Display if installed), shadows |
| `src/lib/motion.ts` | expo easings, spring pop, per-word reveal, drift helpers |
| `src/components/` | `Pill`, `Avatar`, `Cursor` (+ ripple), `Icons` (inline SVG), `MotionBlur` |
| `src/scenes/Scene1…7*.tsx` | one file per storyboard scene |
| `src/WhatsAppPromo.tsx` | the timeline (`<Sequence>` per scene) |
| `src/Sfx.tsx` | optional audio cues |

Timeline (frames): 1 Hook 0–150 · 2 Chat pill 150–330 · 3 Voice note 318–480 ·
4 Notification 468–630 · 5 Statement 630–840 · 6 Logo 840–960 · 7 Outro 960–1140.
Scenes 2→3 and 3→4 overlap by 12 frames and hand the pill over mid-morph;
4→5 and 5→6 are hard cuts.

## Optional assets

- `public/whatsapp-logo.svg` — used for the app icon if present; otherwise a
  drawn placeholder (green rounded square + white chat-bubble glyph).
- `public/sfx/{whoosh,click,pop,music}.mp3` — each file is used if present and
  silently skipped if missing (cue frames live in `src/Sfx.tsx`).

## Notes

- Motion blur (`@remotion/motion-blur`'s `CameraMotionBlur`, 8 samples) is only
  applied to the moving foreground layer during fast moves: hook exit, the
  card flip, the scene-5 streak and the logo zoom. Each blurred layer is its
  own component, so `useCurrentFrame()` sees the sample frames. Backgrounds
  stay outside the blur, which avoids additive-blend tinting on light colors.
- If Chrome can't be downloaded in your environment, pass an existing one with
  `--browser-executable=/path/to/chrome-headless-shell`.
