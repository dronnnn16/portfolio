// End-to-end tests for both halves of the exporter, run in Node:
//   1. the real plugin serializer + ZIP writer against a mock Figma document,
//   2. static ES3 checks on the .jsx,
//   3. the real .jsx against a strict mock of the After Effects DOM, importing the
//      generated sample in null mode and precomp mode.
// Usage (from figma-plugin/): npm test     or: node ../tests/run-all.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { createAEEnvironment, apply, inv, mul, CompItem } from './lib/ae-mock.mjs';
import { encodePng, pngSize } from './lib/png.mjs';
import { loadPluginModules, requirePlugin } from './lib/plugin-modules.mjs';
import { exportTestScene, sampleDir } from './generate-sample.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const jsxPath = join(here, '..', 'after-effects', 'FigmaToAE.jsx');

// ------------------------------------------------------------------ tiny runner
let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(err && err.stack ? err.stack : err).split('\n').slice(0, 6).join('\n       ')}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}
function near(actual, expected, eps = 1e-3, msg = '') {
  if (Array.isArray(expected)) {
    assert.equal(actual.length >= expected.length, true, `${msg} length`);
    expected.forEach((e, i) => near(actual[i], e, eps, `${msg}[${i}]`));
    return;
  }
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected}, got ${actual}`);
}
function angleNear(actual, expected, msg) {
  const d = ((((actual - expected) % 360) + 540) % 360) - 180;
  assert.ok(Math.abs(d) < 1e-3, `${msg} expected ${expected}deg, got ${actual}deg`);
}

// ------------------------------------------------------------------ scene helpers
function indexScene(root) {
  const byName = {};
  (function walk(n) {
    byName[n.name] = n;
    n.children.forEach(walk);
  })(root);
  return byName;
}
function relToRoot(scene, node) {
  return mul(inv(scene.root.absoluteTransform), node.absoluteTransform);
}

// ------------------------------------------------------------------ AE helpers
const ES5_PLUS = `
  (function (strip) {
    strip(String.prototype, ['trim','trimStart','trimEnd','trimLeft','trimRight','includes','startsWith','endsWith','repeat','padStart','padEnd','at','replaceAll','codePointAt','normalize']);
    strip(Object, ['keys','create','assign','entries','values','freeze','defineProperty','defineProperties','getPrototypeOf','getOwnPropertyNames']);
    strip(Array, ['isArray','from','of']);
    strip(Math, ['hypot','sign','trunc','log10','log2','cbrt']);
    strip(Number, ['isFinite','isInteger','isNaN','parseFloat']);
    strip(Date, ['now']);
    strip(Function.prototype, ['bind']);
    strip(this, ['JSON','Map','Set','WeakMap','Promise','Proxy','Reflect']);
    strip(Array.prototype, ['indexOf','lastIndexOf','forEach','map','filter','some','every','reduce','reduceRight','find','findIndex','includes','fill','keys','values','entries','flat','flatMap','at']);
  })(function (obj, keys) { for (var i = 0; i < keys.length; i++) { delete obj[keys[i]]; } });
`;

function loadJsx(env) {
  const src = readFileSync(jsxPath, 'utf8').replace(/^#.*$/gm, ''); // ExtendScript preprocessor lines
  const ctx = vm.createContext({});
  vm.runInContext(ES5_PLUS, ctx);
  Object.assign(ctx, env.globals);
  ctx.$ = { global: ctx, os: 'Windows/64 10.0', writeln: (s) => env.log.writeln.push(String(s)) };
  ctx.FIGMA_TO_AE_NO_UI = true;
  vm.runInContext(src, ctx, { filename: 'FigmaToAE.jsx' });
  return ctx.FigmaToAE;
}

function runClipboardImport(clipboard, options = {}, envOptions = {}) {
  const env = createAEEnvironment({ clipboard, ...envOptions });
  const api = loadJsx(env);
  const result = api.importFromClipboard(options);
  if (result.warnings) result.warnings = Array.from(result.warnings);
  return { env, api, result };
}

function runImport(folder, options, envOptions) {
  const env = createAEEnvironment(envOptions);
  const api = loadJsx(env);
  const result = api.importFolder(new env.globals.Folder(folder), options);
  // Arrays created inside the sandbox lack ES5 methods and have a foreign prototype.
  if (result.warnings) result.warnings = Array.from(result.warnings);
  if (result.unsupported) result.unsupported = Array.from(result.unsupported);
  return { env, api, result };
}

// Every layer reachable from a comp (through precomp layers), with its matrix into the root comp.
function collectLayers(comp, chain = [[1, 0, 0], [0, 1, 0]], out = []) {
  for (const layer of comp.layers.all) {
    const world = mul(chain, layer.worldMatrix());
    out.push({ layer, comp, world });
    if (layer.source instanceof CompItem) collectLayers(layer.source, world, out);
  }
  return out;
}
function namesBottomUp(comp) {
  return comp.layers.all.map((l) => l.name).reverse();
}
function shapeGroups(layer) {
  const root = layer.property('ADBE Root Vectors Group');
  const out = [];
  for (let i = 1; i <= root.numProperties; i++) out.push(root.property(i));
  return out;
}
function contentsOf(group) {
  const c = group.property('ADBE Vectors Group');
  const out = [];
  for (let i = 1; i <= c.numProperties; i++) out.push(c.property(i));
  return out;
}
function find(items, matchName) {
  return items.find((p) => p.matchName === matchName);
}
function effects(layer) {
  const fx = layer.property('ADBE Effect Parade');
  const out = [];
  for (let i = 1; i <= fx.numProperties; i++) out.push(fx.property(i));
  return out;
}
function textDoc(layer) {
  return layer.property('ADBE Text Properties').property('ADBE Text Document').value;
}

// Checks that the layer's own space lines up with the Figma node's local space:
// Figma local point p must land on rel*p in the root comp.
function assertPlacement(entry, scene, node, kind) {
  const rel = relToRoot(scene, node);
  const w = node.width, h = node.height;
  const corners = [[0, 0], [w, 0], [w, h], [0, h], [w / 2, h / 2]];
  let toAE;
  if (kind === 'shape') toAE = ([x, y]) => [x - w / 2, y - h / 2];
  else if (kind === 'origin') toAE = ([x, y]) => [x, y];
  else if (kind === 'footage') {
    const src = entry.layer.source;
    toAE = ([x, y]) => [(x - w / 2) * (src.width / w) + src.width / 2, (y - h / 2) * (src.height / h) + src.height / 2];
  }
  for (const p of corners) {
    const got = apply(entry.world, ...toAE(p));
    const want = apply(rel, ...p);
    near(got, want, 1e-3, `${node.name} point (${p})`);
  }
}

// ==================================================================================
section('Figma plugin: serializer, image export, ZIP');

const exported = await exportTestScene();
const scene = exported.scene;
const byName = indexScene(scene.root);

await test('P1 scene.json header and root frame', () => {
  assert.equal(scene.format, 'figma-to-ae');
  assert.equal(scene.version, 1);
  assert.deepEqual(scene.frame, { id: scene.root.id, name: 'Hero', width: 800, height: 600 });
  assert.equal(scene.root.kind, 'frame');
  assert.equal(scene.stats.nodes, 38);
});

await test('P2 every node has the required fields', () => {
  const required = ['id', 'name', 'type', 'kind', 'visible', 'parentId', 'index', 'x', 'y', 'width', 'height', 'rotation', 'absoluteTransform', 'relativeTransform', 'opacity', 'blendMode', 'fills', 'strokes', 'strokeWeight', 'strokeAlign', 'cornerRadius', 'cornerRadii', 'effects', 'children'];
  (function walk(n, parent) {
    for (const k of required) assert.ok(k in n, `${n.name} missing ${k}`);
    assert.equal(n.parentId, parent ? parent.id : null, `${n.name} parentId`);
    n.children.forEach((c, i) => {
      assert.equal(c.index, i, `${c.name} index`);
      walk(c, n);
    });
  })(scene.root, null);
});

await test('P3 recursive walk reaches 3-level nesting with correct absolute transforms', () => {
  const deep = byName['Deep Rect'];
  assert.equal(byName['Level 1'].type, 'GROUP');
  assert.equal(byName['Level 2'].type, 'FRAME');
  assert.equal(byName['Level 3'].type, 'GROUP');
  assert.deepEqual(byName['Level 3'].children.map((c) => c.name), ['Deep Rect', 'Deep Ellipse']);
  // Level 2 is at (1080, 580) rotated 15deg; Deep Rect is at (20, 30) inside it.
  const r = (15 * Math.PI) / 180;
  near(deep.absoluteTransform[0], [Math.cos(r), Math.sin(r), 1080 + 20 * Math.cos(r) + 30 * Math.sin(r)], 1e-6, 'abs row 0');
  near(deep.absoluteTransform[1], [-Math.sin(r), Math.cos(r), 580 - 20 * Math.sin(r) + 30 * Math.cos(r)], 1e-6, 'abs row 1');
});

await test('P4 shape type mapping', () => {
  const kinds = { 'Background Card': 'rect', 'Circle 1': 'ellipse', 'Center Line': 'line', Star: 'polystar', Triangle: 'polystar', Wave: 'vector', Ring: 'vector', Title: 'text', 'Level 1': 'group', 'Level 2': 'frame', Button: 'frame', 'Export Slice': 'unsupported' };
  for (const [name, kind] of Object.entries(kinds)) assert.equal(byName[name].kind, kind, name);
  assert.deepEqual(byName.Star.polystar, { starType: 'star', pointCount: 5, innerRadius: 0.4 });
  assert.deepEqual(byName.Triangle.polystar, { starType: 'polygon', pointCount: 3, innerRadius: 0 });
});

await test('P5 vector paths and boolean geometry exported as SVG path data', () => {
  assert.equal(byName.Wave.vectorPaths.length, 1);
  assert.match(byName.Wave.vectorPaths[0].data, /^M 0 30 C .* Q .* Z$/);
  assert.equal(byName.Ring.vectorPaths[0].windingRule, 'EVENODD');
  assert.equal(byName.Ring.renderChildren, false);
  assert.equal(byName.Ring.children.length, 2);
});

await test('P6 fills, strokes, corner radii, rotation, opacity, blend mode', () => {
  const rr = byName['Rotated Rect'];
  assert.equal(rr.rotation, 30);
  assert.equal(rr.opacity, 0.5);
  assert.equal(rr.blendMode, 'MULTIPLY');
  assert.deepEqual(rr.fills[0].color, { r: 0.9686, g: 0.4196, b: 0.0824, a: 1 });
  const si = byName['Stroke Inside'];
  assert.equal(si.strokeWeight, 4);
  assert.equal(si.strokeAlign, 'INSIDE');
  assert.equal(si.strokes[0].type, 'SOLID');
  assert.equal(byName['Rounded Rect'].cornerRadius, 16);
  assert.equal(byName['Mixed Corners'].cornerRadius, null);
  assert.deepEqual(byName['Mixed Corners'].cornerRadii, [24, 0, 24, 0]);
});

await test('P7 gradient paint keeps stops and handles', () => {
  const g = byName['Gradient Rect'].fills[0];
  assert.equal(g.type, 'GRADIENT_LINEAR');
  assert.equal(g.gradientStops.length, 2);
  assert.deepEqual(g.gradientHandles, { start: [0, 0.5], end: [1, 0.5] });
  assert.deepEqual(g.color, g.gradientStops[0].color);
});

await test('P8 effects: drop shadow and layer blur values', () => {
  const s = byName['Background Card'].effects[0];
  assert.equal(s.type, 'DROP_SHADOW');
  assert.deepEqual(s.offset, { x: 0, y: 8 });
  assert.equal(s.radius, 24);
  assert.equal(s.color.a, 0.15);
  assert.deepEqual(byName['Blurred Ellipse'].effects[0], { type: 'LAYER_BLUR', visible: true, radius: 8, blurType: 'NORMAL' });
});

await test('P9 text: single style and mixed segments', () => {
  const t = byName.Title.text;
  assert.equal(t.characters, 'Hello After Effects');
  assert.deepEqual(t.fontName, { family: 'Inter', style: 'Bold' });
  assert.equal(t.fontSize, 32);
  assert.equal(t.textAlignHorizontal, 'CENTER');
  assert.equal(t.textAutoResize, 'WIDTH_AND_HEIGHT');
  assert.equal(t.mixed, false);
  const b = byName.Body.text;
  assert.equal(b.mixed, true);
  assert.equal(b.segments.length, 5);
  assert.equal(b.segments[1].characters, 'bold');
  assert.deepEqual(b.segments[1].fontName, { family: 'Inter', style: 'Bold' });
  assert.equal(b.segments[3].characters, 'red');
  assert.deepEqual(b.lineHeight, { unit: 'PIXELS', value: 24 });
  assert.deepEqual(b.letterSpacing, { unit: 'PERCENT', value: 2 });
  assert.equal(b.textAutoResize, 'HEIGHT');
});

await test('P10 image fill exported as clean @2x PNG; temporary clone removed', () => {
  const photo = byName.Photo;
  assert.deepEqual(photo.image, { file: 'images/img_001_Photo.png', scale: 2, baked: false });
  assert.equal(exported.images.length, 1);
  assert.deepEqual(pngSize(exported.images[0].bytes), { width: 240, height: 180 });
  assert.equal(exported.leftoverNodes, 0, 'clone left on the page');
});

await test('P11 ZIP contains scene.json + images and passes unzip -t', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-ae-zip-'));
  try {
    const zipPath = join(tmp, 'export.zip');
    cpSync(join(sampleDir, 'figma-ae-sample.zip'), zipPath);
    const listing = execFileSync('unzip', ['-l', zipPath]).toString();
    assert.match(listing, /scene\.json/);
    assert.match(listing, /images\/img_001_Photo\.png/);
    execFileSync('unzip', ['-tq', zipPath]);
    execFileSync('unzip', ['-q', zipPath, '-d', join(tmp, 'out')]);
    assert.equal(readFileSync(join(tmp, 'out', 'scene.json'), 'utf8'), exported.sceneText);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P12 committed sample/ matches a fresh export', () => {
  assert.equal(readFileSync(join(sampleDir, 'scene.json'), 'utf8'), exported.sceneText + '\n', 'run: node tests/generate-sample.mjs');
  assert.deepEqual(new Uint8Array(readFileSync(join(sampleDir, 'figma-ae-sample.zip'))), exported.zipBytes);
});

// ==================================================================================
section('After Effects script: static checks');

const jsxSource = readFileSync(jsxPath, 'utf8');

await test('S1 FigmaToAE.jsx is ASCII-only', () => {
  const bad = [...jsxSource].findIndex((ch) => ch.charCodeAt(0) > 127);
  assert.equal(bad, -1, `non-ASCII character at offset ${bad}`);
});

await test('S2 FigmaToAE.jsx parses as ECMAScript 3', () => {
  const acorn = requirePlugin('acorn');
  acorn.parse(jsxSource.replace(/^#.*$/gm, ''), { ecmaVersion: 3, sourceType: 'script' });
});

await test('S3 helpers: JSON parser matches JSON.parse on the sample', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const text = readFileSync(join(sampleDir, 'scene.json'), 'utf8');
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseJSON(text))), JSON.parse(text));
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseJSON('{"a":"\\u00e9\\n\\"x\\"","b":[1,-2.5e3,true,false,null],"c":{}}'))), { a: 'é\n"x"', b: [1, -2500, true, false, null], c: {} });
  assert.throws(() => api.parseJSON('{"a":1,}'));
});

await test('S4 helpers: SVG path parser (M L H V C S Q T Z, relative, implicit)', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const plain = (x) => JSON.parse(JSON.stringify(x));
  // H/V and relative commands; closing point folded into the first vertex.
  let p = plain(api.parseSvgPath('M 10 10 H 50 V 40 h -40 z'));
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].v, [[10, 10], [50, 10], [50, 40], [10, 40]]);
  assert.equal(p[0].closed, true);
  // Cubic: tangents relative to vertices.
  p = plain(api.parseSvgPath('M0 0 C 10 0 20 10 20 20'));
  assert.deepEqual(p[0].v, [[0, 0], [20, 20]]);
  assert.deepEqual(p[0].o[0], [10, 0]);
  assert.deepEqual(p[0].i[1], [0, -10]);
  assert.equal(p[0].closed, false);
  // Quadratic -> cubic (control points at 2/3).
  p = plain(api.parseSvgPath('M 0 0 Q 30 30 60 0'));
  near(p[0].o[0], [20, 20], 1e-9, 'quad out');
  near(p[0].i[1], [-20, 20], 1e-9, 'quad in');
  // Smooth cubic reflects the previous control point; implicit lineto after M.
  p = plain(api.parseSvgPath('M 0 0 10 0 C 10 10 20 10 20 0 S 30 -10 30 0'));
  assert.deepEqual(p[0].v, [[0, 0], [10, 0], [20, 0], [30, 0]]);
  near(p[0].o[2], [0, -10], 1e-9, 'S reflected');
  // T after Q.
  p = plain(api.parseSvgPath('M 0 0 Q 10 10 20 0 T 40 0'));
  assert.equal(p[0].v.length, 3);
  near(p[0].o[1], [20 / 3, -20 / 3], 1e-9, 'T reflected');
  // Two subpaths, relative move.
  p = plain(api.parseSvgPath('M 0 0 L 10 0 L 10 10 Z m 20 0 l 5 0 l 0 5 z'));
  assert.equal(p.length, 2);
  assert.deepEqual(p[1].v, [[20, 0], [25, 0], [25, 5]]);
  // Compact number syntax.
  p = plain(api.parseSvgPath('M1.5.5L-2-3'));
  assert.deepEqual(p[0].v, [[1.5, 0.5], [-2, -3]]);
  assert.throws(() => api.parseSvgPath('M 0 0 L 10'));
});

await test('S5 helpers: rounded rect path and polystar bounds', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const r = JSON.parse(JSON.stringify(api.roundedRectPath(100, 60, [10, 0, 10, 0])));
  assert.equal(r.v.length, 6);
  assert.equal(r.closed, true);
  near(r.v[0], [-50, -20], 1e-9, 'tl start');
  // radii larger than the box shrink proportionally
  const big = JSON.parse(JSON.stringify(api.roundedRectPath(40, 40, [40, 40, 40, 40])));
  near(big.v[1], [0, -20], 1e-9, 'clamped');
  const tri = api.polystarBounds(false, 3, 100, 0);
  near([tri.w, tri.h, tri.y], [Math.sqrt(3) * 100, 150, -100], 1e-9, 'triangle');
  const rot = api.mDecompose([[Math.cos(0.5), Math.sin(0.5), 0], [-Math.sin(0.5), Math.cos(0.5), 0]]);
  near([rot.rotation, rot.sx, rot.sy], [(-0.5 * 180) / Math.PI, 1, 1], 1e-9, 'decompose');
});

// ==================================================================================
section('After Effects import (null mode) - sample/');

const nullRun = runImport(sampleDir, { precomps: false, writeLog: false });
const R = nullRun.result;
const rootComp = nullRun.env.comps()[0];
const entries = R.ok ? collectLayers(rootComp) : [];
const L = (name) => {
  const e = entries.find((x) => x.layer.name === name);
  assert.ok(e, `layer "${name}" not found`);
  return e;
};

await test('A1 import succeeds inside exactly one undo group', () => {
  assert.equal(R.ok, true, R.error);
  assert.deepEqual(nullRun.env.log.undo, [['begin', 'Import Figma Export'], ['end']]);
});

await test('A2 comp matches the frame: 800x600, 30 fps, 10 s', () => {
  assert.equal(nullRun.env.comps().length, 1);
  assert.equal(rootComp.name, 'Hero');
  assert.deepEqual([rootComp.width, rootComp.height, rootComp.frameRate, rootComp.duration], [800, 600, 30, 10]);
  assert.equal(rootComp.opened, true);
});

await test('A3 layer order and names mirror Figma (nulls for groups/frames)', () => {
  assert.deepEqual(namesBottomUp(rootComp), [
    'Hero (background)', 'Background Card',
    'Level 1', 'Level 2', 'Level 2 (background)', 'Level 3', 'Deep Rect', 'Deep Ellipse',
    'Circles', 'Circle 1', 'Circle 2', 'Circle 3', 'Circle 4', 'Circle 5',
    'Rotated Rect', 'Stroke Inside', 'Stroke Outside', 'Center Line', 'Rounded Rect', 'Mixed Corners',
    'Star', 'Triangle', 'Wave', 'Ring', 'Gradient Rect', 'Blurred Ellipse',
    'Title', 'Body', 'Missing Font Text', 'Photo', 'Photo (stroke)',
    'Masked Group', 'Mask Circle', 'Masked Rect', 'Hidden Rect',
    'Button', 'Button (background)', 'Label',
  ]);
  for (const n of ['Level 1', 'Level 2', 'Level 3', 'Circles', 'Masked Group', 'Button']) assert.equal(L(n).layer.kind, 'null', n);
});

await test('A4 hierarchy: parents follow the Figma tree', () => {
  const parentName = (n) => (L(n).layer.parent ? L(n).layer.parent.name : null);
  assert.equal(parentName('Level 1'), null);
  assert.equal(parentName('Level 2'), 'Level 1');
  assert.equal(parentName('Level 2 (background)'), 'Level 2');
  assert.equal(parentName('Level 3'), 'Level 2');
  assert.equal(parentName('Deep Rect'), 'Level 3');
  assert.equal(parentName('Label'), 'Button');
  for (let i = 1; i <= 5; i++) assert.equal(parentName(`Circle ${i}`), 'Circles');
});

await test('A5 a group with 5 circles gives 5 separate shape layers', () => {
  for (let i = 1; i <= 5; i++) {
    const layer = L(`Circle ${i}`).layer;
    assert.equal(layer.kind, 'shape');
    const groups = shapeGroups(layer);
    assert.equal(groups.length, 1);
    const ell = find(contentsOf(groups[0]), 'ADBE Vector Shape - Ellipse');
    assert.deepEqual(ell.property('ADBE Vector Ellipse Size').value, [40, 40]);
  }
  const colors = [1, 2, 3, 4, 5].map((i) => find(contentsOf(shapeGroups(L(`Circle ${i}`).layer)[0]), 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').value.join());
  assert.equal(new Set(colors).size, 5);
});

await test('A6 every shape/null lands exactly where Figma puts it (incl. 3-level nesting + rotated frame)', () => {
  const checked = [];
  for (const e of entries) {
    const base = e.layer.name.replace(/ \((background|stroke)\)$/, '');
    const node = byName[base];
    if (!node) continue;
    if (e.layer.kind === 'shape') assertPlacement(e, scene, node, 'shape');
    else if (e.layer.kind === 'null') assertPlacement(e, scene, node, 'origin');
    else if (e.layer.kind === 'footage') assertPlacement(e, scene, node, 'footage');
    else continue;
    checked.push(e.layer.name);
  }
  assert.ok(checked.length >= 30, `only ${checked.length} layers checked`);
  angleNear(L('Deep Rect').layer.tp('ADBE Rotate Z').value + L('Level 3').layer.tp('ADBE Rotate Z').value + L('Level 2').layer.tp('ADBE Rotate Z').value + L('Level 1').layer.tp('ADBE Rotate Z').value, -15, 'Deep Rect total rotation');
});

await test('A7 rotation = -figmaRotation, opacity x100, blend mode', () => {
  const rr = L('Rotated Rect').layer;
  angleNear(rr.tp('ADBE Rotate Z').value, -30, 'Rotated Rect');
  assert.equal(rr.tp('ADBE Opacity').value, 50);
  assert.equal(rr.blendingMode, 'MULTIPLY');
  angleNear(L('Center Line').layer.tp('ADBE Rotate Z').value, -20, 'Center Line');
  near(rr.tp('ADBE Anchor Point').value, [0, 0], 1e-9, 'anchor at centre');
});

await test('A8 strokes: colour, width, inside/outside simulated by offsetting', () => {
  const si = shapeGroups(L('Stroke Inside').layer);
  assert.deepEqual(si.map((g) => g.name), ['Stroke 1', 'Fill 1']);
  const strokeRect = find(contentsOf(si[0]), 'ADBE Vector Shape - Rect');
  assert.deepEqual(strokeRect.property('ADBE Vector Rect Size').value, [96, 66]);
  const stroke = find(contentsOf(si[0]), 'ADBE Vector Graphic - Stroke');
  assert.equal(stroke.property('ADBE Vector Stroke Width').value, 4);
  near(stroke.property('ADBE Vector Stroke Color').value, [0, 0.5647, 1], 1e-4, 'stroke colour');
  assert.deepEqual(find(contentsOf(si[1]), 'ADBE Vector Shape - Rect').property('ADBE Vector Rect Size').value, [100, 70]);

  const so = shapeGroups(L('Stroke Outside').layer);
  assert.deepEqual(find(contentsOf(so[0]), 'ADBE Vector Shape - Ellipse').property('ADBE Vector Ellipse Size').value, [86, 86]);
  assert.deepEqual(find(contentsOf(so[1]), 'ADBE Vector Shape - Ellipse').property('ADBE Vector Ellipse Size').value, [80, 80]);

  const line = shapeGroups(L('Center Line').layer);
  assert.equal(line.length, 1);
  const path = find(contentsOf(line[0]), 'ADBE Vector Shape - Group').property('ADBE Vector Shape').value;
  assert.deepEqual(path.vertices, [[-60, 0], [60, 0]]);
  assert.equal(path.closed, false);
  const ls = find(contentsOf(line[0]), 'ADBE Vector Graphic - Stroke');
  assert.equal(ls.property('ADBE Vector Stroke Line Cap').value, 2);
  assert.equal(ls.property('ADBE Vector Stroke Width').value, 3);

  const mixedStroke = contentsOf(shapeGroups(L('Mixed Corners').layer)[0]);
  assert.equal(find(mixedStroke, 'ADBE Vector Filter - Offset').property('ADBE Vector Offset Amount').value, -1);
});

await test('A9 rounded rects: uniform roundness and per-corner path', () => {
  const rr = find(contentsOf(shapeGroups(L('Rounded Rect').layer)[0]), 'ADBE Vector Shape - Rect');
  assert.equal(rr.property('ADBE Vector Rect Roundness').value, 16);
  assert.deepEqual(rr.property('ADBE Vector Rect Size').value, [120, 70]);
  const fillGroup = shapeGroups(L('Mixed Corners').layer)[1];
  const shape = find(contentsOf(fillGroup), 'ADBE Vector Shape - Group').property('ADBE Vector Shape').value;
  assert.equal(shape.vertices.length, 6);
  assert.equal(shape.closed, true);
  near(shape.vertices[0], [-60, -11], 1e-9, 'first vertex');
  const card = find(contentsOf(shapeGroups(L('Background Card').layer)[0]), 'ADBE Vector Shape - Rect');
  assert.equal(card.property('ADBE Vector Rect Roundness').value, 24);
});

await test('A10 polystars use the native primitive scaled to the Figma box', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  for (const [name, type, points] of [['Star', 1, 5], ['Triangle', 2, 3]]) {
    const node = byName[name];
    const ng = find(contentsOf(shapeGroups(L(name).layer)[0]), 'ADBE Vector Group');
    const star = find(contentsOf(ng), 'ADBE Vector Shape - Star');
    assert.equal(star.property('ADBE Vector Star Type').value, type);
    assert.equal(star.property('ADBE Vector Star Points').value, points);
    const outer = star.property('ADBE Vector Star Outer Radius').value;
    const inner = star.property('ADBE Vector Star Inner Radius').value;
    const b = api.polystarBounds(type === 1, points, outer, inner);
    const scale = ng.property('ADBE Vector Transform Group').property('ADBE Vector Scale').value;
    near([(b.w * scale[0]) / 100, (b.h * scale[1]) / 100], [node.width, node.height], 1e-6, `${name} box`);
  }
});

await test('A11 vector + boolean paths rebuilt as bezier Shapes', () => {
  const wave = shapeGroups(L('Wave').layer);
  assert.deepEqual(wave.map((g) => g.name), ['Stroke 1', 'Fill 1']);
  const shape = find(contentsOf(wave[1]), 'ADBE Vector Shape - Group').property('ADBE Vector Shape').value;
  assert.equal(shape.closed, true);
  assert.equal(shape.vertices.length, 5);
  near(shape.vertices[0], [-100, 0], 1e-9, 'Wave start');
  near(shape.outTangents[0], [33.3333, -30], 1e-4, 'Wave C out');
  assert.equal(find(contentsOf(wave[1]), 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Opacity').value, 80);
  const ring = contentsOf(shapeGroups(L('Ring').layer)[0]);
  const paths = ring.filter((p) => p.matchName === 'ADBE Vector Shape - Group');
  assert.equal(paths.length, 2);
  assert.equal(find(ring, 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Rule').value, 2);
  assert.equal(paths[0].property('ADBE Vector Shape').value.vertices.length, 4);
});

await test('A12 gradient: falls back to first stop colour and logs it', () => {
  const g = contentsOf(shapeGroups(L('Gradient Rect').layer)[0]);
  assert.equal(find(g, 'ADBE Vector Graphic - G-Fill'), undefined);
  near(find(g, 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').value, [0, 0.7765, 1], 1e-4, 'first stop');
  assert.ok(R.warnings.some((w) => /\[Gradient Rect\] gradient colours can't be set by script; used the first stop colour \(#00c6ff\)/.test(w)));
});

await test('A13 effects: drop shadow and gaussian blur', () => {
  const [ds] = effects(L('Background Card').layer);
  assert.equal(ds.matchName, 'ADBE Drop Shadow');
  near(ds.property('ADBE Drop Shadow-0002').value, 0.15 * 255, 1e-6, 'opacity');
  near(ds.property('ADBE Drop Shadow-0003').value, 180, 1e-6, 'direction');
  near(ds.property('ADBE Drop Shadow-0004').value, 8, 1e-6, 'distance');
  near(ds.property('ADBE Drop Shadow-0005').value, 24, 1e-6, 'softness');
  const [blur] = effects(L('Blurred Ellipse').layer);
  assert.equal(blur.matchName, 'ADBE Gaussian Blur 2');
  assert.equal(blur.property('ADBE Gaussian Blur 2-0001').value, 8);
  const [bs] = effects(L('Button (background)').layer);
  assert.equal(bs.matchName, 'ADBE Drop Shadow');
});

await test('A14 text: single-style point text with font, size, colour, alignment', () => {
  const e = L('Title');
  assert.equal(e.layer.kind, 'text');
  const td = textDoc(e.layer);
  assert.equal(td.boxText, false);
  assert.equal(td.text, 'Hello After Effects');
  assert.equal(td.font, 'Inter-Bold');
  assert.equal(td.fontSize, 32);
  near(td.fillColor, [0.0667, 0.0667, 0.0667], 1e-4, 'fill');
  assert.equal(td.justification, 'CENTER_JUSTIFY');
  assert.equal(td.autoLeading, true);
  // AE anchor (baseline origin, centred) sits at the box centre-x, estimated first baseline.
  const node = byName.Title;
  near(apply(e.world, 0, 0), apply(relToRoot(scene, node), node.width / 2, 0.95 * 32), 1e-6, 'baseline anchor');
  const label = textDoc(L('Label').layer);
  assert.equal(label.font, 'Inter-SemiBold', 'style "Semi Bold" matched to SemiBold');
});

await test('A15 text: mixed styles via characterRange in fixed-width box text', () => {
  const e = L('Body');
  const td = textDoc(e.layer);
  assert.equal(td.boxText, true);
  assert.deepEqual(Array.from(td.boxTextSize), [262, 64]);
  assert.equal(td.font, 'Inter-Regular');
  assert.equal(td.tracking, 20, 'tracking = 2% * 10');
  assert.equal(td.autoLeading, false);
  assert.equal(td.leading, 24);
  const bold = td.ranges.find((r) => r.start === 18 && r.end === 22);
  assert.equal(bold.props.font, 'Inter-Bold');
  const red = td.ranges.find((r) => r.start === 27 && r.end === 30);
  near(red.props.fillColor, [0.898, 0.2824, 0.302], 1e-4, 'red');
  // Box top-left = Figma box top-left (plus half-leading correction).
  const node = byName.Body;
  near(apply(e.world, ...td.boxTextPos), apply(relToRoot(scene, node), 0, (24 - 1.2 * 16) / 2), 1e-6, 'box origin');
});

await test('A16 missing font falls back to Arial with a warning; tracking from px', () => {
  const td = textDoc(L('Missing Font Text').layer);
  assert.equal(td.font, 'ArialMT');
  near(td.tracking, 100, 1e-9, 'tracking = 1.4 / 14 * 1000');
  assert.ok(R.warnings.some((w) => w === '[Missing Font Text] font "Comic Neue Regular" is not installed; using Arial'));
});

await test('A16b without Inter installed, bold/semibold fall back to Arial Bold (bold stays bold)', () => {
  // Reproduces a real Windows PC: Figma ships Inter itself, so it is often missing from the OS.
  const { env, result } = runImport(sampleDir, { precomps: false, writeLog: false }, {
    fonts: [{ familyName: 'Arial', styleName: 'Regular', postScriptName: 'ArialMT' }],
  });
  assert.equal(result.ok, true, result.error);
  const all = collectLayers(env.comps()[0]);
  const doc = (name) => textDoc(all.find((x) => x.layer.name === name).layer);
  assert.equal(doc('Title').font, 'Arial-BoldMT', 'Inter Bold -> Arial Bold');
  assert.equal(doc('Label').font, 'Arial-BoldMT', 'Inter Semi Bold -> Arial Bold');
  const body = doc('Body');
  assert.equal(body.font, 'ArialMT', 'Inter Regular -> Arial');
  const bold = body.ranges.find((r) => r.start === 18 && r.end === 22);
  assert.equal(bold.props.font, 'Arial-BoldMT', '"bold" segment stays bold');
  assert.ok(result.warnings.includes('[Title] font "Inter Bold" is not installed; using Arial Bold'));
});

await test('A17 image: footage at 50% scale, rotated, with shadow; outer stroke as its own layer', () => {
  const e = L('Photo');
  assert.equal(e.layer.kind, 'footage');
  assert.deepEqual([e.layer.source.width, e.layer.source.height], [240, 180]);
  near(e.layer.tp('ADBE Scale').value, [50, 50], 1e-9, 'scale');
  angleNear(e.layer.tp('ADBE Rotate Z').value, -8, 'rotation');
  const [ds] = effects(e.layer);
  near(ds.property('ADBE Drop Shadow-0003').value, 135 + 8, 1e-6, 'direction compensates rotation');
  near(ds.property('ADBE Drop Shadow-0004').value, Math.sqrt(32) * 2, 1e-6, 'distance in footage pixels');
  const stroke = shapeGroups(L('Photo (stroke)').layer);
  assert.equal(stroke.length, 1);
  const rect = find(contentsOf(stroke[0]), 'ADBE Vector Shape - Rect');
  assert.deepEqual(rect.property('ADBE Vector Rect Size').value, [122, 92]);
  assert.equal(rect.property('ADBE Vector Rect Roundness').value, 13);
  assert.equal(nullRun.env.items.filter((i) => i.constructor.name === 'FootageItem').length, 1);
});

await test('A18 masks become track mattes; hidden nodes are disabled', () => {
  const masked = L('Masked Rect').layer;
  assert.equal(masked.trackMatteLayer.name, 'Mask Circle');
  assert.equal(masked.trackMatteType, 'ALPHA');
  assert.equal(L('Mask Circle').layer.enabled, false);
  assert.equal(L('Hidden Rect').layer.enabled, false);
  assert.equal(L('Rotated Rect').layer.enabled, true);
});

await test('A19 summary: counts, warnings and unsupported nodes', () => {
  assert.deepEqual(R.unsupported, ['Export Slice (SLICE)']);
  assert.equal(R.stats.layers, rootComp.layers.length);
  assert.equal(R.stats.shapes, 27);
  assert.equal(R.stats.texts, 4);
  assert.equal(R.stats.images, 1);
  assert.equal(R.stats.nulls, 6);
  assert.match(R.summary, /Layers created: 38 /);
  assert.match(R.summary, /Unsupported nodes: 1/);
  assert.ok(R.warnings.length >= 2);
  assert.ok(nullRun.env.log.writeln.join('\n').includes('Export Slice (SLICE)'));
});

// ==================================================================================
section('After Effects import (precomp mode) - sample/');

const pcRun = runImport(sampleDir, { precomps: true, writeLog: false });
const pcRoot = pcRun.env.comps()[0];
const pcEntries = pcRun.result.ok ? collectLayers(pcRoot) : [];
const PL = (name) => {
  const e = pcEntries.find((x) => x.layer.name === name);
  assert.ok(e, `layer "${name}" not found`);
  return e;
};

await test('B1 groups/frames become precomps sized to their box', () => {
  assert.equal(pcRun.result.ok, true, pcRun.result.error);
  const comps = pcRun.env.comps();
  assert.deepEqual(comps.map((c) => c.name), ['Hero', 'Level 1', 'Level 2', 'Level 3', 'Circles', 'Masked Group', 'Button']);
  const level2 = comps.find((c) => c.name === 'Level 2');
  assert.deepEqual([level2.width, level2.height], [220, 160]);
  assert.deepEqual(namesBottomUp(level2), ['Level 2 (background)', 'Level 3']);
  assert.deepEqual(namesBottomUp(comps.find((c) => c.name === 'Circles')), ['Circle 1', 'Circle 2', 'Circle 3', 'Circle 4', 'Circle 5']);
  assert.equal(pcRun.result.stats.precomps, 6);
  assert.equal(pcRun.result.stats.nulls, 0);
});

await test('B2 positions through nested precomps match Figma', () => {
  let checked = 0;
  for (const e of pcEntries) {
    const base = e.layer.name.replace(/ \((background|stroke)\)$/, '');
    const node = byName[base];
    if (!node) continue;
    if (e.layer.kind === 'shape') assertPlacement(e, scene, node, 'shape');
    else if (e.layer.kind === 'precomp') assertPlacement(e, scene, node, 'origin');
    else if (e.layer.kind === 'footage') assertPlacement(e, scene, node, 'footage');
    else continue;
    checked++;
  }
  assert.ok(checked >= 30, `only ${checked} checked`);
});

await test('B3 precomp layers carry opacity/effects; clipping follows clipsContent', () => {
  const level2 = PL('Level 2').layer;
  assert.equal(level2.collapseTransformation, true, 'Level 2 does not clip');
  assert.equal(PL('Level 1').layer.collapseTransformation, true, 'groups never clip');
  assert.equal(PL('Button').layer.collapseTransformation, false, 'Button clips');
  assert.equal(effects(PL('Button').layer)[0].matchName, 'ADBE Drop Shadow');
  assert.equal(effects(PL('Button (background)').layer).length, 0);
  assert.equal(PL('Masked Rect').layer.trackMatteLayer.name, 'Mask Circle');
});

// ==================================================================================
section('After Effects import: error handling and logging');

await test('C1 folder without scene.json fails cleanly (undo group still closed)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-ae-empty-'));
  try {
    const run = runImport(tmp, {});
    assert.equal(run.result.ok, false);
    assert.match(run.result.error, /scene\.json not found/);
    assert.deepEqual(run.env.log.undo, [['begin', 'Import Figma Export'], ['end']]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('C2 log file is written only when scripts may write files', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-ae-log-'));
  try {
    cpSync(sampleDir, tmp, { recursive: true });
    const off = runImport(tmp, { writeLog: true }, { prefsAllowWrite: false });
    assert.equal(existsSync(join(tmp, 'figma-ae-import-log.txt')), false);
    assert.ok(off.result.warnings.some((w) => /Allow Scripts to Write Files/.test(w)));
    const on = runImport(tmp, { writeLog: true }, { prefsAllowWrite: true });
    const log = readFileSync(join(tmp, 'figma-ae-import-log.txt'), 'utf8');
    assert.match(log, /Layers created: 38/);
    assert.match(log, /Export Slice \(SLICE\)/);
    assert.ok(on.result.logPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('C3 missing image file falls back to a shape layer with a warning', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-ae-noimg-'));
  try {
    cpSync(sampleDir, tmp, { recursive: true });
    rmSync(join(tmp, 'images'), { recursive: true });
    const run = runImport(tmp, {});
    assert.equal(run.result.ok, true);
    assert.ok(run.result.warnings.some((w) => /\[Photo\] image images\/img_001_Photo\.png is missing/.test(w)));
    const photo = collectLayers(run.env.comps()[0]).find((e) => e.layer.name === 'Photo');
    assert.equal(photo.layer.kind, 'shape');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================================================================================
section('Real Figma export (tests/fixtures/figma-real-export, captured from Figma itself)');

const realDir = join(here, 'fixtures', 'figma-real-export');
const realScene = JSON.parse(readFileSync(join(realDir, 'scene.json'), 'utf8'));
const realByName = indexScene(realScene.root);

await test('R1 mock scene has the same tree as the real Figma export (names, types, kinds, order, masks)', () => {
  const shape = (n) => ({ name: n.name, type: n.type, kind: n.kind, visible: n.visible, isMask: n.isMask, renderChildren: n.renderChildren, children: n.children.map(shape) });
  assert.deepEqual(shape(scene.root), shape(realScene.root));
});

for (const precomps of [false, true]) {
  await test(`R${precomps ? 3 : 2} real export imports in ${precomps ? 'precomp' : 'null'} mode with exact placement`, () => {
    const run = runImport(realDir, { precomps });
    assert.equal(run.result.ok, true, run.result.error);
    assert.deepEqual(run.result.unsupported, ['Export Slice (SLICE)']);
    assert.equal(run.result.warnings.length, 2, run.result.warnings.join('\n'));
    const all = collectLayers(run.env.comps()[0]);
    if (!precomps) assert.deepEqual(namesBottomUp(run.env.comps()[0]), namesBottomUp(rootComp));
    let checked = 0;
    for (const e of all) {
      const node = realByName[e.layer.name.replace(/ \((background|stroke)\)$/, '')];
      if (!node) continue;
      const kind = { shape: 'shape', null: 'origin', precomp: 'origin', footage: 'footage' }[e.layer.kind];
      if (!kind) continue;
      assertPlacement(e, realScene, node, kind);
      checked++;
    }
    assert.equal(checked, 34);
  });
}

await test('R4 real-data specifics: Figma-normalised paths, non-zero ring, fonts, image', () => {
  assert.doesNotMatch(realByName.Wave.vectorPaths[0].data, /Q/, 'Figma rewrites Q as C');
  assert.equal(realByName.Ring.vectorPaths[0].windingRule, 'NONZERO');
  const run = runImport(realDir, {});
  const L2 = (name) => collectLayers(run.env.comps()[0]).find((e) => e.layer.name === name).layer;
  const wave = find(contentsOf(shapeGroups(L2('Wave'))[1]), 'ADBE Vector Shape - Group').property('ADBE Vector Shape').value;
  assert.equal(wave.closed, true);
  assert.equal(wave.vertices.length, 5);
  near(wave.vertices[0], [-100, 22.5 - 52.5 / 2], 1e-6, 'Wave start');
  const ring = contentsOf(shapeGroups(L2('Ring'))[0]);
  assert.equal(ring.filter((p) => p.matchName === 'ADBE Vector Shape - Group').length, 2);
  assert.equal(find(ring, 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Rule').value, 1);
  assert.equal(textDoc(L2('Label')).font, 'Inter-SemiBold');
  assert.equal(textDoc(L2('Body')).ranges.find((r) => r.start === 18).props.font, 'Inter-Bold');
  const photo = L2('Photo');
  assert.deepEqual([photo.source.width, photo.source.height], [240, 180]);
  near(photo.tp('ADBE Scale').value, [50, 50], 1e-4, 'scale (Figma matrices are float32)');
});

// ==================================================================================
section('Paste box: "Copy for After Effects" (plugin) -> Ctrl+V into the panel -> "Import pasted data"');

const { clipboard: clipMod, zip: zipMod } = await loadPluginModules();
const clipText = await clipMod.buildClipboardText(scene.frame.name, JSON.stringify(scene), exported.images);
const clipTextV1 = await clipMod.buildClipboardText(scene.frame.name, JSON.stringify(scene), exported.images, { compress: false });
const plainScene = JSON.parse(JSON.stringify(scene));

function runTextImport(text, options = {}, envOptions = {}) {
  const env = createAEEnvironment(envOptions);
  const api = loadJsx(env);
  const result = api.importFromText(text, options);
  if (result.warnings) result.warnings = Array.from(result.warnings);
  return { env, api, result };
}

await test('Z1 ES3 inflate matches zlib (stored, fixed and dynamic blocks, random data, empty)', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const inflate = (buf) => Buffer.from(Array.from(api.inflateRaw(Array.from(buf))));
  const text = Buffer.from(readFileSync(join(sampleDir, 'scene.json')));
  const random = Buffer.alloc(70000);
  for (let i = 0; i < random.length; i++) random[i] = (i * 2654435761) >>> 24;
  for (const [label, input] of [['scene', text], ['random', random], ['empty', Buffer.alloc(0)], ['repeat', Buffer.alloc(100000, 97)]]) {
    for (const level of [0, 1, 6, 9]) {
      assert.ok(inflate(zlib.deflateRawSync(input, { level })).equals(input), `${label} level ${level}`);
    }
  }
  assert.ok(inflate(zlib.deflateRawSync(text, { strategy: zlib.constants.Z_FIXED })).equals(text), 'fixed Huffman');
  assert.throws(() => api.inflateRaw(Array.from(zlib.deflateRawSync(text)).slice(0, 500)), /damaged/);
});

await test('PB1 plugin output: compressed format 2, ASCII, small enough for a paste box', () => {
  assert.equal(/[^\x00-\x7f]/.test(clipText), false);
  const lines = clipText.split('\n');
  assert.deepEqual([lines[0], lines[1], lines[2]], ['FIGMA_TO_AE_CLIPBOARD 2', 'NAME "Hero"', 'SCENEZ']);
  assert.equal(lines.at(-1), 'END');
  assert.ok(clipText.length < clipMod.PASTE_BOX_SAFE_CHARS, `Hero payload ${clipText.length} chars`);
  assert.ok(clipText.length < clipTextV1.length / 3, `compression: ${clipText.length} vs ${clipTextV1.length}`);
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const clip = api.parseClipboard(clipText);
  assert.equal(clip.name, 'Hero');
  assert.deepEqual(JSON.parse(clip.scene), plainScene);
  assert.deepEqual(new Uint8Array(Buffer.from(api.base64Decode(clip.images[0].data), 'latin1')), exported.images[0].bytes);
  assert.deepEqual(JSON.parse(api.parseClipboard(clipTextV1).scene), plainScene, 'old format 1 still reads');
});

await test('PB2 "Import pasted data" builds the comp from the box text - no PowerShell, no dialogs, box path files', () => {
  const run = runTextImport(clipText, { precomps: false, writeLog: true });
  assert.equal(run.result.ok, true, run.result.error);
  assert.equal(run.env.log.commands.length, 0, 'no external process');
  const comp = run.env.comps()[0];
  assert.deepEqual([comp.name, comp.width, comp.height], ['Hero', 800, 600]);
  assert.deepEqual(namesBottomUp(comp), namesBottomUp(rootComp));
  assert.equal(run.result.stats.layers, 38);
  assert.equal(run.result.warnings.length, 2);
  const folder = run.result.folder.fsName;
  assert.match(folder, /\/FigmaToAE\/Hero \d{8}-\d{6}$/);
  assert.deepEqual(new Uint8Array(readFileSync(join(folder, 'images', 'img_001_Photo.png'))), exported.images[0].bytes);
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'scene.json'), 'utf8')), plainScene);
});

await test('PB3 paste survives CRLF, CR, extra spaces/blank lines, the box hint and wrapped data lines', () => {
  const wrap = (t) => t.split('\n').map((l) => (l.length > 76 && !/^(NAME|IMAGE) /.test(l) ? l.match(/.{1,76}/g).join('\n') : l)).join('\n');
  const variants = {
    crlf: clipText.replace(/\n/g, '\r\n'),
    cr: clipText.replace(/\n/g, '\r'),
    padded: '\n\n   ' + clipText.split('\n').map((l) => '  ' + l + ' \t').join('\n\n') + '\r\n\r\n  ',
    hint: 'Click here, press Ctrl+V, then Import pasted data' + clipText,
    wrapped: wrap(clipText),
    wrappedV1crlf: wrap(clipTextV1).replace(/\n/g, '\r\n'),
  };
  for (const [label, text] of Object.entries(variants)) {
    const run = runTextImport(text);
    assert.equal(run.result.ok, true, `${label}: ${run.result.error}`);
    assert.equal(run.result.stats.layers, 38, label);
    assert.deepEqual(new Uint8Array(readFileSync(join(run.result.folder.fsName, 'images', 'img_001_Photo.png'))), exported.images[0].bytes, label);
  }
});

await test('PB4 big paste: 400x300 noise photo (~550 KB of text) imports intact', async () => {
  let seed = 2463534242;
  const next = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed;
  };
  const noise = encodePng(400, 300, () => { const r = next(); return [r >>> 24, (r >>> 16) & 255, (r >>> 8) & 255, 255]; });
  const images = [{ path: 'images/img_001_Photo.png', bytes: noise }];
  const big = await clipMod.buildClipboardText('Hero', JSON.stringify(scene), images);
  assert.ok(big.length > 500000, `payload ${big.length}`);
  const t0 = Date.now();
  const run = runTextImport(big.replace(/\n/g, '\r\n'));
  assert.equal(run.result.ok, true, run.result.error);
  assert.deepEqual(new Uint8Array(readFileSync(join(run.result.folder.fsName, 'images', 'img_001_Photo.png'))), noise);
  const photo = collectLayers(run.env.comps()[0]).find((e) => e.layer.name === 'Photo').layer;
  assert.deepEqual([photo.source.width, photo.source.height], [400, 300]);
  assert.ok(Date.now() - t0 < 20000, 'too slow');
});

await test('PB5 cut-off paste (e.g. a 32,767-char box limit) is reported clearly and imports nothing', async () => {
  const big = await clipMod.buildClipboardText('Hero', JSON.stringify(scene), [{ path: 'images/img_001_Photo.png', bytes: encodePng(300, 200, (x, y) => [x & 255, y & 255, (x * y) & 255, 255]) }]);
  for (const cut of [32767, 120, big.indexOf('IMAGE') + 40]) {
    const run = runTextImport(big.slice(0, cut), { showSummary: true });
    assert.equal(run.result.ok, false, `cut at ${cut}`);
    assert.equal(run.result.cutOff, true, `cut at ${cut}: ${run.result.error}`);
    assert.match(run.result.error, new RegExp(`cut off \\(got ${cut} characters`));
    assert.match(run.result.error, /Load Figma ZIP/);
    assert.match(run.env.log.alerts[0], /cut off/);
    assert.equal(run.env.comps().length, 0);
  }
  // Damaged compressed scene (END present) is an error, not a crash.
  const lines = clipText.split('\n');
  lines[3] = lines[3].slice(0, 200);
  assert.match(runTextImport(lines.join('\n')).result.error, /damaged/);
});

await test('PB6 other text in the box, empty box, unsafe image path, preference off', () => {
  let run = runTextImport('hello world', { showSummary: true });
  assert.match(run.result.error, /doesn't contain a Figma export/);
  assert.match(run.env.log.alerts[0], /Ctrl\+V/);
  run = runTextImport('');
  assert.match(run.result.error, /doesn't contain a Figma export/);
  run = runTextImport(clipText.replace('IMAGE images/img_001_Photo.png', 'IMAGE ../../evil.png'));
  assert.match(run.result.error, /Unexpected image path/);
  assert.equal(run.env.comps().length, 0);
  run = runTextImport(clipText, {}, { prefsAllowWrite: false });
  assert.match(run.result.error, /Allow Scripts to Write Files/);
  assert.match(runTextImport(clipText.replace('FIGMA_TO_AE_CLIPBOARD 2', 'FIGMA_TO_AE_CLIPBOARD 9')).result.error, /newer version/);
});

await test('PB7 "Paste from Figma": works where PowerShell works; on a PC like yours it points to the box', () => {
  let run = runClipboardImport(clipText, {});
  assert.equal(run.result.ok, true, run.result.error);
  assert.match(run.env.log.commands[0], /^powershell\.exe .*Get-Clipboard -Raw/);
  // callSystem runs but PowerShell does nothing (the reported AE behaviour).
  run = runClipboardImport(clipText, { showSummary: true }, { clipboardReadable: false });
  assert.equal(run.result.ok, false);
  assert.equal(run.result.needsPasteBox, true);
  assert.doesNotMatch(run.result.error, /No Figma export/);
  assert.match(run.result.error, /can't read the clipboard on this PC[\s\S]*Ctrl\+V[\s\S]*Import pasted data/);
  assert.equal(run.env.comps().length, 0);
  // A readable clipboard with other content still says so.
  run = runClipboardImport('some other text');
  assert.match(run.result.error, /doesn't contain a Figma export/);
});

await test('ZIP1 "Load Figma ZIP..." reads the plugin ZIP directly (no unzipping)', () => {
  const env = createAEEnvironment();
  const api = loadJsx(env);
  const result = api.importZipFile(new env.globals.File(join(sampleDir, 'figma-ae-sample.zip')), {});
  assert.equal(result.ok, true, result.error);
  assert.equal(result.stats.layers, 38);
  assert.match(result.folder.fsName, /\/FigmaToAE\/figma-ae-sample \d{8}-\d{6}$/);
  assert.deepEqual(new Uint8Array(readFileSync(join(result.folder.fsName, 'images', 'img_001_Photo.png'))), exported.images[0].bytes);
  assert.equal(readFileSync(join(result.folder.fsName, 'scene.json'), 'utf8'), exported.sceneText);
});

await test('ZIP2 deflated ZIP with a top folder (re-zipped by Windows) works; bad ZIPs fail cleanly', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-ae-zip2-'));
  try {
    // Build a deflate-compressed ZIP, files inside "Hero-figma-ae/".
    const files = [
      { name: 'Hero-figma-ae/', data: Buffer.alloc(0) },
      { name: 'Hero-figma-ae/scene.json', data: Buffer.from(exported.sceneText) },
      { name: 'Hero-figma-ae/images/img_001_Photo.png', data: Buffer.from(exported.images[0].bytes) },
    ];
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
      const comp = f.data.length ? zlib.deflateRawSync(f.data) : Buffer.alloc(0);
      const name = Buffer.from(f.name);
      const crc = zipMod.crc32(new Uint8Array(f.data));
      const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(f.data.length ? 8 : 0, 8);
      lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
      const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(f.data.length ? 8 : 0, 10);
      ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
      locals.push(lh, name, comp); centrals.push(ch, name);
      offset += 30 + name.length + comp.length;
    }
    const cd = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
    const zipPath = join(tmp, 'Hero-figma-ae.zip');
    writeFileSync(zipPath, Buffer.concat([...locals, cd, eocd]));
    execFileSync('unzip', ['-tq', zipPath]);

    const env = createAEEnvironment();
    const api = loadJsx(env);
    const ok = api.importZipFile(new env.globals.File(zipPath), {});
    assert.equal(ok.ok, true, ok.error);
    assert.equal(ok.stats.layers, 38);
    assert.match(ok.folder.fsName, /\/Hero \d{8}-\d{6}$/);
    assert.deepEqual(new Uint8Array(readFileSync(join(ok.folder.fsName, 'images', 'img_001_Photo.png'))), exported.images[0].bytes);

    writeFileSync(join(tmp, 'not.zip'), 'hello');
    assert.match(api.importZipFile(new env.globals.File(join(tmp, 'not.zip')), {}).error, /not a ZIP/);
    writeFileSync(join(tmp, 'other.zip'), zipMod.createZip([{ path: 'readme.txt', data: zipMod.utf8('x') }]));
    assert.match(api.importZipFile(new env.globals.File(join(tmp, 'other.zip')), {}).error, /no scene\.json/);
    writeFileSync(join(tmp, 'evil.zip'), zipMod.createZip([{ path: 'scene.json', data: zipMod.utf8(exported.sceneText) }, { path: 'images/../../x.png', data: zipMod.utf8('x') }]));
    assert.match(api.importZipFile(new env.globals.File(join(tmp, 'evil.zip')), {}).error, /Unexpected file/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('V1 panel and plugin are both version 1.1.1', () => {
  const env = createAEEnvironment();
  assert.equal(loadJsx(env).version, '1.1.1');
  assert.equal(JSON.parse(readFileSync(join(here, '..', 'figma-plugin', 'package.json'), 'utf8')).version, '1.1.1');
  assert.match(readFileSync(join(here, '..', 'figma-plugin', 'dist', 'ui.html'), 'utf8'), /v1\.1\.1[\s\S]*press <b>Ctrl\+V<\/b>|press <b>Ctrl\+V<\/b>[\s\S]*v1\.1\.1/);
});

// ==================================================================================
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
