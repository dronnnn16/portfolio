// Shape of scene.json. The After Effects importer (after-effects/FigmaToAE.jsx)
// reads exactly these fields, so treat this file as the contract between the two.

export type Matrix = [[number, number, number], [number, number, number]];

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorStop {
  position: number;
  color: RGBA;
}

export interface PaintRecord {
  type: string; // SOLID | GRADIENT_LINEAR | GRADIENT_RADIAL | GRADIENT_ANGULAR | GRADIENT_DIAMOND | IMAGE | VIDEO | PATTERN
  visible: boolean;
  opacity: number;
  blendMode: string;
  /** SOLID: the colour. Gradients: the first stop's colour (handy fallback). */
  color?: RGBA;
  gradientStops?: ColorStop[];
  gradientTransform?: Matrix;
  /** Gradient handles in the node's normalised box space (0..1). */
  gradientHandles?: { start: [number, number]; end: [number, number] };
  scaleMode?: string;
  imageHash?: string | null;
}

export interface EffectRecord {
  type: string; // DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR | ...
  visible: boolean;
  radius: number;
  color?: RGBA;
  offset?: { x: number; y: number };
  spread?: number;
  blendMode?: string;
}

export interface VectorPathRecord {
  windingRule: string; // NONZERO | EVENODD | NONE
  data: string; // SVG path data in the node's local coordinates
}

export interface TextSegmentRecord {
  characters: string;
  start: number;
  end: number;
  fontName: { family: string; style: string };
  fontSize: number;
  letterSpacing: { unit: string; value: number };
  lineHeight: { unit: string; value?: number };
  fills: PaintRecord[];
  textDecoration: string;
  textCase: string;
}

export interface TextRecord {
  characters: string;
  fontName: { family: string; style: string };
  fontSize: number;
  letterSpacing: { unit: string; value: number };
  lineHeight: { unit: string; value?: number };
  textAlignHorizontal: string;
  textAlignVertical: string;
  textAutoResize: string;
  textCase: string;
  textDecoration: string;
  paragraphSpacing: number;
  /** First visible solid fill (or first gradient stop) of the first segment. */
  fill: RGBA | null;
  mixed: boolean;
  segments: TextSegmentRecord[];
}

export interface ImageRecord {
  file: string; // relative path inside the export, e.g. images/img_001.png
  scale: number; // export scale (2 = @2x)
  /**
   * false: the PNG is the node's own fills only, unrotated, at width*scale x height*scale.
   * true: the PNG is the node as rendered on canvas (rotation/effects baked in) and
   *       covers absoluteBoundingBox. Used when the clean export failed.
   */
  baked: boolean;
}

export type NodeKind =
  | 'frame'
  | 'group'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polystar'
  | 'vector'
  | 'text'
  | 'unsupported';

export interface NodeRecord {
  id: string;
  name: string;
  type: string; // original Figma node type
  kind: NodeKind;
  visible: boolean;
  parentId: string | null;
  index: number; // position among siblings, 0 = bottom-most (Figma child order)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // Figma degrees, counter-clockwise positive
  relativeTransform: Matrix;
  absoluteTransform: Matrix;
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null;
  opacity: number;
  blendMode: string;
  isMask: boolean;
  maskType: string;
  fills: PaintRecord[];
  strokes: PaintRecord[];
  strokeWeight: number;
  strokeWeights?: { top: number; right: number; bottom: number; left: number };
  strokeAlign: string;
  strokeCap: string;
  strokeJoin: string;
  dashPattern: number[];
  cornerRadius: number | null; // null when the corners differ
  cornerRadii: [number, number, number, number]; // tl, tr, br, bl
  effects: EffectRecord[];
  clipsContent?: boolean;
  polystar?: { starType: 'polygon' | 'star'; pointCount: number; innerRadius: number };
  vectorPaths?: VectorPathRecord[];
  text?: TextRecord;
  image?: ImageRecord;
  /** false for BOOLEAN_OPERATION: children are operands, the result is in vectorPaths. */
  renderChildren?: boolean;
  notes?: string[];
  children: NodeRecord[];
}

export interface SceneFile {
  format: 'figma-to-ae';
  version: 1;
  exportedAt: string;
  figmaFile: string;
  frame: { id: string; name: string; width: number; height: number };
  stats: { nodes: number; images: number; byKind: { [kind: string]: number } };
  root: NodeRecord;
}

export interface ExportedImage {
  path: string;
  bytes: Uint8Array;
}
