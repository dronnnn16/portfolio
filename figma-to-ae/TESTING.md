# Testing

There are two layers of testing:

1. **Automated tests** (`npm test`). They run the real plugin serializer and the real `.jsx` against mocks of the Figma and After Effects APIs. They pass in this repository.
2. **Manual checklist.** Build the test frame below in the real Figma desktop app, export it and import it into real After Effects 2025, then tick each item off. This has **not** been done here, because neither app was available in the build environment.

## Automated tests

```bash
cd figma-to-ae/figma-plugin
npm install
npm test          # typecheck + build + node ../tests/run-all.mjs
```

| ID | What is checked |
|---|---|
| P1–P12 | Plugin: scene header, required fields on every node, parent ids and child order, 3-level nesting with correct `absoluteTransform`, type mapping, vector/boolean path data, paints, radii, rotation/opacity/blend, gradient handles, effects, single and mixed text segments, clean @2x image export (temporary clone removed), ZIP validity (`unzip -t`), committed `sample/` matches a fresh export |
| S1–S5 | AE script: ASCII-only, parses as ECMAScript 3, runs without ES5+ built-ins; JSON parser, SVG path parser (M L H V C S Q T Z, relative, implicit commands, compact numbers), rounded-rect path, polystar bounds, matrix decomposition |
| A1–A19 | Import of `sample/` in **null mode**: undo group, comp settings, exact layer order and names, parenting, 5 circles → 5 shape layers, world placement of every shape/null/image layer vs Figma, rotation = −Figma rotation, opacity, blend mode, inside/outside/centre strokes, roundness and per-corner paths, polystars, bezier paths and fill rule, gradient fallback + log, drop shadow/blur values, point text and box text with mixed styles, font fallback, image scale/rotation/shadow, track mattes, hidden layers, summary counts |
| B1–B3 | Import in **precomp mode**: one precomp per group/frame with the right size and contents, world placement through nested precomps, clipping (`collapseTransformation`) and effects on precomp layers |
| C1–C3 | Errors: folder without `scene.json`, log file only written when the preference allows it, missing PNG falls back to a shape layer |

`tests/lib/figma-mock.mjs` builds the frame described below. `node tests/generate-sample.mjs` regenerates `sample/` from it.

## Test Figma setup

Create a frame named **Hero**, 800 × 600, white fill, *Clip content* on. Add the layers below **in this order, from bottom to top** of the layers panel. X/Y are relative to the frame that contains the layer, which is what Figma's design panel shows. Colours are hex.

| # | Layer (name) | Type | Settings |
|---|---|---|---|
| 1 | Background Card | Rectangle | X 40, Y 40, 720 × 520, radius 24, fill `#F4F6FB`, drop shadow X 0 Y 8 blur 24, black 15% |
| 2 | Level 1 | Group | contains #3 |
| 3 | ↳ Level 2 | Frame | X 80, Y 80, 220 × 160, **rotation 15°**, fill `#DCE8FF`, *Clip content* **off**; contains #4 |
| 4 | ↳↳ Level 3 | Group | contains Deep Rect and Deep Ellipse |
| 4a | ↳↳↳ Deep Rect | Rectangle | X 20, Y 30 (inside Level 2), 80 × 50, fill `#E5484D` |
| 4b | ↳↳↳ Deep Ellipse | Ellipse | X 120, Y 40, 60 × 60, fill `#30A46C` |
| 5 | Circles | Group | 5 ellipses **Circle 1 … Circle 5**, each 40 × 40, Y 70, X = 360, 408, 456, 504, 552; fills `#E5484D`, `#F76B15`, `#FFC53D`, `#30A46C`, `#0090FF` |
| 6 | Rotated Rect | Rectangle | X 420, Y 160, 120 × 80, **rotation 30°**, **layer opacity 50%**, blend **Multiply**, fill `#F76B15` |
| 7 | Stroke Inside | Rectangle | X 80, Y 320, 100 × 70, fill `#FFFFFF`, stroke `#0090FF` 4 px **Inside** |
| 8 | Stroke Outside | Ellipse | X 200, Y 320, 80 × 80, fill `#FFC53D`, stroke `#111111` 6 px **Outside** |
| 9 | Center Line | Line | X 300, Y 380, length 120, rotation 20°, stroke `#8E4EC6` 3 px, round cap |
| 10 | Rounded Rect | Rectangle | X 440, Y 320, 120 × 70, radius **16**, fill `#8E4EC6` |
| 11 | Mixed Corners | Rectangle | X 580, Y 320, 120 × 70, radii **TL 24, TR 0, BR 24, BL 0**, fill `#12A594`, stroke `#0B5D54` 2 px Inside |
| 12 | Star | Star | X 600, Y 60, 80 × 80, 5 points, ratio 40%, fill `#FFC53D` |
| 13 | Triangle | Polygon | X 690, Y 70, 60 × 60, 3 points, fill `#0090FF` |
| 14 | Wave | Vector | X 80, Y 420, 200 × 60: a closed path with a curve on top (pen tool: bottom-left → top-left, curve up and over to the middle, curve down to the right edge, bottom-right). Fill `#0090FF` 80%, stroke `#003D7A` 2 px Center |
| 15 | Ring | Boolean (Exclude) | Ellipse 80 × 80 at X 300, Y 420 and ellipse 40 × 40 at X 320, Y 440 → select both → **Exclude**. Fill `#E5484D` |
| 16 | Gradient Rect | Rectangle | X 400, Y 420, 120 × 60, **linear gradient** left→right `#00C6FF` → `#0072FF` |
| 17 | Blurred Ellipse | Ellipse | X 540, Y 420, 60 × 60, fill `#30A46C`, **layer blur 8** |
| 18 | Title | Text | X 240, Y 10, *Auto width*, "Hello After Effects", Inter Bold 32, **centre** aligned, `#111111` |
| 19 | Body | Text | X 420, Y 500, **fixed width 260** (*Auto height*), "Mixed style text: bold and red.", Inter Regular 16, line height 24 px, letter spacing 2%, `#333333`; make **bold** Inter Bold and **red** `#E5484D` |
| 20 | Missing Font Text | Text | X 80, Y 540, auto width, "Font fallback test", a font that is **not installed on the AE machine** (e.g. Comic Neue Regular 14), letter spacing 1.4 px |
| 21 | Photo | Rectangle | X 620, Y 410, 120 × 90, **rotation 8°**, radius 12, **image fill**, stroke `#FFFFFF` 2 px Outside, drop shadow X 4 Y 4 blur 10 black 25% |
| 22 | Masked Group | Group | Ellipse **Mask Circle** X 700 Y 180, 60 × 60 → *Use as mask*; above it Rectangle **Masked Rect** X 690 Y 170, 50 × 80, fill `#E5484D` |
| 23 | Hidden Rect | Rectangle | X 10, Y 10, 20 × 20, black, **hidden** |
| 24 | Button | Instance | A component (frame) 140 × 44, radius 22, fill `#0090FF`, drop shadow Y 2 blur 6 black 30%, containing centred text **Label** "Get started", Inter Semi Bold 16 white. Place an instance at X 580, Y 250 |
| 25 | Export Slice | Slice | anywhere (an unsupported node) |

Inter must be installed on the Windows machine with After Effects (Regular, Semi Bold, Bold).

## Manual checklist (real Figma → After Effects 2025)

Export **Hero** with the plugin, unzip, import with the panel **twice**: once with the precomp checkbox off (null mode) and once with it on. Items marked ⚠ test AE scripting behaviour that the automated mocks assume but could not observe.

**Export (Figma)**

- [ ] E1 The plugin button is enabled only with exactly one frame selected; it shows "Ready: "Hero" (800 × 600)".
- [ ] E2 Export downloads `Hero-figma-ae.zip` containing `scene.json` and `images/img_001_Photo.png`.
- [ ] E3 `img_001_Photo.png` is 240 × 180 px, unrotated, with rounded corners and no stroke or shadow.
- [ ] E4 No temporary copy of Photo is left on the page after the export.
- [ ] E5 In `scene.json`, Ring has `"renderChildren": false` and an `EVENODD` path. Body has `"mixed": true` with 5 segments.

**Import (After Effects, null mode)**

- [ ] I1 Comp **Hero** opens: 800 × 600, 30 fps, 10 s, inside a project folder "Figma - Hero". One **Undo Import Figma Export** reverts everything.
- [ ] I2 Layer stack, bottom → top, reads: Hero (background), Background Card, Level 1, Level 2, Level 2 (background), Level 3, Deep Rect, Deep Ellipse, Circles, Circle 1 … 5, Rotated Rect, … , Button, Button (background), Label. These are the same names as in Figma.
- [ ] I3 Level 1 / Level 2 / Level 3 / Circles / Masked Group / Button are nulls. Deep Rect's parent is Level 3, Level 3's parent is Level 2, Level 2's parent is Level 1.
- [ ] I4 Overlay the comp on a Figma screenshot of Hero at 100%. Every shape sits on its Figma counterpart, including Deep Rect/Deep Ellipse inside the rotated Level 2.
- [ ] I5 Circles: five separate shape layers, each with one ellipse 40 × 40 and its own colour.
- [ ] I6 Rotated Rect: Rotation −30°, Opacity 50%, mode Multiply, anchor point at its centre.
- [ ] I7 Stroke Inside: stroke group rect 96 × 66, width 4; fill rect 100 × 70. The outer edge lines up with Figma.
- [ ] I8 Stroke Outside: stroke ellipse 86 × 86, width 6, fill ellipse 80 × 80.
- [ ] I9 Center Line: open path, 3 px, round caps, rotation −20°.
- [ ] I10 Rounded Rect roundness 16. Mixed Corners is a bezier path with only TL/BR rounded, and its stroke group has Offset Paths −1.
- [ ] I11 Star: Polystar (Star, 5 points) fills 80 × 80. Triangle: Polystar (Polygon, 3 points) fills 60 × 60 like in Figma.
- [ ] I12 Wave: one closed bezier path with the same curve, fill 80% opacity, 2 px stroke. Ring: two paths, Fill Rule *Even-Odd*, hole visible.
- [ ] I13 ⚠ Gradient Rect: a solid `#00C6FF` fill, plus a warning saying gradient colours can't be set by script. (If your AE build *does* accept gradient colours, you'll see a Gradient Fill instead and no warning.)
- [ ] I14 ⚠ Background Card has a Drop Shadow with Opacity **15%**, Direction 180°, Distance 8, Softness 24. Photo's shadow points down-right like in Figma. Blurred Ellipse has Gaussian Blur 8.
- [ ] I15 Title: editable point text, Inter Bold 32, centre-justified, `#111111`, horizontally centred on the Figma text. Its baseline is within ~2 px of Figma's.
- [ ] I16 ⚠ Body: paragraph text box with "bold" in Inter Bold and "red" in red, leading 24, tracking 20, no extra line wraps. ⚠ The box's top-left matches the Figma text box.
- [ ] I17 Missing Font Text uses Arial, with the warning `font "Comic Neue Regular" is not installed; using Arial`. Tracking 100.
- [ ] I18 ⚠ Label resolves "Inter Semi Bold" to the installed `Inter-SemiBold`.
- [ ] I19 Photo: footage layer at Scale 50%, Rotation −8°, with rounded corners from the PNG. **Photo (stroke)** is a white 2 px outline around it.
- [ ] I20 ⚠ Masked Rect uses Mask Circle as an alpha track matte; only the circle-shaped part is visible. Mask Circle is switched off.
- [ ] I21 Hidden Rect exists but its eye is off.
- [ ] I22 The summary shows layers created (38), 2 warnings (gradient, missing font) and 1 unsupported node (Export Slice (SLICE)). With the preference enabled, `figma-ae-import-log.txt` is written next to `scene.json`.

**Import (precomp mode)**

- [ ] I23 Precomps Level 1, Level 2, Level 3, Circles, Masked Group and Button are created. Level 2 is 220 × 160 and holds "Level 2 (background)" and the Level 3 precomp.
- [ ] I24 Everything lines up with Figma exactly as in I4.
- [ ] I25 Button's precomp layer has the drop shadow and does **not** collapse transformations (it clips). Level 1/Level 2 precomp layers collapse transformations (no clipping).
