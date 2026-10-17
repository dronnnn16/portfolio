# Real Figma export

`scene.json` and `images/` were produced by the plugin's serializer (`figma-plugin/src/serialize.ts`)
running inside Figma's real plugin runtime, on the test frame from TESTING.md built in a real Figma
design file (2026-10-17). They were captured before `blurType` was added to effects, so that field is
absent here; everything else is the current format.

`run-all.mjs` imports this export in both modes (section R) and checks that the mock Figma scene has
the same structure, so the mock can't silently drift from what Figma really returns.
