"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop2 in b || (b = {}))
      if (__hasOwnProp.call(b, prop2))
        __defNormalProp(a, prop2, b[prop2]);
    if (__getOwnPropSymbols)
      for (var prop2 of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop2))
          __defNormalProp(a, prop2, b[prop2]);
      }
    return a;
  };

  // src/serialize.ts
  var FRAME_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"];
  var GROUP_TYPES = ["GROUP", "TRANSFORM_GROUP"];
  function isMixed(value) {
    return value === figma.mixed;
  }
  function num(value, fallback = 0) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }
  function prop(node, key) {
    return key in node ? node[key] : void 0;
  }
  function round(value, digits = 4) {
    const f = Math.pow(10, digits);
    return Math.round(value * f) / f;
  }
  function identity() {
    return [
      [1, 0, 0],
      [0, 1, 0]
    ];
  }
  function copyMatrix(m) {
    if (!m) return identity();
    return [
      [m[0][0], m[0][1], m[0][2]],
      [m[1][0], m[1][1], m[1][2]]
    ];
  }
  function invert(m) {
    const [[a, c, e], [b, d, f]] = m;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return identity();
    return [
      [d / det, -c / det, (c * f - d * e) / det],
      [-b / det, a / det, (b * e - a * f) / det]
    ];
  }
  function apply(m, x, y) {
    return [round(m[0][0] * x + m[0][1] * y + m[0][2], 6), round(m[1][0] * x + m[1][1] * y + m[1][2], 6)];
  }
  function rgba(color) {
    return { r: round(color.r), g: round(color.g), b: round(color.b), a: round(color.a === void 0 ? 1 : color.a) };
  }
  function serializePaint(paint) {
    const rec = {
      type: paint.type,
      visible: paint.visible !== false,
      opacity: num(paint.opacity, 1),
      blendMode: paint.blendMode || "NORMAL"
    };
    if (paint.type === "SOLID") {
      rec.color = rgba(paint.color);
    } else if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") {
      rec.gradientStops = paint.gradientStops.map((s) => ({ position: round(s.position), color: rgba(s.color) }));
      rec.gradientTransform = copyMatrix(paint.gradientTransform);
      rec.color = rec.gradientStops.length ? rec.gradientStops[0].color : { r: 0, g: 0, b: 0, a: 1 };
      const inv = invert(rec.gradientTransform);
      if (paint.type === "GRADIENT_LINEAR") {
        rec.gradientHandles = { start: apply(inv, 0, 0.5), end: apply(inv, 1, 0.5) };
      } else {
        rec.gradientHandles = { start: apply(inv, 0.5, 0.5), end: apply(inv, 1, 0.5) };
      }
    } else if (paint.type === "IMAGE") {
      rec.scaleMode = paint.scaleMode;
      rec.imageHash = paint.imageHash;
    }
    return rec;
  }
  function serializePaints(paints) {
    if (!paints || isMixed(paints)) return [];
    return paints.map(serializePaint);
  }
  function serializeEffect(effect) {
    const rec = {
      type: effect.type,
      visible: effect.visible !== false,
      radius: num(effect.radius)
    };
    if ((effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") && "blurType" in effect && effect.blurType) {
      rec.blurType = effect.blurType;
    }
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      rec.color = rgba(effect.color);
      rec.offset = { x: effect.offset.x, y: effect.offset.y };
      rec.spread = num(effect.spread);
      rec.blendMode = effect.blendMode;
    }
    return rec;
  }
  function kindOf(node) {
    const t = node.type;
    if (FRAME_TYPES.indexOf(t) >= 0) return "frame";
    if (GROUP_TYPES.indexOf(t) >= 0) return "group";
    switch (t) {
      case "RECTANGLE":
        return "rect";
      case "ELLIPSE":
        return "ellipse";
      case "LINE":
        return "line";
      case "POLYGON":
      case "STAR":
        return "polystar";
      case "VECTOR":
      case "BOOLEAN_OPERATION":
        return "vector";
      case "TEXT":
        return "text";
      default:
        return "unsupported";
    }
  }
  function pathsFrom(paths) {
    if (!paths) return [];
    return paths.map((p) => ({ windingRule: p.windingRule, data: p.data }));
  }
  function hasVisibleImageFill(node) {
    if (!("fills" in node) || isMixed(node.fills)) return false;
    return node.fills.some((p) => p.type === "IMAGE" && p.visible !== false);
  }
  function lineHeightRecord(lh) {
    return lh.unit === "AUTO" ? { unit: "AUTO" } : { unit: lh.unit, value: lh.value };
  }
  function firstFillColor(fills) {
    for (const f of fills) {
      if (!f.visible) continue;
      if (f.color) return { r: f.color.r, g: f.color.g, b: f.color.b, a: round(f.color.a * f.opacity) };
    }
    return null;
  }
  function serializeText(node) {
    const raw = node.getStyledTextSegments([
      "fontName",
      "fontSize",
      "fills",
      "letterSpacing",
      "lineHeight",
      "textDecoration",
      "textCase"
    ]);
    const segments = raw.map((s) => ({
      characters: s.characters,
      start: s.start,
      end: s.end,
      fontName: { family: s.fontName.family, style: s.fontName.style },
      fontSize: s.fontSize,
      letterSpacing: { unit: s.letterSpacing.unit, value: s.letterSpacing.value },
      lineHeight: lineHeightRecord(s.lineHeight),
      fills: serializePaints(s.fills),
      textDecoration: s.textDecoration,
      textCase: s.textCase
    }));
    const base = segments[0];
    const fallbackFont = { family: "Arial", style: "Regular" };
    return {
      characters: node.characters,
      fontName: base ? base.fontName : isMixed(node.fontName) ? fallbackFont : node.fontName,
      fontSize: base ? base.fontSize : num(node.fontSize, 12),
      letterSpacing: base ? base.letterSpacing : { unit: "PIXELS", value: 0 },
      lineHeight: base ? base.lineHeight : { unit: "AUTO" },
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      textAutoResize: node.textAutoResize,
      textCase: base ? base.textCase : "ORIGINAL",
      textDecoration: base ? base.textDecoration : "NONE",
      paragraphSpacing: num(node.paragraphSpacing),
      fill: base ? firstFillColor(base.fills) : null,
      mixed: segments.length > 1,
      segments
    };
  }
  var Serializer = class {
    constructor(options) {
      this.options = options;
      this.images = [];
      this.nodeCount = 0;
      this.byKind = {};
    }
    async run(root) {
      const record = await this.visit(root, null, 0);
      const scene = {
        format: "figma-to-ae",
        version: 1,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        figmaFile: figma.root ? figma.root.name : "",
        frame: { id: root.id, name: root.name, width: record.width, height: record.height },
        stats: { nodes: this.nodeCount, images: this.images.length, byKind: this.byKind },
        root: record
      };
      return { scene, images: this.images };
    }
    async visit(node, parentId, index) {
      this.nodeCount++;
      if (this.options.onProgress && this.nodeCount % 25 === 0) {
        this.options.onProgress(`Serialised ${this.nodeCount} nodes\u2026`);
      }
      let kind = kindOf(node);
      const notes = [];
      const rec = {
        id: node.id,
        name: node.name,
        type: node.type,
        kind,
        visible: node.visible !== false,
        parentId,
        index,
        x: num(prop(node, "x")),
        y: num(prop(node, "y")),
        width: num(prop(node, "width")),
        height: num(prop(node, "height")),
        rotation: num(prop(node, "rotation")),
        relativeTransform: copyMatrix(prop(node, "relativeTransform")),
        absoluteTransform: copyMatrix(prop(node, "absoluteTransform")),
        absoluteBoundingBox: prop(node, "absoluteBoundingBox") ? __spreadValues({}, prop(node, "absoluteBoundingBox")) : null,
        opacity: num(prop(node, "opacity"), 1),
        blendMode: prop(node, "blendMode") || "NORMAL",
        isMask: "isMask" in node ? !!node.isMask : false,
        maskType: "maskType" in node ? String(node.maskType) : "ALPHA",
        fills: "fills" in node ? serializePaints(node.fills) : [],
        strokes: "strokes" in node ? serializePaints(node.strokes) : [],
        strokeWeight: 0,
        strokeAlign: "strokeAlign" in node ? String(node.strokeAlign) : "CENTER",
        strokeCap: "strokeCap" in node && !isMixed(node.strokeCap) ? String(node.strokeCap) : "NONE",
        strokeJoin: "strokeJoin" in node && !isMixed(node.strokeJoin) ? String(node.strokeJoin) : "MITER",
        dashPattern: "dashPattern" in node ? node.dashPattern.slice() : [],
        cornerRadius: 0,
        cornerRadii: [0, 0, 0, 0],
        effects: "effects" in node ? node.effects.map(serializeEffect) : [],
        children: []
      };
      if ("strokeWeight" in node) {
        if (isMixed(node.strokeWeight) && "strokeTopWeight" in node) {
          const s = node;
          rec.strokeWeights = {
            top: s.strokeTopWeight,
            right: s.strokeRightWeight,
            bottom: s.strokeBottomWeight,
            left: s.strokeLeftWeight
          };
          rec.strokeWeight = Math.max(s.strokeTopWeight, s.strokeRightWeight, s.strokeBottomWeight, s.strokeLeftWeight);
        } else {
          rec.strokeWeight = num(node.strokeWeight);
        }
      }
      if ("topLeftRadius" in node) {
        const c = node;
        rec.cornerRadii = [c.topLeftRadius, c.topRightRadius, c.bottomRightRadius, c.bottomLeftRadius];
        const same = rec.cornerRadii.every((r) => r === rec.cornerRadii[0]);
        rec.cornerRadius = same ? rec.cornerRadii[0] : null;
      } else if ("cornerRadius" in node && !isMixed(node.cornerRadius)) {
        const r = num(node.cornerRadius);
        rec.cornerRadius = r;
        rec.cornerRadii = [r, r, r, r];
      }
      if ("clipsContent" in node) rec.clipsContent = !!node.clipsContent;
      if (node.type === "POLYGON") {
        rec.polystar = { starType: "polygon", pointCount: node.pointCount, innerRadius: 0 };
      } else if (node.type === "STAR") {
        rec.polystar = { starType: "star", pointCount: node.pointCount, innerRadius: node.innerRadius };
      } else if (node.type === "ELLIPSE") {
        const arc = node.arcData;
        const full = !arc || Math.abs(arc.startingAngle) < 1e-6 && Math.abs(arc.endingAngle - 2 * Math.PI) < 1e-4 && arc.innerRadius === 0;
        if (!full) {
          kind = "vector";
          rec.vectorPaths = pathsFrom(node.fillGeometry);
          notes.push("ellipse arc exported as vector path");
        }
      } else if (node.type === "VECTOR") {
        rec.vectorPaths = pathsFrom(node.vectorPaths);
        if (!rec.vectorPaths.length) rec.vectorPaths = pathsFrom(node.fillGeometry);
      } else if (node.type === "BOOLEAN_OPERATION") {
        rec.vectorPaths = pathsFrom(node.fillGeometry);
        rec.renderChildren = false;
      } else if (node.type === "TEXT") {
        rec.text = serializeText(node);
      }
      if (kind !== "text" && kind !== "group" && kind !== "unsupported" && hasVisibleImageFill(node)) {
        await this.exportImage(node, rec, notes);
      }
      rec.kind = kind;
      this.byKind[kind] = (this.byKind[kind] || 0) + 1;
      if (notes.length) rec.notes = notes;
      if ("children" in node) {
        const kids = node.children;
        for (let i = 0; i < kids.length; i++) {
          rec.children.push(await this.visit(kids[i], node.id, i));
        }
      }
      return rec;
    }
    // Exports a clean copy of the node's fills: a temporary clone without rotation,
    // opacity, strokes, effects or children, so After Effects can re-apply all of
    // those natively. Falls back to exporting the node as rendered on canvas.
    async exportImage(node, rec, notes) {
      const scale = this.options.imageScale || 2;
      const file = `images/img_${String(this.images.length + 1).padStart(3, "0")}_${safeName(node.name)}.png`;
      const settings = {
        format: "PNG",
        constraint: { type: "SCALE", value: scale },
        useAbsoluteBounds: true
      };
      let bytes = null;
      let baked = false;
      let clone = null;
      try {
        clone = node.clone();
        figma.currentPage.appendChild(clone);
        if (clone.type === "INSTANCE") clone = clone.detachInstance();
        const c = clone;
        if ("children" in c && c.children) {
          for (const child of c.children.slice()) child.remove();
        }
        c.visible = true;
        if ("relativeTransform" in c) c.relativeTransform = identity();
        if ("opacity" in c) c.opacity = 1;
        if ("blendMode" in c) c.blendMode = "NORMAL";
        if ("effects" in c) c.effects = [];
        if ("strokes" in c) c.strokes = [];
        if ("isMask" in c) c.isMask = false;
        bytes = await c.exportAsync(settings);
      } catch (err) {
        notes.push(`clean image export failed (${String(err)}); exported as rendered`);
        baked = true;
      } finally {
        if (clone && !clone.removed) clone.remove();
      }
      if (!bytes) {
        try {
          bytes = await node.exportAsync(settings);
        } catch (err) {
          notes.push(`image export failed: ${String(err)}`);
          return;
        }
      }
      this.images.push({ path: file, bytes });
      rec.image = { file, scale, baked };
    }
  };
  function safeName(name) {
    const s = name.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
    return (s || "image").slice(0, 40);
  }
  function isExportableRoot(node) {
    return FRAME_TYPES.indexOf(node.type) >= 0 || GROUP_TYPES.indexOf(node.type) >= 0;
  }
  async function serializeScene(root, options = {}) {
    return new Serializer(options).run(root);
  }

  // code.ts
  figma.showUI(__html__, { width: 340, height: 330, themeColors: true });
  function describeSelection() {
    const sel = figma.currentPage.selection;
    if (sel.length !== 1) {
      return { ok: false, message: sel.length ? `Select exactly one frame (${sel.length} selected).` : "Select one frame to export." };
    }
    const node = sel[0];
    if (!isExportableRoot(node)) {
      return { ok: false, message: `"${node.name}" is a ${node.type}. Select a frame, component, instance, section or group.` };
    }
    return { ok: true, message: `Ready: "${node.name}" (${Math.round(node.width)} \xD7 ${Math.round(node.height)})` };
  }
  function postSelection() {
    figma.ui.postMessage(__spreadValues({ type: "selection" }, describeSelection()));
  }
  figma.on("selectionchange", postSelection);
  postSelection();
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "close") {
      figma.closePlugin();
      return;
    }
    if (msg.type !== "export") return;
    const status = describeSelection();
    if (!status.ok) {
      figma.ui.postMessage({ type: "error", message: status.message });
      return;
    }
    const root = figma.currentPage.selection[0];
    try {
      const { scene, images } = await serializeScene(root, {
        imageScale: 2,
        onProgress: (message) => figma.ui.postMessage({ type: "progress", message })
      });
      figma.ui.postMessage({
        type: "export-result",
        mode: msg.mode === "zip" ? "zip" : "copy",
        fileName: root.name,
        scene: JSON.stringify(scene),
        images,
        stats: scene.stats
      });
    } catch (err) {
      figma.ui.postMessage({ type: "error", message: `Export failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };
})();
