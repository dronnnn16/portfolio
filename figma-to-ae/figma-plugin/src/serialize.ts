// Walks a Figma node tree and turns it into the scene.json structure (see types.ts).
// Runs in the Figma plugin sandbox; only depends on the global `figma` object.

import type {
  EffectRecord,
  ExportedImage,
  Matrix,
  NodeKind,
  NodeRecord,
  PaintRecord,
  RGBA,
  SceneFile,
  TextRecord,
  TextSegmentRecord,
  VectorPathRecord,
} from './types';

export interface SerializeOptions {
  imageScale?: number;
  onProgress?: (message: string) => void;
}

export interface SerializeResult {
  scene: SceneFile;
  images: ExportedImage[];
}

const FRAME_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'];
const GROUP_TYPES = ['GROUP', 'TRANSFORM_GROUP'];

function isMixed(value: unknown): boolean {
  return value === figma.mixed;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function round(value: number, digits = 4): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function identity(): Matrix {
  return [
    [1, 0, 0],
    [0, 1, 0],
  ];
}

function copyMatrix(m: Transform | undefined | null): Matrix {
  if (!m) return identity();
  return [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
  ];
}

function invert(m: Matrix): Matrix {
  const [[a, c, e], [b, d, f]] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return identity();
  return [
    [d / det, -c / det, (c * f - d * e) / det],
    [-b / det, a / det, (b * e - a * f) / det],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [round(m[0][0] * x + m[0][1] * y + m[0][2], 6), round(m[1][0] * x + m[1][1] * y + m[1][2], 6)];
}

function rgba(color: { r: number; g: number; b: number; a?: number }): RGBA {
  return { r: round(color.r), g: round(color.g), b: round(color.b), a: round(color.a === undefined ? 1 : color.a) };
}

export function serializePaint(paint: Paint): PaintRecord {
  const rec: PaintRecord = {
    type: paint.type,
    visible: paint.visible !== false,
    opacity: num(paint.opacity, 1),
    blendMode: paint.blendMode || 'NORMAL',
  };
  if (paint.type === 'SOLID') {
    rec.color = rgba(paint.color);
  } else if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    rec.gradientStops = paint.gradientStops.map((s) => ({ position: round(s.position), color: rgba(s.color) }));
    rec.gradientTransform = copyMatrix(paint.gradientTransform);
    rec.color = rec.gradientStops.length ? rec.gradientStops[0].color : { r: 0, g: 0, b: 0, a: 1 };
    // gradientTransform maps the node's normalised box onto gradient space, where a
    // linear gradient runs from (0, 0.5) to (1, 0.5). Invert it to get the handles.
    const inv = invert(rec.gradientTransform);
    if (paint.type === 'GRADIENT_LINEAR') {
      rec.gradientHandles = { start: apply(inv, 0, 0.5), end: apply(inv, 1, 0.5) };
    } else {
      rec.gradientHandles = { start: apply(inv, 0.5, 0.5), end: apply(inv, 1, 0.5) };
    }
  } else if (paint.type === 'IMAGE') {
    rec.scaleMode = paint.scaleMode;
    rec.imageHash = paint.imageHash;
  }
  return rec;
}

function serializePaints(paints: ReadonlyArray<Paint> | PluginAPI['mixed'] | undefined): PaintRecord[] {
  if (!paints || isMixed(paints)) return [];
  return (paints as ReadonlyArray<Paint>).map(serializePaint);
}

export function serializeEffect(effect: Effect): EffectRecord {
  const rec: EffectRecord = {
    type: effect.type,
    visible: effect.visible !== false,
    radius: num((effect as { radius?: number }).radius),
  };
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    rec.color = rgba(effect.color);
    rec.offset = { x: effect.offset.x, y: effect.offset.y };
    rec.spread = num(effect.spread);
    rec.blendMode = effect.blendMode;
  }
  return rec;
}

function kindOf(node: SceneNode): NodeKind {
  const t = node.type;
  if (FRAME_TYPES.indexOf(t) >= 0) return 'frame';
  if (GROUP_TYPES.indexOf(t) >= 0) return 'group';
  switch (t) {
    case 'RECTANGLE':
      return 'rect';
    case 'ELLIPSE':
      return 'ellipse';
    case 'LINE':
      return 'line';
    case 'POLYGON':
    case 'STAR':
      return 'polystar';
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      return 'vector';
    case 'TEXT':
      return 'text';
    default:
      return 'unsupported';
  }
}

function pathsFrom(paths: ReadonlyArray<VectorPath> | undefined): VectorPathRecord[] {
  if (!paths) return [];
  return paths.map((p) => ({ windingRule: p.windingRule, data: p.data }));
}

function hasVisibleImageFill(node: SceneNode): boolean {
  if (!('fills' in node) || isMixed(node.fills)) return false;
  return (node.fills as ReadonlyArray<Paint>).some((p) => p.type === 'IMAGE' && p.visible !== false);
}

function lineHeightRecord(lh: LineHeight): { unit: string; value?: number } {
  return lh.unit === 'AUTO' ? { unit: 'AUTO' } : { unit: lh.unit, value: lh.value };
}

function firstFillColor(fills: PaintRecord[]): RGBA | null {
  for (const f of fills) {
    if (!f.visible) continue;
    if (f.color) return { r: f.color.r, g: f.color.g, b: f.color.b, a: round(f.color.a * f.opacity) };
  }
  return null;
}

function serializeText(node: TextNode): TextRecord {
  const raw = node.getStyledTextSegments([
    'fontName',
    'fontSize',
    'fills',
    'letterSpacing',
    'lineHeight',
    'textDecoration',
    'textCase',
  ]);
  const segments: TextSegmentRecord[] = raw.map((s) => ({
    characters: s.characters,
    start: s.start,
    end: s.end,
    fontName: { family: s.fontName.family, style: s.fontName.style },
    fontSize: s.fontSize,
    letterSpacing: { unit: s.letterSpacing.unit, value: s.letterSpacing.value },
    lineHeight: lineHeightRecord(s.lineHeight),
    fills: serializePaints(s.fills),
    textDecoration: s.textDecoration,
    textCase: s.textCase,
  }));
  const base = segments[0];
  const fallbackFont = { family: 'Arial', style: 'Regular' };
  return {
    characters: node.characters,
    fontName: base ? base.fontName : isMixed(node.fontName) ? fallbackFont : (node.fontName as FontName),
    fontSize: base ? base.fontSize : num(node.fontSize, 12),
    letterSpacing: base ? base.letterSpacing : { unit: 'PIXELS', value: 0 },
    lineHeight: base ? base.lineHeight : { unit: 'AUTO' },
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    textAutoResize: node.textAutoResize,
    textCase: base ? base.textCase : 'ORIGINAL',
    textDecoration: base ? base.textDecoration : 'NONE',
    paragraphSpacing: num(node.paragraphSpacing),
    fill: base ? firstFillColor(base.fills) : null,
    mixed: segments.length > 1,
    segments,
  };
}

class Serializer {
  private images: ExportedImage[] = [];
  private nodeCount = 0;
  private byKind: { [kind: string]: number } = {};

  constructor(private readonly options: SerializeOptions) {}

  async run(root: SceneNode): Promise<SerializeResult> {
    const record = await this.visit(root, null, 0);
    const scene: SceneFile = {
      format: 'figma-to-ae',
      version: 1,
      exportedAt: new Date().toISOString(),
      figmaFile: figma.root ? figma.root.name : '',
      frame: { id: root.id, name: root.name, width: record.width, height: record.height },
      stats: { nodes: this.nodeCount, images: this.images.length, byKind: this.byKind },
      root: record,
    };
    return { scene, images: this.images };
  }

  private async visit(node: SceneNode, parentId: string | null, index: number): Promise<NodeRecord> {
    this.nodeCount++;
    if (this.options.onProgress && this.nodeCount % 25 === 0) {
      this.options.onProgress(`Serialised ${this.nodeCount} nodes…`);
    }
    const n = node as SceneNode & Partial<MinimalStrokesMixin & BlendMixin & LayoutMixin & CornerMixin & RectangleCornerMixin>;
    let kind = kindOf(node);
    const notes: string[] = [];

    const rec: NodeRecord = {
      id: node.id,
      name: node.name,
      type: node.type,
      kind,
      visible: node.visible !== false,
      parentId,
      index,
      x: num(n.x),
      y: num(n.y),
      width: num(n.width),
      height: num(n.height),
      rotation: num(n.rotation),
      relativeTransform: copyMatrix(n.relativeTransform),
      absoluteTransform: copyMatrix(n.absoluteTransform),
      absoluteBoundingBox: n.absoluteBoundingBox ? { ...n.absoluteBoundingBox } : null,
      opacity: num(n.opacity, 1),
      blendMode: n.blendMode || 'NORMAL',
      isMask: 'isMask' in node ? !!node.isMask : false,
      maskType: 'maskType' in node ? String(node.maskType) : 'ALPHA',
      fills: 'fills' in node ? serializePaints(node.fills as ReadonlyArray<Paint> | PluginAPI['mixed']) : [],
      strokes: 'strokes' in node ? serializePaints(node.strokes) : [],
      strokeWeight: 0,
      strokeAlign: 'strokeAlign' in node ? String(node.strokeAlign) : 'CENTER',
      strokeCap: 'strokeCap' in node && !isMixed(node.strokeCap) ? String(node.strokeCap) : 'NONE',
      strokeJoin: 'strokeJoin' in node && !isMixed(node.strokeJoin) ? String(node.strokeJoin) : 'MITER',
      dashPattern: 'dashPattern' in node ? (node.dashPattern as number[]).slice() : [],
      cornerRadius: 0,
      cornerRadii: [0, 0, 0, 0],
      effects: 'effects' in node ? (node.effects as ReadonlyArray<Effect>).map(serializeEffect) : [],
      children: [],
    };

    // Stroke weight (may be per-side on frames/rectangles).
    if ('strokeWeight' in node) {
      if (isMixed(node.strokeWeight) && 'strokeTopWeight' in node) {
        const s = node as unknown as IndividualStrokesMixin;
        rec.strokeWeights = {
          top: s.strokeTopWeight,
          right: s.strokeRightWeight,
          bottom: s.strokeBottomWeight,
          left: s.strokeLeftWeight,
        };
        rec.strokeWeight = Math.max(s.strokeTopWeight, s.strokeRightWeight, s.strokeBottomWeight, s.strokeLeftWeight);
      } else {
        rec.strokeWeight = num(node.strokeWeight);
      }
    }

    // Corner radius (incl. per-corner on rectangles and frames).
    if ('topLeftRadius' in node) {
      const c = node as unknown as RectangleCornerMixin;
      rec.cornerRadii = [c.topLeftRadius, c.topRightRadius, c.bottomRightRadius, c.bottomLeftRadius];
      const same = rec.cornerRadii.every((r) => r === rec.cornerRadii[0]);
      rec.cornerRadius = same ? rec.cornerRadii[0] : null;
    } else if ('cornerRadius' in node && !isMixed(node.cornerRadius)) {
      const r = num(node.cornerRadius);
      rec.cornerRadius = r;
      rec.cornerRadii = [r, r, r, r];
    }

    if ('clipsContent' in node) rec.clipsContent = !!node.clipsContent;

    // Shape-specific geometry.
    if (node.type === 'POLYGON') {
      rec.polystar = { starType: 'polygon', pointCount: node.pointCount, innerRadius: 0 };
    } else if (node.type === 'STAR') {
      rec.polystar = { starType: 'star', pointCount: node.pointCount, innerRadius: node.innerRadius };
    } else if (node.type === 'ELLIPSE') {
      const arc = node.arcData;
      const full =
        !arc ||
        (Math.abs(arc.startingAngle) < 1e-6 && Math.abs(arc.endingAngle - 2 * Math.PI) < 1e-4 && arc.innerRadius === 0);
      if (!full) {
        // Partial arcs / donuts have no AE primitive: ship the outline as a vector.
        kind = 'vector';
        rec.vectorPaths = pathsFrom(node.fillGeometry);
        notes.push('ellipse arc exported as vector path');
      }
    } else if (node.type === 'VECTOR') {
      rec.vectorPaths = pathsFrom(node.vectorPaths);
      if (!rec.vectorPaths.length) rec.vectorPaths = pathsFrom(node.fillGeometry);
    } else if (node.type === 'BOOLEAN_OPERATION') {
      // The boolean result is in fillGeometry (node-local coordinates); its children
      // are only operands and must not be drawn again.
      rec.vectorPaths = pathsFrom(node.fillGeometry);
      rec.renderChildren = false;
    } else if (node.type === 'TEXT') {
      rec.text = serializeText(node);
    }

    // Image fills: export the node as a PNG.
    if (kind !== 'text' && kind !== 'group' && kind !== 'unsupported' && hasVisibleImageFill(node)) {
      await this.exportImage(node, rec, notes);
    }

    rec.kind = kind;
    this.byKind[kind] = (this.byKind[kind] || 0) + 1;
    if (notes.length) rec.notes = notes;

    if ('children' in node) {
      const kids = (node as ChildrenMixin).children;
      for (let i = 0; i < kids.length; i++) {
        rec.children.push(await this.visit(kids[i], node.id, i));
      }
    }
    return rec;
  }

  // Exports a clean copy of the node's fills: a temporary clone without rotation,
  // opacity, strokes, effects or children, so After Effects can re-apply all of
  // those natively. Falls back to exporting the node as rendered on canvas.
  private async exportImage(node: SceneNode, rec: NodeRecord, notes: string[]): Promise<void> {
    const scale = this.options.imageScale || 2;
    const file = `images/img_${String(this.images.length + 1).padStart(3, '0')}_${safeName(node.name)}.png`;
    const settings: ExportSettingsImage = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
      useAbsoluteBounds: true,
    };

    let bytes: Uint8Array | null = null;
    let baked = false;
    let clone: SceneNode | null = null;
    try {
      clone = (node as SceneNode & { clone(): SceneNode }).clone();
      figma.currentPage.appendChild(clone);
      // An instance's children can't be removed; detaching the copy leaves the original alone.
      if (clone.type === 'INSTANCE') clone = clone.detachInstance();
      const c = clone as SceneNode & Partial<LayoutMixin & BlendMixin & MinimalStrokesMixin & ChildrenMixin>;
      if ('children' in c && c.children) {
        for (const child of c.children.slice()) child.remove();
      }
      c.visible = true;
      if ('relativeTransform' in c) c.relativeTransform = identity();
      if ('opacity' in c) c.opacity = 1;
      if ('blendMode' in c) c.blendMode = 'NORMAL';
      if ('effects' in c) c.effects = [];
      if ('strokes' in c) c.strokes = [];
      if ('isMask' in c) c.isMask = false;
      bytes = await (c as ExportMixin).exportAsync(settings);
    } catch (err) {
      notes.push(`clean image export failed (${String(err)}); exported as rendered`);
      baked = true;
    } finally {
      if (clone && !clone.removed) clone.remove();
    }
    if (!bytes) {
      try {
        bytes = await (node as ExportMixin).exportAsync(settings);
      } catch (err) {
        notes.push(`image export failed: ${String(err)}`);
        return;
      }
    }
    this.images.push({ path: file, bytes });
    rec.image = { file, scale, baked };
  }
}

function safeName(name: string): string {
  const s = name.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return (s || 'image').slice(0, 40);
}

export function isExportableRoot(node: SceneNode): boolean {
  return FRAME_TYPES.indexOf(node.type) >= 0 || GROUP_TYPES.indexOf(node.type) >= 0;
}

export async function serializeScene(root: SceneNode, options: SerializeOptions = {}): Promise<SerializeResult> {
  return new Serializer(options).run(root);
}
