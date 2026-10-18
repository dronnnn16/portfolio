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
2. Double-click `install-after-effects.bat` (in the `figma-to-ae` folder) and click **Yes**. It copies `after-effects\FigmaToAE.jsx` into
   `C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels\`.
   You can also copy the file there yourself; Explorer will ask for administrator permission.
3. Start After Effects and enable **Edit → Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network**.
   The panel needs this to save the pasted data (scene + images) and the import log.
4. Open the panel from the **Window** menu → **FigmaToAE.jsx** and dock it wherever you like. The bottom line shows the version (v1.1.1).

You can also run it once without installing: **File → Scripts → Run Script File…** and pick `FigmaToAE.jsx` (it opens as a floating palette).

## Use

Normal way: copy in Figma, paste in After Effects. You don't save or unzip any files.

1. **Figma:** select **one** frame (a component, instance, section or group also works). Run the plugin and click **Copy for After Effects**.
   It says, for example, "Copied 38 layers and 1 images (7 KB)".
2. **After Effects:** in the **FigmaToAE** panel, **click the big text box**, press **Ctrl+V**, then click **Import pasted data**.
3. A new comp named after the frame opens (frame size, 30 fps, 10 s), with a summary of the layers, warnings and unsupported nodes. The box empties itself. Everything is one undo step (**Edit → Undo Import Figma Export**).

Options in the panel:
- **Groups/frames as precomps (instead of nulls)**: off makes every Figma group/frame a Null layer that its children are parented to. On makes every group/frame a precomp, which you need for group opacity, group effects, group blend modes and frame clipping (see limitations).
- **Write import log**.

Image layers need real files, so the panel saves what you paste here:
- **Saved project:** `<project folder>\Figma Imports\<frame> <date-time>\`
- **Unsaved project:** `Documents\FigmaToAE\<frame> <date-time>\`

These folders hold `scene.json`, `images\` and the import log. Saving them is why **Allow Scripts to Write Files and Access Network** must be on.

**Other buttons:**
- **Paste from Figma**: tries to read the clipboard by itself, using PowerShell. On many PCs After Effects can't start PowerShell; then it tells you to use the box and puts the cursor in it.
- **Load Figma ZIP...**: for very big frames (large photos). In the plugin click **or download a ZIP instead**, then pick that ZIP here. No unzipping needed; the dialog opens in Downloads.
- **Import from folder...**: pick an already unzipped export folder (the one containing `scene.json`).

**If the data is "cut off":** on some Windows PCs a text box only takes about 32,000 characters. The plugin compresses the data (the Hero test frame is about 7,000 characters), so normal frames fit. Frames with big photos may not fit; the panel then says the data is cut off, and you should use **Load Figma ZIP...** for that frame. The plugin also warns when an export is larger than about 30,000 characters.

If the plugin shows a **Copy to clipboard** button instead of "Copied", the export took longer than the browser allows for an automatic copy. Click that button once.

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
| TEXT | Editable text layer: font looked up by family+style (`app.fonts`), size, colour, alignment, tracking = letterSpacing / fontSize × 1000 (or % × 10), rounded to a whole number because AE only accepts integers, leading from lineHeight. Fixed-width text → paragraph (box) text, auto-width → point text. Mixed styles → per-range styling with `TextDocument.characterRange` (AE 24.3+). Missing font → Arial + warning; bold/semibold/black styles fall back to Arial Bold and italics to Arial Italic, so mixed-style text keeps its emphasis |
| IMAGE fill | Node exported as a clean PNG @2x (fills only, unrotated); imported as footage and placed at 50% scale with the node's rotation, opacity and effects. Its stroke becomes a separate `(stroke)` shape layer |
| Transform | Computed from `absoluteTransform`, so group/frame nesting is exact. Anchor point = shape centre, rotation = −Figma rotation, opacity × 100, blend mode |
| Drop shadow | Drop Shadow effect (colour, opacity, direction, distance, softness), corrected for the layer's rotation and scale |
| Layer blur | Gaussian Blur |
| Mask (`isMask`) | Track matte (alpha or luma) for the siblings above it (AE 2023+ `setTrackMatte`) |
| Hidden node | Layer created but switched off |

`scene.json` is described field by field in [`figma-plugin/src/types.ts`](figma-plugin/src/types.ts). [`sample/scene.json`](sample/scene.json) is a complete example.

## How it was tested

`npm test` (in `figma-plugin/`) runs 58 automated checks:

- **Plugin:** the real serializer and ZIP writer run against a mock of the Figma plugin API that builds the reference test frame from [TESTING.md](TESTING.md). The mock follows Figma's transform rules: children of a group are positioned relative to the nearest frame, and the group's box comes from its children. The output is the committed [`sample/`](sample/). The ZIP is checked with `unzip -t`.
- **Real Figma:** the test frame was built in a real Figma design file and the plugin's serializer was run inside Figma's plugin runtime. That run found a crash the mock had hidden: Figma throws when you read a property a node type lacks, e.g. `opacity` on a slice. It is fixed, and the mock now throws the same way. The real export is committed in [`tests/fixtures/figma-real-export/`](tests/fixtures/figma-real-export/) and imported by the tests in both modes. Every layer lands on its Figma position (worst error ~1e-13 px), and the mock scene is checked to have the same structure as the real one.
- **AE script:** the real `FigmaToAE.jsx` runs against a strict mock of the AE scripting DOM. The mock rejects unknown match names, non-finite values and out-of-range values, and invalidates stale property references the way AE does. Parenting keeps world transforms, text documents are copies, and gradient colours can't be set. The tests import `sample/` in null mode and in precomp mode, then check every layer's world placement against Figma's `absoluteTransform`, plus the contents, effects, text and mattes. The script also has to parse as ECMAScript 3, contain only ASCII and run without any ES5+ built-ins.

**Not verified in this repository:**
- **Paste box:** tested against mocks only. Real Windows `edittext` behaviour has not been run here: how much text one paste holds, and how long a very large paste takes. Cut-off pastes are detected and point to **Load Figma ZIP...**.
- **Paste from Figma (PowerShell):** confirmed **not** to work on at least one Windows 11 + AE 2025 PC, where AE's `system.callSystem` can't run external programs. It is now only an optional shortcut that falls back to the paste box.
- **Figma side:** the plugin's own UI, i.e. the **Export** button, the ZIP download and the save dialog in the desktop app. The serializer and the image export did run in real Figma, but through Figma's plugin API rather than as the installed plugin.
- **After Effects side:** nothing has been run in real After Effects 2025. AE wasn't available, so the AE mock encodes the documented scripting API (and the behaviour listed above) rather than observed behaviour. Before relying on it, build the test frame in Figma and work through the [manual checklist in TESTING.md](TESTING.md#manual-checklist-real-figma--after-effects-2025). The AE assumptions most worth confirming there are marked ⚠ in the checklist.

## Known limitations

**Paint and effects**
- Gradient colours can't be set from ExtendScript, so gradient fills become a solid fill in the first stop's colour (logged). Angular/diamond gradients and gradient strokes get the same fallback.
- Image fills are baked into a PNG with all of that node's fills (e.g. a solid fill under the image) and its crop/scale mode. Video and pattern fills are skipped (logged).
- Inner shadow, background blur and drop-shadow spread are not supported (logged). Progressive blurs become a uniform Gaussian Blur (logged). Mapping blur radius → softness/blurriness 1:1 is an approximation.
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
- Font matching uses family + style name. Fonts whose style names differ from Figma's (beyond spaces/case) fall back to Arial, Arial Bold or Arial Italic depending on the style (logged). Figma ships Inter itself, so on Windows Inter is often not installed: install it from Google Fonts if text should match Figma.

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
