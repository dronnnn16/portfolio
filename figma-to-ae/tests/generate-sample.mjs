// Regenerates ../sample/ by running the real plugin serializer against the mock test scene.
// Usage: node tests/generate-sample.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestScene } from './lib/figma-mock.mjs';
import { loadPluginModules } from './lib/plugin-modules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const sampleDir = join(here, '..', 'sample');

export async function exportTestScene() {
  const { serialize, zip } = await loadPluginModules();
  const { figma, root, page } = buildTestScene();
  globalThis.figma = figma;
  const pageChildrenBefore = page.children.length;
  const result = await serialize.serializeScene(root, { imageScale: 2 });
  result.scene.exportedAt = '2026-01-01T00:00:00.000Z';
  const sceneText = JSON.stringify(result.scene, null, 2);
  const entries = [{ path: 'scene.json', data: zip.utf8(sceneText) }, ...result.images.map((i) => ({ path: i.path, data: i.bytes }))];
  const zipBytes = zip.createZip(entries, new Date(2026, 0, 1));
  return { ...result, sceneText, zipBytes, leftoverNodes: page.children.length - pageChildrenBefore };
}

export async function writeSample() {
  const out = await exportTestScene();
  rmSync(sampleDir, { recursive: true, force: true });
  mkdirSync(join(sampleDir, 'images'), { recursive: true });
  writeFileSync(join(sampleDir, 'scene.json'), out.sceneText + '\n');
  for (const img of out.images) writeFileSync(join(sampleDir, img.path), img.bytes);
  writeFileSync(join(sampleDir, 'figma-ae-sample.zip'), out.zipBytes);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await writeSample();
  console.log(`sample/ written: ${out.scene.stats.nodes} nodes, ${out.images.length} images`);
}
