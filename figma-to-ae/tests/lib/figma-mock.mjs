// A small mock of the Figma plugin API, faithful in the parts the exporter reads:
// - relativeTransform of a node inside a GROUP / BOOLEAN_OPERATION is relative to the
//   nearest non-group ancestor (as in Figma); groups take their box from their children.
// - figma.mixed is a unique symbol; mixed corner radii expose per-corner fields.
// - exportAsync renders a PNG sized to the node's bounds * scale.
// It also defines the reference test scene used to generate sample/scene.json.
import { encodePng } from './png.mjs';

const MIXED = Symbol('figma.mixed');
const GROUPISH = ['GROUP', 'BOOLEAN_OPERATION'];
let nextId = 1;

function mul(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1], A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1], A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2]],
  ];
}
function apply(M, x, y) {
  return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
}
function figmaTransform(x, y, rotationDeg) {
  const r = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [c, s, x],
    [-s, c, y],
  ];
}

export function hex(h, a = 1) {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a };
}
export function solid(h, opacity = 1) {
  const { r, g, b } = hex(h);
  return { type: 'SOLID', visible: true, opacity, blendMode: 'NORMAL', color: { r, g, b } };
}

class MockNode {
  constructor(type, props = {}, children = []) {
    this.id = props.id || `${nextId++}:${nextId}`;
    this.type = type;
    this.name = props.name || type;
    this.visible = props.visible !== false;
    this.parent = null;
    this.removed = false;
    this._x = props.x || 0;
    this._y = props.y || 0;
    this._rotation = props.rotation || 0;
    this._w = props.width || 0;
    this._h = props.height || 0;
    this.opacity = props.opacity === undefined ? 1 : props.opacity;
    this.blendMode = props.blendMode || (type === 'GROUP' ? 'PASS_THROUGH' : 'NORMAL');
    this.isMask = !!props.isMask;
    this.maskType = props.maskType || 'ALPHA';
    this.effects = props.effects || [];
    if (type !== 'GROUP' && type !== 'SLICE') {
      this.fills = props.fills || [];
      this.strokes = props.strokes || [];
      this.strokeWeight = props.strokeWeight === undefined ? 1 : props.strokeWeight;
      this.strokeAlign = props.strokeAlign || 'INSIDE';
      this.strokeCap = props.strokeCap || 'NONE';
      this.strokeJoin = props.strokeJoin || 'MITER';
      this.dashPattern = props.dashPattern || [];
    }
    if (['RECTANGLE', 'FRAME', 'INSTANCE', 'COMPONENT'].includes(type)) {
      const radii = props.radii || [props.cornerRadius || 0, props.cornerRadius || 0, props.cornerRadius || 0, props.cornerRadius || 0];
      [this.topLeftRadius, this.topRightRadius, this.bottomRightRadius, this.bottomLeftRadius] = radii;
      this.cornerRadius = radii.every((r) => r === radii[0]) ? radii[0] : MIXED;
    } else if (['POLYGON', 'STAR', 'VECTOR', 'ELLIPSE'].includes(type)) {
      this.cornerRadius = props.cornerRadius || 0;
    }
    if (['FRAME', 'INSTANCE', 'COMPONENT'].includes(type)) this.clipsContent = props.clipsContent !== false;
    if (type === 'POLYGON' || type === 'STAR') this.pointCount = props.pointCount || 3;
    if (type === 'STAR') this.innerRadius = props.innerRadius === undefined ? 0.382 : props.innerRadius;
    if (type === 'ELLIPSE') this.arcData = props.arcData || { startingAngle: 0, endingAngle: 2 * Math.PI, innerRadius: 0 };
    if (type === 'VECTOR') this.vectorPaths = props.vectorPaths || [];
    if (props.fillGeometry) this._fillGeometry = props.fillGeometry;
    if (type === 'TEXT') Object.assign(this, props.text);
    if ('children' in props || children.length || GROUPISH.includes(type) || ['FRAME', 'INSTANCE', 'COMPONENT'].includes(type)) {
      this.children = [];
      for (const c of children) this.appendChild(c);
    }
  }

  appendChild(child) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = this;
    this.children.push(child);
  }

  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
    this.removed = true;
  }

  get container() {
    let p = this.parent;
    while (p && GROUPISH.includes(p.type)) p = p.parent;
    return p;
  }

  // Groups/boolean ops: box = bounds of children in the container's space.
  get _groupBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of this.children) {
      const M = c.relativeTransform;
      for (const [x, y] of [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]]) {
        const [px, py] = apply(M, x, y);
        minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  get relativeTransform() {
    if (GROUPISH.includes(this.type)) {
      const b = this._groupBox;
      return figmaTransform(b.x, b.y, 0);
    }
    return figmaTransform(this._x, this._y, this._rotation);
  }
  set relativeTransform(m) {
    this._x = m[0][2];
    this._y = m[1][2];
    this._rotation = (Math.atan2(-m[1][0], m[0][0]) * 180) / Math.PI;
  }
  get x() { return this.relativeTransform[0][2]; }
  get y() { return this.relativeTransform[1][2]; }
  get rotation() { return GROUPISH.includes(this.type) ? 0 : this._rotation; }
  get width() { return GROUPISH.includes(this.type) ? this._groupBox.w : this._w; }
  get height() { return GROUPISH.includes(this.type) ? this._groupBox.h : this._h; }

  get absoluteTransform() {
    const c = this.container;
    if (!c || c.type === 'PAGE') return this.relativeTransform;
    return mul(c.absoluteTransform, this.relativeTransform);
  }

  get absoluteBoundingBox() {
    const M = this.absoluteTransform;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]]) {
      const [px, py] = apply(M, x, y);
      minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  get fillGeometry() {
    if (this._fillGeometry) return this._fillGeometry;
    if (this.type === 'VECTOR') return this.vectorPaths;
    return [];
  }

  getStyledTextSegments(fields) {
    if (this.type !== 'TEXT') throw new Error('not text');
    return this.segments.map((s) => {
      const out = { characters: this.characters.slice(s.start, s.end), start: s.start, end: s.end };
      for (const f of fields) out[f] = s[f];
      return out;
    });
  }

  clone() {
    if (this._cloneFails) throw new Error('cannot clone node inside instance');
    const copy = Object.create(MockNode.prototype);
    for (const k of Object.keys(this)) copy[k] = this[k];
    copy.id = `${nextId++}:clone`;
    copy.parent = null;
    copy.removed = false;
    if (this.children) {
      copy.children = [];
      for (const c of this.children) copy.appendChild(c.clone());
    }
    if (this.parent) this.parent.appendChild(copy);
    return copy;
  }

  async exportAsync(settings) {
    if (settings.format !== 'PNG') throw new Error('mock only exports PNG');
    const scale = settings.constraint && settings.constraint.type === 'SCALE' ? settings.constraint.value : 1;
    const bb = this.absoluteBoundingBox;
    const w = Math.max(1, Math.round(bb.width * scale));
    const h = Math.max(1, Math.round(bb.height * scale));
    // A recognisable test image: diagonal stripes in two colours.
    return encodePng(w, h, (x, y) => (((x + y) >> 4) & 1 ? [40, 120, 220, 255] : [250, 200, 60, 255]));
  }
}

function node(type, props, children) {
  return new MockNode(type, props, children);
}

// Circle as cubic beziers in SVG path syntax, the way Figma writes fillGeometry.
function circlePath(cx, cy, r) {
  const k = 0.5522847498 * r;
  const f = (n) => Number(n.toFixed(4));
  return [
    `M ${f(cx + r)} ${f(cy)}`,
    `C ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`,
    `C ${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}`,
    `C ${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}`,
    `C ${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}`,
    'Z',
  ].join(' ');
}

function textProps({ characters, segments, align = 'LEFT', autoResize = 'WIDTH_AND_HEIGHT', valign = 'TOP' }) {
  const segs = segments.map((s) => ({
    start: s.start,
    end: s.end,
    fontName: s.fontName,
    fontSize: s.fontSize,
    fills: s.fills,
    letterSpacing: s.letterSpacing || { unit: 'PIXELS', value: 0 },
    lineHeight: s.lineHeight || { unit: 'AUTO' },
    textDecoration: s.textDecoration || 'NONE',
    textCase: s.textCase || 'ORIGINAL',
  }));
  const uniform = (k) => segs.every((s) => JSON.stringify(s[k]) === JSON.stringify(segs[0][k]));
  return {
    characters,
    segments: segs,
    fontName: uniform('fontName') ? segs[0].fontName : MIXED,
    fontSize: uniform('fontSize') ? segs[0].fontSize : MIXED,
    textAlignHorizontal: align,
    textAlignVertical: valign,
    textAutoResize: autoResize,
    paragraphSpacing: 0,
  };
}

/** Builds the reference test frame described in TESTING.md. */
export function buildTestScene() {
  nextId = 1;
  const page = node('PAGE', { name: 'Page 1', children: true });
  page.selection = [];

  const shadow = (x, y, radius, a, spread = 0) => ({
    type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a }, offset: { x, y }, radius, spread, blendMode: 'NORMAL', showShadowBehindNode: false,
  });

  const hero = node('FRAME', { name: 'Hero', x: 1000, y: 500, width: 800, height: 600, fills: [solid('#FFFFFF')], clipsContent: true }, [
    node('RECTANGLE', { name: 'Background Card', x: 40, y: 40, width: 720, height: 520, cornerRadius: 24, fills: [solid('#F4F6FB')], effects: [shadow(0, 8, 24, 0.15)] }),

    // Nested 3 levels deep: GROUP > FRAME (rotated) > GROUP > shapes
    node('GROUP', { name: 'Level 1' }, [
      node('FRAME', { name: 'Level 2', x: 80, y: 80, width: 220, height: 160, rotation: 15, fills: [solid('#DCE8FF')], clipsContent: false }, [
        node('GROUP', { name: 'Level 3' }, [
          node('RECTANGLE', { name: 'Deep Rect', x: 20, y: 30, width: 80, height: 50, fills: [solid('#E5484D')] }),
          node('ELLIPSE', { name: 'Deep Ellipse', x: 120, y: 40, width: 60, height: 60, fills: [solid('#30A46C')] }),
        ]),
      ]),
    ]),

    // A group with 5 circles -> must become 5 separate shape layers
    node('GROUP', { name: 'Circles' }, ['#E5484D', '#F76B15', '#FFC53D', '#30A46C', '#0090FF'].map((c, i) =>
      node('ELLIPSE', { name: `Circle ${i + 1}`, x: 360 + i * 48, y: 70, width: 40, height: 40, fills: [solid(c)] }),
    )),

    node('RECTANGLE', { name: 'Rotated Rect', x: 420, y: 160, width: 120, height: 80, rotation: 30, opacity: 0.5, blendMode: 'MULTIPLY', fills: [solid('#F76B15')] }),

    // Strokes
    node('RECTANGLE', { name: 'Stroke Inside', x: 80, y: 320, width: 100, height: 70, fills: [solid('#FFFFFF')], strokes: [solid('#0090FF')], strokeWeight: 4, strokeAlign: 'INSIDE' }),
    node('ELLIPSE', { name: 'Stroke Outside', x: 200, y: 320, width: 80, height: 80, fills: [solid('#FFC53D')], strokes: [solid('#111111')], strokeWeight: 6, strokeAlign: 'OUTSIDE' }),
    node('LINE', { name: 'Center Line', x: 300, y: 380, width: 120, height: 0, rotation: 20, strokes: [solid('#8E4EC6')], strokeWeight: 3, strokeAlign: 'CENTER', strokeCap: 'ROUND' }),

    // Rounded rects
    node('RECTANGLE', { name: 'Rounded Rect', x: 440, y: 320, width: 120, height: 70, cornerRadius: 16, fills: [solid('#8E4EC6')] }),
    node('RECTANGLE', { name: 'Mixed Corners', x: 580, y: 320, width: 120, height: 70, radii: [24, 0, 24, 0], fills: [solid('#12A594')], strokes: [solid('#0B5D54')], strokeWeight: 2, strokeAlign: 'INSIDE' }),

    // Polystars
    node('STAR', { name: 'Star', x: 600, y: 60, width: 80, height: 80, pointCount: 5, innerRadius: 0.4, fills: [solid('#FFC53D')] }),
    node('POLYGON', { name: 'Triangle', x: 690, y: 70, width: 60, height: 60, pointCount: 3, fills: [solid('#0090FF')] }),

    // Vector path (M, C, Q, L, Z) + a boolean operation (even-odd ring)
    node('VECTOR', {
      name: 'Wave', x: 80, y: 420, width: 200, height: 60,
      vectorPaths: [{ windingRule: 'NONZERO', data: 'M 0 30 C 33.3333 0 66.6667 0 100 30 Q 150 60 200 30 L 200 60 L 0 60 L 0 30 Z' }],
      fills: [solid('#0090FF', 0.8)], strokes: [solid('#003D7A')], strokeWeight: 2, strokeAlign: 'CENTER',
    }),
    node('BOOLEAN_OPERATION', {
      name: 'Ring',
      fills: [solid('#E5484D')],
      fillGeometry: [{ windingRule: 'EVENODD', data: `${circlePath(40, 40, 40)} ${circlePath(40, 40, 20)}` }],
    }, [
      node('ELLIPSE', { name: 'Ring Outer', x: 300, y: 420, width: 80, height: 80, fills: [solid('#E5484D')] }),
      node('ELLIPSE', { name: 'Ring Inner', x: 320, y: 440, width: 40, height: 40, fills: [solid('#E5484D')] }),
    ]),

    node('RECTANGLE', {
      name: 'Gradient Rect', x: 400, y: 420, width: 120, height: 60,
      fills: [{
        type: 'GRADIENT_LINEAR', visible: true, opacity: 1, blendMode: 'NORMAL',
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: [{ position: 0, color: hex('#00C6FF') }, { position: 1, color: hex('#0072FF') }],
      }],
    }),
    node('ELLIPSE', { name: 'Blurred Ellipse', x: 540, y: 420, width: 60, height: 60, fills: [solid('#30A46C')], effects: [{ type: 'LAYER_BLUR', visible: true, radius: 8 }] }),

    // Text: single style (auto width) and mixed style (fixed width)
    node('TEXT', {
      name: 'Title', x: 240, y: 10, width: 320, height: 39,
      fills: [solid('#111111')],
      text: textProps({
        characters: 'Hello After Effects', align: 'CENTER',
        segments: [{ start: 0, end: 19, fontName: { family: 'Inter', style: 'Bold' }, fontSize: 32, fills: [solid('#111111')] }],
      }),
    }),
    node('TEXT', {
      name: 'Body', x: 420, y: 500, width: 260, height: 48,
      fills: MIXED,
      text: textProps({
        characters: 'Mixed style text: bold and red.', autoResize: 'HEIGHT',
        segments: [
          { start: 0, end: 18, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fills: [solid('#333333')], lineHeight: { unit: 'PIXELS', value: 24 }, letterSpacing: { unit: 'PERCENT', value: 2 } },
          { start: 18, end: 22, fontName: { family: 'Inter', style: 'Bold' }, fontSize: 16, fills: [solid('#333333')], lineHeight: { unit: 'PIXELS', value: 24 }, letterSpacing: { unit: 'PERCENT', value: 2 } },
          { start: 22, end: 27, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fills: [solid('#333333')], lineHeight: { unit: 'PIXELS', value: 24 }, letterSpacing: { unit: 'PERCENT', value: 2 } },
          { start: 27, end: 30, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fills: [solid('#E5484D')], lineHeight: { unit: 'PIXELS', value: 24 }, letterSpacing: { unit: 'PERCENT', value: 2 } },
          { start: 30, end: 31, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fills: [solid('#333333')], lineHeight: { unit: 'PIXELS', value: 24 }, letterSpacing: { unit: 'PERCENT', value: 2 } },
        ],
      }),
    }),
    node('TEXT', {
      name: 'Missing Font Text', x: 80, y: 540, width: 150, height: 17,
      fills: [solid('#111111')],
      text: textProps({
        characters: 'Font fallback test',
        segments: [{ start: 0, end: 18, fontName: { family: 'Comic Neue', style: 'Regular' }, fontSize: 14, fills: [solid('#111111')], letterSpacing: { unit: 'PIXELS', value: 1.4 } }],
      }),
    }),

    // Image fill, rotated, rounded, with drop shadow and outside stroke
    node('RECTANGLE', {
      name: 'Photo', x: 620, y: 410, width: 120, height: 90, rotation: 8, cornerRadius: 12,
      fills: [{ type: 'IMAGE', visible: true, opacity: 1, blendMode: 'NORMAL', scaleMode: 'FILL', imageHash: 'a1b2c3' }],
      strokes: [solid('#FFFFFF')], strokeWeight: 2, strokeAlign: 'OUTSIDE',
      effects: [shadow(4, 4, 10, 0.25)],
    }),

    // Mask: the ellipse clips the rectangle above it
    node('GROUP', { name: 'Masked Group' }, [
      node('ELLIPSE', { name: 'Mask Circle', x: 700, y: 180, width: 60, height: 60, isMask: true, fills: [solid('#000000')] }),
      node('RECTANGLE', { name: 'Masked Rect', x: 690, y: 170, width: 50, height: 80, fills: [solid('#E5484D')] }),
    ]),

    node('RECTANGLE', { name: 'Hidden Rect', x: 10, y: 10, width: 20, height: 20, visible: false, fills: [solid('#000000')] }),

    // Component instance with its own background, radius and shadow
    node('INSTANCE', { name: 'Button', x: 580, y: 250, width: 140, height: 44, cornerRadius: 22, fills: [solid('#0090FF')], effects: [shadow(0, 2, 6, 0.3)] }, [
      node('TEXT', {
        name: 'Label', x: 34, y: 12, width: 72, height: 19,
        fills: [solid('#FFFFFF')],
        text: textProps({
          characters: 'Get started', align: 'CENTER',
          segments: [{ start: 0, end: 11, fontName: { family: 'Inter', style: 'Semi Bold' }, fontSize: 16, fills: [solid('#FFFFFF')] }],
        }),
      }),
    ]),

    node('SLICE', { name: 'Export Slice', x: 0, y: 0, width: 100, height: 100 }),
  ]);

  page.appendChild(hero);
  page.selection = [hero];

  const figma = {
    mixed: MIXED,
    root: { name: 'Figma to AE test file' },
    currentPage: page,
  };
  return { figma, root: hero, page };
}
