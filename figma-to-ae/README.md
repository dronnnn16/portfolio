# Figma → After Effects exporter

Two tools that move a Figma frame into After Effects as native, editable layers:

| Part | Where | What it does |
|---|---|---|
| Figma plugin (TypeScript, esbuild, no frameworks) | [`figma-plugin/`](figma-plugin/) | Walks the selected frame, writes `scene.json`, exports image fills as @2x PNGs and downloads one ZIP. |
| After Effects ScriptUI panel (ExtendScript, ES3) | [`after-effects/FigmaToAE.jsx`](after-effects/FigmaToAE.jsx) | Reads the unzipped folder and rebuilds the frame as a comp with shape, text and footage layers. |

Target setup: Windows, After Effects 2025, Figma desktop app.

```
figma-to-ae/
├── figma-plugin/        manifest.json, code.ts, ui.html, src/, build.mjs, dist/ (prebuilt)
├── after-effects/       FigmaToAE.jsx
├── sample/              scene.json + images/ + figma-ae-sample.zip (generated reference export)
├── tests/               automated tests (mock Figma API + mock AE DOM)
├── TESTING.md           test Figma setup + manual checklist for real Figma/AE
└── README.md
```

## Install

### Figma plugin (desktop app)

The built files are committed in `figma-plugin/dist/`, so no build is needed to try it.

1. Open the **Figma desktop app** and any design file.
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Pick `figma-to-ae/figma-plugin/manifest.json`.
4. Run it from **Plugins → Development → Figma to After Effects Exporter**.

To rebuild after changing the code (Node 18+):

```bash
cd figma-to-ae/figma-plugin
npm install
npm run build        # or: npm run watch
```

### After Effects script (Windows, AE 2025)

1. Close After Effects.
2. Copy `after-effects/FigmaToAE.jsx` into
   `C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels\`
   (Explorer will ask for administrator permission).
3. Start After Effects and enable **Edit → Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network**.
   The import itself only reads files; this setting is needed for the panel to write `figma-ae-import-log.txt` next to `scene.json`. Without it the import still runs and the summary tells you the log was skipped.
4. Open the panel from the **Window** menu → **FigmaToAE.jsx** and dock it wherever you like.

You can also run it once without installing: **File → Scripts → Run Script File…** and pick `FigmaToAE.jsx` (it opens as a floating palette).

## Use

1. In Figma, select **one** frame (a component, instance, section or group also works) and click **Export** in the plugin.
   Figma saves `<frame name>-figma-ae.zip`.
2. Unzip it (right-click → **Extract All…**). The folder contains `scene.json` and `images/`.
3. In After Effects, open the **FigmaToAE** panel and choose the options:
   - **Groups/frames as precomps (instead of nulls)** — off: every Figma group/frame becomes a Null layer that the children are parented to. On: every group/frame becomes a precomp (needed for group opacity, group effects, group blend modes and frame clipping; see limitations).
   - **Write import log into the export folder**.
4. Click **Import Figma Export…** and pick the unzipped folder.
5. A new comp named after the frame (frame size, 30 fps, 10 s) opens. A summary lists layers created, warnings and unsupported nodes; the full list is also written to the log and to the ExtendScript console. Everything is in one undo step (**Edit → Undo Import Figma Export**).

## What gets converted

| Figma | After Effects |
|---|---|
| Selected frame | Comp, same size, 30 fps, 10 s; frame fills → `<name> (background)` shape layer at the bottom |
| GROUP / FRAME / INSTANCE / COMPONENT (nested to any depth) | Null layer used as parent, or precomp (checkbox). Names and stacking order are kept. Frame fills → `(background)` layer below the children, frame strokes → `(stroke)` layer above them |
| RECTANGLE | Shape layer with a Rectangle path (size + roundness). Different radius per corner → bezier path |
| ELLIPSE | Shape layer with an Ellipse path. Partial arcs/donuts → bezier path |
| POLYGON / STAR | Shape layer with a Polystar path (polygon/star, point count, inner radius), scaled to the Figma box |
| LINE | Shape layer with an open 2-point path and stroke (cap and join kept) |
| VECTOR / BOOLEAN_OPERATION | Shape layer; the SVG path data (`M L H V C S Q T Z`, absolute and relative) is rebuilt as AE bezier paths with fill rule (non-zero / even-odd) |
| Every shape | Its **own** shape layer; 5 circles in Figma = 5 shape layers, never merged |
| Solid fills and strokes | Fill / Stroke per paint, in Figma's stacking order, with colour and opacity. Inside/outside stroke is simulated: primitives are resized by the stroke width, paths get an **Offset Paths** operator |
| Linear/radial gradient fill | Gradient Fill with type and start/end points. AE does not let scripts set gradient colours, so it is replaced by a solid fill in the first stop's colour and logged |
| TEXT | Editable text layer: font looked up by family+style (`app.fonts`), size, colour, alignment, tracking = letterSpacing / fontSize × 1000 (or % × 10), leading from lineHeight. Fixed-width text → paragraph (box) text, auto-width → point text. Mixed styles → per-range styling with `TextDocument.characterRange` (AE 24.3+). Missing font → Arial + warning |
| IMAGE fill | Node exported as a clean PNG @2x (fills only, unrotated); imported as footage and placed at 50% scale with the node's rotation, opacity and effects. Its stroke becomes a separate `(stroke)` shape layer |
| Transform | Computed from `absoluteTransform`, so group/frame nesting is exact. Anchor point = shape centre, rotation = −Figma rotation, opacity × 100, blend mode |
| Drop shadow | Drop Shadow effect (colour, opacity, direction, distance, softness), corrected for the layer's rotation and scale |
| Layer blur | Gaussian Blur |
| Mask (`isMask`) | Track matte (alpha or luma) for the siblings above it (AE 2023+ `setTrackMatte`) |
| Hidden node | Layer created but switched off |

`scene.json` is described field by field in [`figma-plugin/src/types.ts`](figma-plugin/src/types.ts). [`sample/scene.json`](sample/scene.json) is a complete example.

## How it was tested

`npm test` (in `figma-plugin/`) runs 42 automated checks:

- **Plugin:** the real serializer and ZIP writer run against a mock of the Figma plugin API that builds the reference test frame from [TESTING.md](TESTING.md). The mock follows Figma's transform rules: children of a group are positioned relative to the nearest frame, and the group's box comes from its children. The output is the committed [`sample/`](sample/). The ZIP is checked with `unzip -t`.
- **AE script:** the real `FigmaToAE.jsx` runs against a strict mock of the AE scripting DOM. The mock rejects unknown match names, non-finite values and out-of-range values, and invalidates stale property references the way AE does. Parenting keeps world transforms, text documents are copies, and gradient colours can't be set. The tests import `sample/` in null mode and in precomp mode, then check every layer's world placement against Figma's `absoluteTransform`, plus the contents, effects, text and mattes. The script also has to parse as ECMAScript 3, contain only ASCII and run without any ES5+ built-ins.

**Not verified in this repository:** a run inside the real Figma desktop app or the real After Effects 2025. Neither was available where this was built, so the mocks encode the documented APIs (and the AE behaviour listed above) rather than observed behaviour. Before relying on it, build the test frame in Figma and work through the [manual checklist in TESTING.md](TESTING.md#manual-checklist-real-figma--after-effects-2025). The AE assumptions most worth confirming there are marked ⚠ in the checklist.

## Known limitations

**Paint and effects**
- Gradient colours can't be set from ExtendScript, so gradient fills become a solid fill in the first stop's colour (logged). Angular/diamond gradients and gradient strokes get the same fallback.
- Image fills are baked into a PNG with all of that node's fills (e.g. a solid fill under the image) and its crop/scale mode. Video and pattern fills are skipped (logged).
- Inner shadow, background blur and drop-shadow spread are not supported (logged). Mapping blur radius → softness/blurriness 1:1 is an approximation.
- Paint blend modes and "show shadow behind node" are ignored.

**Strokes and shapes**
- Per-side stroke weights use the largest side. Dashed strokes come in solid. Arrow caps become butt caps (all logged).
- Inside/outside strokes on paths, polystars and per-corner rectangles use **Offset Paths**, which can round or bevel sharp corners slightly differently from Figma.
- Polygon/star corner radius and corner smoothing are not supported.
- Boolean operations arrive as their flattened result; the operands are not editable in AE.
- Skew can't be represented by AE layer transforms; it only arises from non-uniform scaling combined with rotation.

**Text**
- The first-baseline position is estimated (Figma doesn't expose font metrics), so text can be a few pixels off vertically depending on the font. AE may also wrap paragraph text slightly differently; boxes get +2 px width and extra height to reduce that.
- Underline/strikethrough, title case, paragraph spacing, per-character opacity, OpenType features, variable-font axes and text on a path are not supported (logged where detectable).
- Mixed styles need AE 24.3+ (`characterRange`); older versions get the first style for all text (logged). Vertical alignment of fixed boxes needs `BoxVerticalAlignment` support, otherwise it is logged.
- Font matching uses family + style name. Fonts whose style names differ from Figma's (beyond spaces/case) fall back to Arial (logged).

**Hierarchy**
- Null mode: AE nulls don't pass opacity to children, so group opacity is multiplied into each child, which looks different where children overlap. Group blend modes, group effects and frame clipping are only reproduced in precomp mode (logged).
- Masks need AE 2023+. In null mode a mask must be a single layer (not a group). Only the nearest mask below a layer applies.
- Components/instances come in as plain frames; there is no link back to the main component.
- Precomps are at least 4 × 4 px (AE minimum), and comp sizes are rounded up to whole pixels.
- Unsupported node types (slices, stickies, connectors, widgets, embeds, text paths, …) are skipped and listed in the summary.

**Other**
- Only a static layout is imported. Prototype animations, auto layout and constraints are not carried over.
- If cloning an image node fails (rare, e.g. some instance sub-layers), the node is exported "as rendered" with rotation and effects baked into the PNG, and placed unrotated over its bounding box (logged).
- `scene.json` is parsed by an ES3 JSON parser, so very large files (many MB) take a few seconds.
