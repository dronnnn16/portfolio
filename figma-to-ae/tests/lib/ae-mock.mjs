// Strict mock of the parts of the After Effects scripting DOM used by FigmaToAE.jsx.
//
// It is deliberately unforgiving so mistakes show up in tests:
// - property()/addProperty() only accept known match names for each group;
// - setValue() checks dimensions, finiteness and ranges;
// - adding/removing a property invalidates previously fetched sibling references
//   (as AE does), and touching an invalid object throws;
// - setting Layer.parent keeps the layer's world transform (pick-whip behaviour);
// - TextDocument values are copies: changes only stick after setValue();
// - gradient colours cannot be set (as in AE).
// It also composes transforms so tests can check where things end up in the comp.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname as pathDirname } from 'node:path';
import { pngSize } from './png.mjs';

// ---------------------------------------------------------------- matrices
export function mul(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1], A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1], A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2]],
  ];
}
export function inv(M) {
  const [[a, c, e], [b, d, f]] = M;
  const det = a * d - b * c;
  return [
    [d / det, -c / det, (c * f - d * e) / det],
    [-b / det, a / det, (b * e - a * f) / det],
  ];
}
export function apply(M, x, y) {
  return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
}

// ---------------------------------------------------------------- property schema
const SHAPE_ITEMS = [
  'ADBE Vector Group',
  'ADBE Vector Shape - Rect',
  'ADBE Vector Shape - Ellipse',
  'ADBE Vector Shape - Star',
  'ADBE Vector Shape - Group',
  'ADBE Vector Graphic - Fill',
  'ADBE Vector Graphic - Stroke',
  'ADBE Vector Graphic - G-Fill',
  'ADBE Vector Graphic - G-Stroke',
  'ADBE Vector Filter - Offset',
  'ADBE Vector Filter - Merge',
  'ADBE Vector Filter - Trim',
];

const P = (dims, def, extra = {}) => ({ dims, def, ...extra });
const PROPS = {
  'ADBE Vector Blend Mode': P(1, 1),
  'ADBE Vector Shape Direction': P(1, 1),
  'ADBE Vector Rect Size': P(2, [100, 100], { min: 0 }),
  'ADBE Vector Rect Position': P(2, [0, 0]),
  'ADBE Vector Rect Roundness': P(1, 0, { min: 0 }),
  'ADBE Vector Ellipse Size': P(2, [100, 100], { min: 0 }),
  'ADBE Vector Ellipse Position': P(2, [0, 0]),
  'ADBE Vector Star Type': P(1, 1, { oneOf: [1, 2] }),
  'ADBE Vector Star Points': P(1, 5, { min: 3 }),
  'ADBE Vector Star Position': P(2, [0, 0]),
  'ADBE Vector Star Rotation': P(1, 0),
  'ADBE Vector Star Inner Radius': P(1, 50, { min: 0 }),
  'ADBE Vector Star Outer Radius': P(1, 100, { min: 0 }),
  'ADBE Vector Star Inner Roundess': P(1, 0),
  'ADBE Vector Star Outer Roundess': P(1, 0),
  'ADBE Vector Shape': P('shape', null),
  'ADBE Vector Fill Color': P(3, [1, 0, 0], { min: 0, max: 1, color: true }),
  'ADBE Vector Fill Opacity': P(1, 100, { min: 0, max: 100 }),
  'ADBE Vector Fill Rule': P(1, 1, { oneOf: [1, 2] }),
  'ADBE Vector Composite Order': P(1, 1),
  'ADBE Vector Stroke Color': P(3, [1, 1, 1], { min: 0, max: 1, color: true }),
  'ADBE Vector Stroke Opacity': P(1, 100, { min: 0, max: 100 }),
  'ADBE Vector Stroke Width': P(1, 2, { min: 0 }),
  'ADBE Vector Stroke Line Cap': P(1, 1, { oneOf: [1, 2, 3] }),
  'ADBE Vector Stroke Line Join': P(1, 1, { oneOf: [1, 2, 3] }),
  'ADBE Vector Stroke Miter Limit': P(1, 4),
  'ADBE Vector Grad Type': P(1, 1, { oneOf: [1, 2] }),
  'ADBE Vector Grad Start Pt': P(2, [0, 0]),
  'ADBE Vector Grad End Pt': P(2, [100, 0]),
  'ADBE Vector Grad Colors': P('novalue', null),
  'ADBE Vector Offset Amount': P(1, 10),
  'ADBE Vector Offset Line Join': P(1, 1, { oneOf: [1, 2, 3] }),
  'ADBE Vector Offset Miter Limit': P(1, 4),
  'ADBE Vector Anchor': P(2, [0, 0]),
  'ADBE Vector Position': P(2, [0, 0]),
  'ADBE Vector Scale': P(2, [100, 100]),
  'ADBE Vector Skew': P(1, 0),
  'ADBE Vector Skew Axis': P(1, 0),
  'ADBE Vector Rotation': P(1, 0),
  'ADBE Vector Group Opacity': P(1, 100, { min: 0, max: 100 }),
  'ADBE Anchor Point': P('2or3', [0, 0, 0]),
  'ADBE Position': P('2or3', [0, 0, 0]),
  'ADBE Scale': P('2or3', [100, 100, 100]),
  'ADBE Rotate Z': P(1, 0),
  'ADBE Opacity': P(1, 100, { min: 0, max: 100 }),
  'ADBE Drop Shadow-0001': P(3, [0, 0, 0], { min: 0, max: 1, color: true }),
  'ADBE Drop Shadow-0002': P(1, 127.5, { min: 0, max: 255 }),
  'ADBE Drop Shadow-0003': P(1, 135),
  'ADBE Drop Shadow-0004': P(1, 5, { min: 0 }),
  'ADBE Drop Shadow-0005': P(1, 0, { min: 0 }),
  'ADBE Drop Shadow-0006': P(1, 0),
  'ADBE Gaussian Blur 2-0001': P(1, 0, { min: 0 }),
  'ADBE Gaussian Blur 2-0002': P(1, 1),
  'ADBE Gaussian Blur 2-0003': P(1, 0),
};

const GROUPS = {
  'ADBE Root Vectors Group': { indexed: true, accepts: SHAPE_ITEMS, name: 'Contents' },
  'ADBE Vectors Group': { indexed: true, accepts: SHAPE_ITEMS, name: 'Contents' },
  'ADBE Vector Group': { fixed: ['ADBE Vector Blend Mode', 'ADBE Vectors Group', 'ADBE Vector Transform Group'], name: 'Group' },
  'ADBE Vector Transform Group': {
    fixed: ['ADBE Vector Anchor', 'ADBE Vector Position', 'ADBE Vector Scale', 'ADBE Vector Skew', 'ADBE Vector Skew Axis', 'ADBE Vector Rotation', 'ADBE Vector Group Opacity'],
    name: 'Transform',
  },
  'ADBE Vector Shape - Rect': { fixed: ['ADBE Vector Shape Direction', 'ADBE Vector Rect Size', 'ADBE Vector Rect Position', 'ADBE Vector Rect Roundness'], name: 'Rectangle Path' },
  'ADBE Vector Shape - Ellipse': { fixed: ['ADBE Vector Shape Direction', 'ADBE Vector Ellipse Size', 'ADBE Vector Ellipse Position'], name: 'Ellipse Path' },
  'ADBE Vector Shape - Star': {
    fixed: ['ADBE Vector Shape Direction', 'ADBE Vector Star Type', 'ADBE Vector Star Points', 'ADBE Vector Star Position', 'ADBE Vector Star Rotation', 'ADBE Vector Star Inner Radius', 'ADBE Vector Star Outer Radius', 'ADBE Vector Star Inner Roundess', 'ADBE Vector Star Outer Roundess'],
    name: 'Polystar Path',
  },
  'ADBE Vector Shape - Group': { fixed: ['ADBE Vector Shape Direction', 'ADBE Vector Shape'], name: 'Path' },
  'ADBE Vector Graphic - Fill': { fixed: ['ADBE Vector Blend Mode', 'ADBE Vector Composite Order', 'ADBE Vector Fill Rule', 'ADBE Vector Fill Color', 'ADBE Vector Fill Opacity'], name: 'Fill' },
  'ADBE Vector Graphic - Stroke': {
    fixed: ['ADBE Vector Blend Mode', 'ADBE Vector Composite Order', 'ADBE Vector Stroke Color', 'ADBE Vector Stroke Opacity', 'ADBE Vector Stroke Width', 'ADBE Vector Stroke Line Cap', 'ADBE Vector Stroke Line Join', 'ADBE Vector Stroke Miter Limit'],
    name: 'Stroke',
  },
  'ADBE Vector Graphic - G-Fill': {
    fixed: ['ADBE Vector Blend Mode', 'ADBE Vector Composite Order', 'ADBE Vector Fill Rule', 'ADBE Vector Grad Type', 'ADBE Vector Grad Start Pt', 'ADBE Vector Grad End Pt', 'ADBE Vector Grad Colors', 'ADBE Vector Fill Opacity'],
    name: 'Gradient Fill',
  },
  'ADBE Vector Filter - Offset': { fixed: ['ADBE Vector Offset Amount', 'ADBE Vector Offset Line Join', 'ADBE Vector Offset Miter Limit'], name: 'Offset Paths' },
  'ADBE Transform Group': { fixed: ['ADBE Anchor Point', 'ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'], name: 'Transform' },
  'ADBE Effect Parade': { indexed: true, accepts: ['ADBE Drop Shadow', 'ADBE Gaussian Blur 2'], name: 'Effects' },
  'ADBE Drop Shadow': { fixed: ['ADBE Drop Shadow-0001', 'ADBE Drop Shadow-0002', 'ADBE Drop Shadow-0003', 'ADBE Drop Shadow-0004', 'ADBE Drop Shadow-0005', 'ADBE Drop Shadow-0006'], name: 'Drop Shadow' },
  'ADBE Gaussian Blur 2': { fixed: ['ADBE Gaussian Blur 2-0001', 'ADBE Gaussian Blur 2-0002', 'ADBE Gaussian Blur 2-0003'], name: 'Gaussian Blur' },
};

class Invalidatable {
  constructor() {
    this._valid = true;
  }
  _check() {
    if (!this._valid) throw new Error(`Object is invalid (${this.matchName})`);
  }
  _invalidate() {
    this._valid = false;
    if (this._children) for (const c of this._children) c._invalidate();
  }
}

export class Property extends Invalidatable {
  constructor(matchName, parent) {
    super();
    const spec = PROPS[matchName];
    if (!spec) throw new Error(`mock: no spec for property ${matchName}`);
    this.matchName = matchName;
    this.spec = spec;
    this._name = matchName;
    this.parentProperty = parent;
    this._value = Array.isArray(spec.def) ? spec.def.slice() : spec.def;
    this.setCount = 0;
  }
  get name() {
    this._check();
    return this._name;
  }
  get value() {
    this._check();
    return this._value;
  }
  setValue(v) {
    this._check();
    const { spec } = this;
    if (spec.dims === 'novalue') throw new Error("Can't set value: property has no value (gradient colours)");
    if (spec.dims === 'shape') {
      if (!(v instanceof globalThis.__AEShape)) throw new Error(`${this.matchName}: expected Shape`);
      const n = v.vertices.length;
      if (v.inTangents.length !== n || v.outTangents.length !== n) throw new Error('Shape arrays differ in length');
      for (const arr of [v.vertices, v.inTangents, v.outTangents]) for (const p of arr) checkNums(this.matchName, p, 2);
      // Arrays from the script realm have no ES5 methods; copy with this realm's helpers.
      const copy = (arr) => Array.from(arr, (p) => Array.from(p));
      this._value = { vertices: copy(v.vertices), inTangents: copy(v.inTangents), outTangents: copy(v.outTangents), closed: !!v.closed };
    } else {
      let dims = spec.dims;
      if (dims === '2or3') {
        if (!Array.isArray(v) || (v.length !== 2 && v.length !== 3)) throw new Error(`${this.matchName}: expected 2 or 3 values`);
        dims = v.length;
      }
      if (dims === 1) {
        checkNums(this.matchName, [v], 1);
      } else {
        if (spec.color && Array.isArray(v) && v.length === 4) v = v.slice(0, 3);
        checkNums(this.matchName, v, dims);
      }
      const vals = dims === 1 ? [v] : v;
      for (const x of vals) {
        if (spec.min !== undefined && x < spec.min - 1e-9) throw new Error(`${this.matchName}: ${x} below ${spec.min}`);
        if (spec.max !== undefined && x > spec.max + 1e-9) throw new Error(`${this.matchName}: ${x} above ${spec.max}`);
      }
      if (spec.oneOf && !spec.oneOf.includes(v)) throw new Error(`${this.matchName}: ${v} not in ${spec.oneOf}`);
      this._value = dims === 1 ? v : Array.from(v);
    }
    this.setCount++;
  }
}

function checkNums(name, arr, n) {
  if (!arr || arr.length !== n) throw new Error(`${name}: expected ${n} values, got ${JSON.stringify(arr)}`);
  for (const x of arr) if (typeof x !== 'number' || !isFinite(x)) throw new Error(`${name}: non-finite value ${x}`);
}

export class PropertyGroup extends Invalidatable {
  constructor(matchName, parent) {
    super();
    const spec = GROUPS[matchName];
    if (!spec) throw new Error(`mock: no spec for group ${matchName}`);
    this.matchName = matchName;
    this.spec = spec;
    this._name = spec.name;
    this.parentProperty = parent;
    this._children = [];
    if (spec.fixed) for (const mn of spec.fixed) this._children.push(make(mn, this));
  }
  get name() {
    this._check();
    return this._name;
  }
  set name(v) {
    this._check();
    this._name = String(v);
  }
  get numProperties() {
    this._check();
    return this._children.length;
  }
  property(id) {
    this._check();
    if (typeof id === 'number') return this._children[id - 1] || null;
    return this._children.find((c) => c.matchName === id || c._name === id) || null;
  }
  canAddProperty(mn) {
    return !!(this.spec.indexed && this.spec.accepts.includes(mn));
  }
  addProperty(mn) {
    this._check();
    if (!this.canAddProperty(mn)) throw new Error(`Can't add ${mn} to ${this.matchName}`);
    for (const c of this._children) c._invalidate(); // AE invalidates existing references
    const fresh = this._children.map((c) => revive(c, this));
    this._children = fresh;
    const p = make(mn, this);
    this._children.push(p);
    return p;
  }
  remove() {
    this._check();
    const parent = this.parentProperty;
    if (!parent || !parent.spec.indexed) throw new Error(`Can't remove ${this.matchName}`);
    parent._children = parent._children.filter((c) => c !== this);
    for (const c of parent._children) c._invalidate();
    parent._children = parent._children.map((c) => revive(c, parent));
    this._invalidate();
  }
}

// Re-creates a live copy of an invalidated object (same data, new identity), the way
// AE hands out new references after a structural change.
function revive(obj, parent) {
  const copy = Object.create(Object.getPrototypeOf(obj));
  Object.assign(copy, obj);
  copy._valid = true;
  copy.parentProperty = parent;
  if (obj._children) copy._children = obj._children.map((c) => revive(c, copy));
  return copy;
}

function make(mn, parent) {
  return GROUPS[mn] ? new PropertyGroup(mn, parent) : new Property(mn, parent);
}

// ---------------------------------------------------------------- text
export class TextDocument {
  constructor(text) {
    this.text = text;
    this.font = 'ArialMT';
    this.fontSize = 36;
    this.fillColor = [1, 1, 1];
    this.applyFill = true;
    this.applyStroke = false;
    this.tracking = 0;
    this.leading = 43.2;
    this.autoLeading = true;
    this.justification = 7413; // LEFT_JUSTIFY
    this.allCaps = false;
    this.smallCaps = false;
    this.boxText = false;
    this.pointText = true;
    this.boxTextSize = undefined;
    this.boxTextPos = undefined;
    this.ranges = [];
  }
  clone() {
    const c = new TextDocument(this.text);
    Object.assign(c, this);
    c.ranges = this.ranges.map((r) => ({ ...r, props: { ...r.props } }));
    if (this.boxTextSize) c.boxTextSize = this.boxTextSize.slice();
    if (this.boxTextPos) c.boxTextPos = this.boxTextPos.slice();
    return c;
  }
  characterRange(start, end) {
    if (!(start >= 0 && end <= this.text.length && end > start)) throw new Error(`characterRange(${start}, ${end}) out of bounds for length ${this.text.length}`);
    const rec = { start, end, props: {} };
    this.ranges.push(rec);
    const allowed = ['font', 'fontSize', 'fillColor', 'applyFill', 'tracking', 'leading', 'autoLeading', 'allCaps', 'smallCaps'];
    return new Proxy(
      {},
      {
        set(_, key, value) {
          if (!allowed.includes(key)) throw new Error(`CharacterRange has no property ${String(key)}`);
          if (key === 'tracking' && !Number.isInteger(value)) throw new Error(`Unable to set "tracking". ${value} is not an integer.`);
          rec.props[key] = value;
          return true;
        },
      },
    );
  }
}

class TextDocumentProperty extends Invalidatable {
  constructor(doc) {
    super();
    this.matchName = 'ADBE Text Document';
    this._doc = doc;
  }
  get value() {
    return this._doc.clone(); // AE hands out copies
  }
  setValue(doc) {
    if (!(doc instanceof TextDocument)) throw new Error('setValue expects a TextDocument');
    if (typeof doc.font !== 'string' || !doc.font) throw new Error('bad font');
    if (!(doc.fontSize > 0)) throw new Error('bad fontSize');
    checkNums('fillColor', doc.fillColor, 3);
    // Real AE throws: Unable to set "tracking". 99.9999982970102 is not an integer.
    if (!Number.isInteger(doc.tracking)) throw new Error(`Unable to set "tracking". ${doc.tracking} is not an integer.`);
    this._doc = doc.clone();
  }
}

// ---------------------------------------------------------------- layers
let layerUid = 1;
export class Layer {
  constructor(comp, kind, extra = {}) {
    this.uid = layerUid++;
    this.containingComp = comp;
    this.kind = kind;
    this.name = extra.name || kind;
    this.enabled = true;
    this.blendingMode = 'NORMAL';
    this.inPoint = 0;
    this.outPoint = comp.duration;
    this._parent = null;
    this.trackMatteLayer = null;
    this.trackMatteType = null;
    this.collapseTransformation = false;
    this.source = extra.source || null;
    this.nullLayer = kind === 'null';
    this._groups = {
      'ADBE Transform Group': new PropertyGroup('ADBE Transform Group', null),
      'ADBE Effect Parade': new PropertyGroup('ADBE Effect Parade', null),
    };
    if (kind === 'shape') this._groups['ADBE Root Vectors Group'] = new PropertyGroup('ADBE Root Vectors Group', null);
    if (kind === 'text') this._text = new TextDocumentProperty(extra.textDocument);
    if (extra.anchor) this.tp('ADBE Anchor Point').setValue(extra.anchor);
    this.tp('ADBE Position').setValue([comp.width / 2, comp.height / 2, 0]);
  }
  property(mn) {
    if (mn === 'ADBE Text Properties') {
      if (!this._text) return null;
      const t = this._text;
      return { property: (n) => (n === 'ADBE Text Document' || n === 'Source Text' ? t : null) };
    }
    const g = this._groups[mn];
    if (!g) throw new Error(`mock: layer ${this.kind} has no ${mn}`);
    return g;
  }
  tp(mn) {
    return this._groups['ADBE Transform Group'].property(mn);
  }
  get index() {
    return this.containingComp.layers._list.indexOf(this) + 1;
  }
  get parent() {
    return this._parent;
  }
  set parent(p) {
    if (p && p.containingComp !== this.containingComp) throw new Error('parent must be in the same comp');
    const world = this.worldMatrix();
    this._parent = p;
    // Keep world transform: local = inverse(parentWorld) * world.
    const local = p ? mul(inv(p.worldMatrix()), world) : world;
    const a = this.tp('ADBE Anchor Point').value;
    const pos = apply(local, a[0], a[1]);
    const sx = Math.hypot(local[0][0], local[1][0]);
    const rot = (Math.atan2(local[1][0], local[0][0]) * 180) / Math.PI;
    const sy = (local[0][0] * local[1][1] - local[0][1] * local[1][0]) / sx;
    this.tp('ADBE Position').setValue([pos[0], pos[1], 0]);
    this.tp('ADBE Rotate Z').setValue(rot);
    this.tp('ADBE Scale').setValue([sx * 100, sy * 100, 100]);
  }
  setTrackMatte(layer, type) {
    if (!layer || layer.containingComp !== this.containingComp) throw new Error('matte layer must be in the same comp');
    if (layer === this) throw new Error('layer cannot be its own matte');
    this.trackMatteLayer = layer;
    this.trackMatteType = type;
  }
  localMatrix() {
    const a = this.tp('ADBE Anchor Point').value;
    const p = this.tp('ADBE Position').value;
    const s = this.tp('ADBE Scale').value;
    const r = (this.tp('ADBE Rotate Z').value * Math.PI) / 180;
    const c = Math.cos(r);
    const n = Math.sin(r);
    const sx = s[0] / 100;
    const sy = s[1] / 100;
    // T(p) * R(r) * S(s) * T(-a); AE rotation is clockwise on screen (y down).
    const L = [
      [c * sx, -n * sy],
      [n * sx, c * sy],
    ];
    return [
      [L[0][0], L[0][1], p[0] - (L[0][0] * a[0] + L[0][1] * a[1])],
      [L[1][0], L[1][1], p[1] - (L[1][0] * a[0] + L[1][1] * a[1])],
    ];
  }
  worldMatrix() {
    const local = this.localMatrix();
    return this._parent ? mul(this._parent.worldMatrix(), local) : local;
  }
  get transform() {
    const t = this._groups['ADBE Transform Group'];
    return {
      anchorPoint: t.property('ADBE Anchor Point'),
      position: t.property('ADBE Position'),
      scale: t.property('ADBE Scale'),
      rotation: t.property('ADBE Rotate Z'),
      opacity: t.property('ADBE Opacity'),
    };
  }
}

class LayerCollection {
  constructor(comp) {
    this.comp = comp;
    this._list = [];
  }
  get length() {
    return this._list.length;
  }
  _add(layer) {
    this._list.unshift(layer); // new layers go on top (index 1)
    return layer;
  }
  addShape() {
    return this._add(new Layer(this.comp, 'shape', { name: 'Shape Layer', anchor: [0, 0] }));
  }
  addNull(duration) {
    return this._add(new Layer(this.comp, 'null', { name: 'Null', anchor: [50, 50] }));
  }
  addText(text) {
    const doc = new TextDocument(String(text));
    return this._add(new Layer(this.comp, 'text', { name: String(text), textDocument: doc, anchor: [0, 0] }));
  }
  addBoxText(size, text) {
    checkNums('addBoxText size', size, 2);
    const doc = new TextDocument(String(text));
    doc.boxText = true;
    doc.pointText = false;
    doc.boxTextSize = size.slice();
    doc.boxTextPos = [-size[0] / 2, -size[1] / 2];
    return this._add(new Layer(this.comp, 'text', { name: String(text), textDocument: doc, anchor: [0, 0] }));
  }
  add(item) {
    if (!(item instanceof CompItem) && !(item instanceof FootageItem)) throw new Error('layers.add expects an AVItem');
    if (item === this.comp) throw new Error('cannot add a comp to itself');
    return this._add(new Layer(this.comp, item instanceof CompItem ? 'precomp' : 'footage', { name: item.name, source: item, anchor: [item.width / 2, item.height / 2] }));
  }
  /** 1-based like AE */
  get all() {
    return this._list.slice();
  }
}

export class Item {
  constructor(name) {
    this.name = name;
    this.parentFolder = null;
  }
}
export class FolderItem extends Item {}
export class CompItem extends Item {
  constructor(name, width, height, pixelAspect, duration, frameRate) {
    super(name);
    for (const [k, v] of Object.entries({ width, height })) {
      if (!Number.isInteger(v) || v < 4 || v > 30000) throw new Error(`addComp: ${k} ${v} must be an integer in 4..30000`);
    }
    if (!(duration > 0) || !(frameRate > 0) || pixelAspect !== 1) throw new Error('addComp: bad duration/frameRate/pixelAspect');
    Object.assign(this, { width, height, pixelAspect, duration, frameRate });
    this.layers = new LayerCollection(this);
    this.opened = false;
  }
  openInViewer() {
    this.opened = true;
  }
}
export class FootageItem extends Item {
  constructor(file) {
    super(file.name);
    const { width, height } = pngSize(readFileSync(file.fsName));
    this.width = width;
    this.height = height;
    this.file = file;
  }
}

// ---------------------------------------------------------------- environment
// clipboard: text the simulated Windows clipboard holds (null = empty).
// documentsDir/tempDir: real folders standing in for Folder.myDocuments / Folder.temp.
export function createAEEnvironment({ prefsAllowWrite = true, fonts, clipboard = null, documentsDir, tempDir, projectFile = null } = {}) {
  const docs = documentsDir || mkdtempSync(tmpdir() + '/ae-docs-');
  const temp = tempDir || mkdtempSync(tmpdir() + '/ae-temp-');
  const items = [];
  const log = { alerts: [], writeln: [], undo: [], commands: [] };
  const installedFonts = fonts || [
    { familyName: 'Inter', styleName: 'Regular', postScriptName: 'Inter-Regular' },
    { familyName: 'Inter', styleName: 'Bold', postScriptName: 'Inter-Bold' },
    { familyName: 'Inter', styleName: 'SemiBold', postScriptName: 'Inter-SemiBold' },
    { familyName: 'Arial', styleName: 'Regular', postScriptName: 'ArialMT' },
  ];

  class Shape {
    constructor() {
      this.vertices = [];
      this.inTangents = [];
      this.outTangents = [];
      this.closed = true;
    }
  }
  globalThis.__AEShape = Shape;

  class File {
    constructor(path) {
      this.fsName = String(path).replace(/\\/g, '/');
      this.name = this.fsName.replace(/^.*\//, '');
      this.encoding = 'BINARY';
      this._mode = null;
      this._buf = '';
    }
    get exists() {
      return existsSync(this.fsName);
    }
    open(mode) {
      this._mode = mode;
      if (mode === 'r') {
        if (!this.exists) return false;
        this._buf = readFileSync(this.fsName, 'utf8');
      } else {
        this._buf = '';
      }
      return true;
    }
    read() {
      return this._buf;
    }
    write(s) {
      this._buf += s;
      return true;
    }
    close() {
      if (this._mode === 'w') {
        // BINARY: each char code is one byte, as in ExtendScript.
        if (this.encoding === 'BINARY') {
          for (let i = 0; i < this._buf.length; i++) if (this._buf.charCodeAt(i) > 255) throw new Error('BINARY write with char > 255');
          writeFileSync(this.fsName, Buffer.from(this._buf, 'latin1'));
        } else {
          writeFileSync(this.fsName, this._buf);
        }
      }
      this._mode = null;
      return true;
    }
    remove() {
      rmSync(this.fsName, { force: true });
      return true;
    }
    get parent() {
      return new Folder(pathDirname(this.fsName));
    }
  }
  class Folder {
    constructor(path) {
      this.fsName = String(path).replace(/\\/g, '/');
    }
    get exists() {
      return existsSync(this.fsName);
    }
    create() {
      mkdirSync(this.fsName, { recursive: true });
      return true;
    }
    static get temp() {
      return new Folder(temp);
    }
    static get myDocuments() {
      return new Folder(docs);
    }
  }

  // Simulates PowerShell "Get-Clipboard -Raw | Set-Content -LiteralPath '<file>' -Encoding ASCII -NoNewline".
  const system = {
    callSystem(cmd) {
      log.commands.push(cmd);
      const m = /^powershell\.exe .*-Command "Get-Clipboard -Raw \| Set-Content -LiteralPath '((?:[^']|'')+)' -Encoding ASCII -NoNewline"$/.exec(cmd);
      if (!m) throw new Error('mock: unexpected command ' + cmd);
      if (!prefsAllowWrite) throw new Error('callSystem blocked: scripting file/network access is off');
      const text = state.clipboard == null ? '' : state.clipboard;
      if (/[^\x00-\x7f]/.test(text)) throw new Error('mock: non-ASCII clipboard would be mangled by -Encoding ASCII');
      writeFileSync(m[1].replace(/''/g, "'"), text, 'ascii');
      return '';
    },
  };
  const state = { clipboard };

  const app = {
    project: {
      items: {
        addComp(name, w, h, pa, dur, fps) {
          const c = new CompItem(name, w, h, pa, dur, fps);
          items.push(c);
          return c;
        },
        addFolder(name) {
          const f = new FolderItem(name);
          items.push(f);
          return f;
        },
      },
      importFile(opts) {
        if (!opts || !opts.file || !opts.file.exists) throw new Error('importFile: file missing');
        const f = new FootageItem(opts.file);
        items.push(f);
        return f;
      },
    },
    fonts: {
      getFontsByFamilyNameAndStyleName(family, style) {
        return installedFonts.filter((f) => f.familyName === family && f.styleName === style).map((f) => ({ ...f, isSubstitute: false }));
      },
      get allFonts() {
        const byFamily = {};
        for (const f of installedFonts) (byFamily[f.familyName] = byFamily[f.familyName] || []).push({ ...f, isSubstitute: false });
        return Object.values(byFamily);
      },
    },
    preferences: {
      getPrefAsLong(section, key) {
        if (section === 'Main Pref Section' && key === 'Pref_SCRIPTING_FILE_NETWORK_SECURITY') return prefsAllowWrite ? 1 : 0;
        throw new Error('unknown pref');
      },
    },
    beginUndoGroup(name) {
      log.undo.push(['begin', name]);
    },
    endUndoGroup() {
      log.undo.push(['end']);
    },
  };

  app.project.file = projectFile;
  const globals = {
    app,
    system,
    Shape,
    File,
    Folder,
    ImportOptions: class {
      constructor(file) {
        this.file = file;
      }
    },
    BlendingMode: Object.fromEntries(
      ['NORMAL', 'MULTIPLY', 'SCREEN', 'OVERLAY', 'DARKEN', 'LIGHTEN', 'COLOR_DODGE', 'COLOR_BURN', 'HARD_LIGHT', 'SOFT_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY', 'LINEAR_BURN', 'LINEAR_DODGE'].map((k) => [k, k]),
    ),
    ParagraphJustification: { LEFT_JUSTIFY: 'LEFT_JUSTIFY', CENTER_JUSTIFY: 'CENTER_JUSTIFY', RIGHT_JUSTIFY: 'RIGHT_JUSTIFY', FULL_JUSTIFY_LASTLINE_LEFT: 'FULL_JUSTIFY_LASTLINE_LEFT' },
    TrackMatteType: { ALPHA: 'ALPHA', LUMA: 'LUMA', NO_TRACK_MATTE: 'NO_TRACK_MATTE' },
    Panel: function Panel() {},
    Window: function Window() {},
    alert(msg) {
      log.alerts.push(String(msg));
    },
  };
  return { globals, items, log, state, docs, temp, comps: () => items.filter((i) => i instanceof CompItem) };
}
