/*
 * FigmaToAE.jsx - Figma -> After Effects importer (ScriptUI panel)
 *
 * Imports the folder produced by the "Figma to After Effects Exporter" plugin
 * (scene.json + images/*.png) and rebuilds the frame as native AE layers.
 *
 * Install: copy into
 *   C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels\
 * restart After Effects and open it from the Window menu.
 *
 * ExtendScript is ES3: no JSON object, no Array.indexOf/forEach/map, no String.trim.
 * Keep this file ASCII-only so it reads correctly whatever encoding AE assumes.
 */
#targetengine "FigmaToAE"
(function (thisObj) {
    var VERSION = "1.1.0";
    var COMP_FPS = 30;
    var COMP_DURATION = 10;
    var LOG_FILE_NAME = "figma-ae-import-log.txt";
    var KAPPA = 0.5522847498;

    // ------------------------------------------------------------------
    // JSON (ExtendScript has no JSON object)
    // ------------------------------------------------------------------

    function parseJSON(text) {
        var at = 0;
        var len = text.length;

        function fail(msg) {
            throw new Error("Invalid scene.json: " + msg + " at character " + at);
        }
        function skipWhite() {
            var c;
            while (at < len) {
                c = text.charCodeAt(at);
                if (c === 32 || c === 9 || c === 10 || c === 13 || c === 0xFEFF) {
                    at++;
                } else {
                    break;
                }
            }
        }
        function parseString() {
            var out = "";
            var start;
            var c;
            var hex;
            at++; // opening quote
            start = at;
            while (at < len) {
                c = text.charAt(at);
                if (c === "\"") {
                    out += text.substring(start, at);
                    at++;
                    return out;
                }
                if (c === "\\") {
                    out += text.substring(start, at);
                    at++;
                    c = text.charAt(at);
                    if (c === "u") {
                        hex = text.substr(at + 1, 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
                            fail("bad unicode escape");
                        }
                        out += String.fromCharCode(parseInt(hex, 16));
                        at += 5;
                    } else {
                        if (c === "n") { out += "\n"; }
                        else if (c === "r") { out += "\r"; }
                        else if (c === "t") { out += "\t"; }
                        else if (c === "b") { out += "\b"; }
                        else if (c === "f") { out += "\f"; }
                        else if (c === "\"" || c === "\\" || c === "/") { out += c; }
                        else { fail("bad escape"); }
                        at++;
                    }
                    start = at;
                } else {
                    at++;
                }
            }
            fail("unterminated string");
        }
        function parseNumber() {
            var m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?/.exec(text.substr(at, 40));
            if (!m) {
                fail("bad number");
            }
            at += m[0].length;
            return parseFloat(m[0]);
        }
        function parseValue() {
            var c;
            var arr;
            var obj;
            var key;
            skipWhite();
            c = text.charAt(at);
            if (c === "{") {
                obj = {};
                at++;
                skipWhite();
                if (text.charAt(at) === "}") {
                    at++;
                    return obj;
                }
                while (true) {
                    skipWhite();
                    if (text.charAt(at) !== "\"") {
                        fail("expected key");
                    }
                    key = parseString();
                    skipWhite();
                    if (text.charAt(at) !== ":") {
                        fail("expected ':'");
                    }
                    at++;
                    obj[key] = parseValue();
                    skipWhite();
                    c = text.charAt(at);
                    at++;
                    if (c === "}") {
                        return obj;
                    }
                    if (c !== ",") {
                        fail("expected ',' or '}'");
                    }
                }
            }
            if (c === "[") {
                arr = [];
                at++;
                skipWhite();
                if (text.charAt(at) === "]") {
                    at++;
                    return arr;
                }
                while (true) {
                    arr.push(parseValue());
                    skipWhite();
                    c = text.charAt(at);
                    at++;
                    if (c === "]") {
                        return arr;
                    }
                    if (c !== ",") {
                        fail("expected ',' or ']'");
                    }
                }
            }
            if (c === "\"") {
                return parseString();
            }
            if (text.substr(at, 4) === "true") {
                at += 4;
                return true;
            }
            if (text.substr(at, 5) === "false") {
                at += 5;
                return false;
            }
            if (text.substr(at, 4) === "null") {
                at += 4;
                return null;
            }
            return parseNumber();
        }

        var result = parseValue();
        skipWhite();
        if (at < len) {
            fail("unexpected trailing data");
        }
        return result;
    }

    // ------------------------------------------------------------------
    // 2x3 affine matrices in Figma layout: [[a, c, tx], [b, d, ty]]
    // x' = a*x + c*y + tx,  y' = b*x + d*y + ty
    // ------------------------------------------------------------------

    function mMul(A, B) {
        return [
            [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1], A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2]],
            [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1], A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2]]
        ];
    }

    function mInv(M) {
        var a = M[0][0], c = M[0][1], e = M[0][2], b = M[1][0], d = M[1][1], f = M[1][2];
        var det = a * d - b * c;
        if (Math.abs(det) < 1e-12) {
            return [[1, 0, 0], [0, 1, 0]];
        }
        return [
            [d / det, -c / det, (c * f - d * e) / det],
            [-b / det, a / det, (b * e - a * f) / det]
        ];
    }

    function mApply(M, x, y) {
        return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
    }

    // Splits the linear part into AE rotation (clockwise degrees) and scale factors.
    // Figma's rotation r gives [[cos r, sin r], [-sin r, cos r]], so this returns -r.
    function mDecompose(M) {
        var a = M[0][0], c = M[0][1], b = M[1][0], d = M[1][1];
        var sx = Math.sqrt(a * a + b * b);
        var rot = Math.atan2(b, a) * 180 / Math.PI;
        var sy = sx > 1e-12 ? (a * d - b * c) / sx : 0;
        if (Math.abs(rot) < 1e-9) {
            rot = 0;
        }
        return { rotation: rot, sx: sx, sy: sy };
    }

    function mTranslate(x, y) {
        return [[1, 0, x], [0, 1, y]];
    }

    // ------------------------------------------------------------------
    // SVG path data -> AE path data ({v, i, o, closed}; tangents relative to vertex)
    // Supports M L H V C S Q T Z (absolute and relative). A is approximated by a line.
    // ------------------------------------------------------------------

    function parseSvgPath(d, warn) {
        var tokens = [];
        var re = /[a-zA-Z]|[-+]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?/g;
        var m;
        while ((m = re.exec(d)) !== null) {
            tokens.push(m[0]);
        }

        var paths = [];
        var cur = null;
        var pos = 0;
        var cmd = "";
        var x = 0, y = 0;        // current point
        var sx = 0, sy = 0;      // subpath start
        var lcx = 0, lcy = 0;    // last control point (for S / T)
        var lastType = "";       // "C" or "Q" when the previous segment was a curve
        var arcWarned = false;

        function isCmd(t) {
            return /^[a-zA-Z]$/.test(t);
        }
        function num() {
            if (pos >= tokens.length || isCmd(tokens[pos])) {
                throw new Error("SVG path: missing number after '" + cmd + "'");
            }
            return parseFloat(tokens[pos++]);
        }
        function finish() {
            if (cur && cur.v.length > 0) {
                paths.push(cur);
            }
            cur = null;
        }
        function begin(px, py) {
            finish();
            cur = { v: [[px, py]], i: [[0, 0]], o: [[0, 0]], closed: false };
        }
        function ensure() {
            if (!cur) {
                begin(x, y);
            }
        }
        function lineTo(px, py) {
            ensure();
            cur.v.push([px, py]);
            cur.i.push([0, 0]);
            cur.o.push([0, 0]);
        }
        function cubicTo(c1x, c1y, c2x, c2y, px, py) {
            ensure();
            var n = cur.v.length - 1;
            cur.o[n] = [c1x - cur.v[n][0], c1y - cur.v[n][1]];
            cur.v.push([px, py]);
            cur.i.push([c2x - px, c2y - py]);
            cur.o.push([0, 0]);
        }
        function quadTo(qx, qy, px, py) {
            cubicTo(x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), px + 2 / 3 * (qx - px), py + 2 / 3 * (qy - py), px, py);
        }
        function close() {
            if (!cur) {
                return;
            }
            var n = cur.v.length - 1;
            // Figma often repeats the start point before Z; fold it into the first vertex.
            if (n > 0 && Math.abs(cur.v[n][0] - cur.v[0][0]) < 1e-6 && Math.abs(cur.v[n][1] - cur.v[0][1]) < 1e-6) {
                cur.i[0] = cur.i[n];
                cur.v.pop();
                cur.i.pop();
                cur.o.pop();
            }
            cur.closed = true;
            finish();
            x = sx;
            y = sy;
        }

        while (pos < tokens.length) {
            if (isCmd(tokens[pos])) {
                cmd = tokens[pos++];
            } else if (cmd === "") {
                throw new Error("SVG path must start with a command");
            } else if (cmd === "M") {
                cmd = "L"; // extra coordinate pairs after M are implicit L
            } else if (cmd === "m") {
                cmd = "l";
            }
            var rel = cmd === cmd.toLowerCase();
            var C = cmd.toUpperCase();
            var ox = rel ? x : 0;
            var oy = rel ? y : 0;
            var x1, y1, x2, y2, px, py;

            if (C === "Z") {
                close();
                lastType = "";
                continue;
            }
            if (C === "M") {
                px = ox + num();
                py = oy + num();
                begin(px, py);
                x = sx = px;
                y = sy = py;
                lastType = "";
            } else if (C === "L") {
                px = ox + num();
                py = oy + num();
                lineTo(px, py);
                x = px;
                y = py;
                lastType = "";
            } else if (C === "H") {
                px = ox + num();
                lineTo(px, y);
                x = px;
                lastType = "";
            } else if (C === "V") {
                py = oy + num();
                lineTo(x, py);
                y = py;
                lastType = "";
            } else if (C === "C" || C === "S") {
                if (C === "C") {
                    x1 = ox + num();
                    y1 = oy + num();
                } else {
                    x1 = lastType === "C" ? 2 * x - lcx : x;
                    y1 = lastType === "C" ? 2 * y - lcy : y;
                }
                x2 = ox + num();
                y2 = oy + num();
                px = ox + num();
                py = oy + num();
                cubicTo(x1, y1, x2, y2, px, py);
                lcx = x2;
                lcy = y2;
                x = px;
                y = py;
                lastType = "C";
            } else if (C === "Q" || C === "T") {
                if (C === "Q") {
                    x1 = ox + num();
                    y1 = oy + num();
                } else {
                    x1 = lastType === "Q" ? 2 * x - lcx : x;
                    y1 = lastType === "Q" ? 2 * y - lcy : y;
                }
                px = ox + num();
                py = oy + num();
                quadTo(x1, y1, px, py);
                lcx = x1;
                lcy = y1;
                x = px;
                y = py;
                lastType = "Q";
            } else if (C === "A") {
                num(); num(); num(); num(); num();
                px = ox + num();
                py = oy + num();
                if (!arcWarned && warn) {
                    warn("SVG arc command approximated by a straight line");
                    arcWarned = true;
                }
                lineTo(px, py);
                x = px;
                y = py;
                lastType = "";
            } else {
                throw new Error("Unsupported SVG path command '" + cmd + "'");
            }
        }
        finish();
        return paths;
    }

    // Closed bezier path for a rectangle centred on (0,0) with per-corner radii [tl, tr, br, bl].
    function roundedRectPath(w, h, radii) {
        var r = [Math.max(0, radii[0]), Math.max(0, radii[1]), Math.max(0, radii[2]), Math.max(0, radii[3])];
        // Shrink radii proportionally when adjacent corners overlap (same rule as CSS/Figma).
        var f = 1;
        var sides = [[r[0] + r[1], w], [r[1] + r[2], h], [r[2] + r[3], w], [r[3] + r[0], h]];
        var k;
        for (k = 0; k < sides.length; k++) {
            if (sides[k][0] > sides[k][1] && sides[k][0] > 0) {
                f = Math.min(f, sides[k][1] / sides[k][0]);
            }
        }
        for (k = 0; k < 4; k++) {
            r[k] *= f;
        }
        var x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
        var p = { v: [], i: [], o: [], closed: true };
        function pt(px, py, ix, iy, ox, oy) {
            p.v.push([px, py]);
            p.i.push([ix, iy]);
            p.o.push([ox, oy]);
        }
        // top-left corner
        if (r[0] > 0) {
            pt(x0, y0 + r[0], 0, 0, 0, -r[0] * KAPPA);
            pt(x0 + r[0], y0, -r[0] * KAPPA, 0, 0, 0);
        } else {
            pt(x0, y0, 0, 0, 0, 0);
        }
        // top-right
        if (r[1] > 0) {
            pt(x1 - r[1], y0, 0, 0, r[1] * KAPPA, 0);
            pt(x1, y0 + r[1], 0, -r[1] * KAPPA, 0, 0);
        } else {
            pt(x1, y0, 0, 0, 0, 0);
        }
        // bottom-right
        if (r[2] > 0) {
            pt(x1, y1 - r[2], 0, 0, 0, r[2] * KAPPA);
            pt(x1 - r[2], y1, r[2] * KAPPA, 0, 0, 0);
        } else {
            pt(x1, y1, 0, 0, 0, 0);
        }
        // bottom-left
        if (r[3] > 0) {
            pt(x0 + r[3], y1, 0, 0, -r[3] * KAPPA, 0);
            pt(x0, y1 - r[3], 0, r[3] * KAPPA, 0, 0);
        } else {
            pt(x0, y1, 0, 0, 0, 0);
        }
        return p;
    }

    // Bounding box of AE's polystar primitive (rotation 0: first point straight up).
    function polystarBounds(isStar, points, outer, inner) {
        var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        var count = isStar ? points * 2 : points;
        var k, a, rad, px, py;
        for (k = 0; k < count; k++) {
            a = 2 * Math.PI * k / count;
            rad = (isStar && k % 2 === 1) ? inner : outer;
            px = rad * Math.sin(a);
            py = -rad * Math.cos(a);
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    function visiblePaints(paints) {
        var out = [];
        if (!paints) {
            return out;
        }
        for (var k = 0; k < paints.length; k++) {
            if (paints[k].visible !== false) {
                out.push(paints[k]);
            }
        }
        return out;
    }

    function paintColor(paint) {
        if (paint.color) {
            return paint.color;
        }
        if (paint.gradientStops && paint.gradientStops.length) {
            return paint.gradientStops[0].color;
        }
        return { r: 0, g: 0, b: 0, a: 1 };
    }

    function rgb(color) {
        return [color.r, color.g, color.b];
    }

    function clampCompSize(v) {
        return Math.max(4, Math.min(30000, Math.ceil(v)));
    }

    var BLEND_MAP = {
        MULTIPLY: "MULTIPLY", SCREEN: "SCREEN", OVERLAY: "OVERLAY", DARKEN: "DARKEN", LIGHTEN: "LIGHTEN",
        COLOR_DODGE: "COLOR_DODGE", COLOR_BURN: "COLOR_BURN", HARD_LIGHT: "HARD_LIGHT", SOFT_LIGHT: "SOFT_LIGHT",
        DIFFERENCE: "DIFFERENCE", EXCLUSION: "EXCLUSION", HUE: "HUE", SATURATION: "SATURATION", COLOR: "COLOR",
        LUMINOSITY: "LUMINOSITY", LINEAR_BURN: "LINEAR_BURN", LINEAR_DODGE: "LINEAR_DODGE"
    };

    var CAP_MAP = { NONE: 1, ROUND: 2, SQUARE: 3 };
    var JOIN_MAP = { MITER: 1, ROUND: 2, BEVEL: 3 };

    // ------------------------------------------------------------------
    // Importer
    // ------------------------------------------------------------------

    function Importer(folder, options) {
        this.folder = folder;
        this.options = options || {};
        this.warnings = [];
        this.unsupported = [];
        this.stats = { layers: 0, shapes: 0, texts: 0, images: 0, nulls: 0, precomps: 0, comps: 0, footage: 0, effects: 0 };
        this.fontCache = {};
        this.footageCache = {};
        this.comp = null;
        this.projectFolder = null;
        this.rootAbs = null;
    }

    Importer.prototype.warn = function (node, message) {
        this.warnings.push(node ? "[" + node.name + "] " + message : message);
    };

    Importer.prototype.readScene = function () {
        var f = new File(this.folder.fsName + "/scene.json");
        if (!f.exists) {
            throw new Error("scene.json not found in " + this.folder.fsName + ". Select the unzipped export folder.");
        }
        f.encoding = "UTF-8";
        if (!f.open("r")) {
            throw new Error("Could not open " + f.fsName);
        }
        var text = f.read();
        f.close();
        var scene = parseJSON(text);
        if (!scene || scene.format !== "figma-to-ae" || !scene.root) {
            throw new Error("scene.json was not produced by the Figma to After Effects exporter.");
        }
        return scene;
    };

    Importer.prototype.run = function () {
        var scene = this.readScene();
        var root = scene.root;
        this.rootAbs = root.absoluteTransform;
        this.projectFolder = app.project.items.addFolder("Figma - " + root.name);

        var comp = app.project.items.addComp(root.name, clampCompSize(root.width), clampCompSize(root.height), 1, COMP_DURATION, COMP_FPS);
        comp.parentFolder = this.projectFolder;
        this.comp = comp;
        this.stats.comps++;

        var ctx = { comp: comp, containerAbs: root.absoluteTransform, parentLayer: null, opacity: 1, visible: true };
        if (root.effects && visibleCount(root.effects) > 0) {
            this.warn(root, "effects on the exported frame itself are ignored");
        }
        if (root.kind === "frame") {
            this.buildFrameBody(root, ctx, false);
        } else {
            this.buildChildren(root, ctx);
        }
        try {
            comp.openInViewer();
        } catch (e) {}
        return comp;
    };

    function visibleCount(list) {
        var n = 0;
        for (var k = 0; k < list.length; k++) {
            if (list[k].visible !== false) {
                n++;
            }
        }
        return n;
    }

    // Matrix from a node's local space into the space of the comp being built.
    Importer.prototype.rel = function (node, ctx) {
        return mMul(mInv(ctx.containerAbs), node.absoluteTransform);
    };

    // Matrix from a node's local space into the root comp (for effect compensation).
    Importer.prototype.world = function (node) {
        return mMul(mInv(this.rootAbs), node.absoluteTransform);
    };

    // Places a layer so that AE anchor (ax, ay) sits at Figma local point (lx, ly).
    Importer.prototype.setTransform = function (layer, M, lx, ly, ax, ay, ex, ey) {
        var p = mApply(M, lx, ly);
        var d = mDecompose(M);
        var t = layer.property("ADBE Transform Group");
        t.property("ADBE Anchor Point").setValue([ax, ay]);
        t.property("ADBE Position").setValue([p[0], p[1]]);
        t.property("ADBE Scale").setValue([d.sx * 100 * ex, d.sy * 100 * ey]);
        t.property("ADBE Rotate Z").setValue(d.rotation);
    };

    // Common layer settings. opts.part: layer is a piece of a frame (background or
    // stroke) whose opacity/visibility are already carried by ctx or a precomp layer.
    Importer.prototype.finishLayer = function (layer, node, ctx, opts) {
        opts = opts || {};
        var own = opts.part ? 1 : node.opacity;
        var visible = ctx.visible && (opts.part || node.visible !== false);
        layer.name = opts.name || node.name;
        layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(Math.max(0, Math.min(100, own * ctx.opacity * (opts.opacityMul === undefined ? 1 : opts.opacityMul) * 100)));
        if (!opts.part) {
            this.applyBlendMode(layer, node);
        }
        try {
            layer.outPoint = ctx.comp.duration;
        } catch (e) {}
        if (ctx.parentLayer) {
            layer.parent = ctx.parentLayer; // AE keeps the world transform when parenting
        }
        if (opts.effects) {
            this.applyEffects(layer, node, opts.extraScale || 1);
        }
        if (!visible) {
            layer.enabled = false;
        }
        this.stats.layers++;
    };

    Importer.prototype.applyBlendMode = function (layer, node) {
        var mode = node.blendMode;
        if (!mode || mode === "NORMAL" || mode === "PASS_THROUGH") {
            return;
        }
        if (BLEND_MAP[mode] && typeof BlendingMode !== "undefined" && BlendingMode[BLEND_MAP[mode]] !== undefined) {
            layer.blendingMode = BlendingMode[BLEND_MAP[mode]];
        } else {
            this.warn(node, "blend mode " + mode + " is not supported");
        }
    };

    Importer.prototype.applyEffects = function (layer, node, extraScale) {
        var effects = node.effects || [];
        if (!effects.length) {
            return;
        }
        var d = mDecompose(this.world(node));
        var s = (Math.abs(d.sx) + Math.abs(d.sy)) / 2 * extraScale;
        if (s < 1e-6) {
            s = 1;
        }
        for (var k = 0; k < effects.length; k++) {
            var e = effects[k];
            if (e.visible === false) {
                continue;
            }
            if (e.type === "DROP_SHADOW") {
                var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
                var ox = e.offset ? e.offset.x : 0;
                var oy = e.offset ? e.offset.y : 0;
                // AE direction: degrees clockwise from "up". Effects are applied before the
                // layer's own rotation/scale, so undo those to keep the Figma screen offset.
                var dir = Math.atan2(ox, -oy) * 180 / Math.PI - d.rotation;
                fx.property("ADBE Drop Shadow-0001").setValue(rgb(e.color));
                fx.property("ADBE Drop Shadow-0002").setValue(e.color.a * 255);
                fx.property("ADBE Drop Shadow-0003").setValue(dir);
                fx.property("ADBE Drop Shadow-0004").setValue(Math.sqrt(ox * ox + oy * oy) / s);
                fx.property("ADBE Drop Shadow-0005").setValue(e.radius / s);
                if (e.spread) {
                    this.warn(node, "drop shadow spread (" + e.spread + ") is not supported");
                }
                this.stats.effects++;
            } else if (e.type === "LAYER_BLUR") {
                if (e.blurType === "PROGRESSIVE") {
                    this.warn(node, "progressive blur imported as a uniform Gaussian Blur");
                }
                var blur = layer.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
                blur.property("ADBE Gaussian Blur 2-0001").setValue(e.radius / s);
                this.stats.effects++;
            } else {
                this.warn(node, "effect " + e.type + " is not supported");
            }
        }
    };

    // ---------------- hierarchy ----------------

    Importer.prototype.buildChildren = function (node, ctx) {
        var rendered = [];
        var mask = null;
        var children = node.children || [];
        for (var k = 0; k < children.length; k++) {
            var child = children[k];
            var res = this.buildNode(child, ctx);
            if (child.isMask) {
                if (res.matte) {
                    mask = { layer: res.matte, node: child, used: false };
                } else {
                    mask = null;
                    this.warn(child, "mask could not be converted to a track matte (it is not a single layer)");
                }
                continue;
            }
            if (mask) {
                for (var j = 0; j < res.layers.length; j++) {
                    this.applyMatte(res.layers[j], mask);
                }
            }
            for (var n = 0; n < res.layers.length; n++) {
                rendered.push(res.layers[n]);
            }
        }
        return rendered;
    };

    Importer.prototype.applyMatte = function (layer, mask) {
        if (typeof TrackMatteType === "undefined" || typeof layer.setTrackMatte !== "function") {
            if (!mask.warned) {
                this.warn(mask.node, "mask needs After Effects 2023+ (Layer.setTrackMatte); content left unmasked");
                mask.warned = true;
            }
            return;
        }
        var type = mask.node.maskType === "LUMINANCE" ? TrackMatteType.LUMA : TrackMatteType.ALPHA;
        layer.setTrackMatte(mask.layer, type);
        mask.layer.enabled = false;
    };

    Importer.prototype.buildNode = function (node, ctx) {
        var kind = node.kind;
        var layer;
        if (kind === "group" || kind === "frame") {
            return this.options.precomps ? this.buildPrecomp(node, ctx) : this.buildNull(node, ctx);
        }
        if (kind === "rect" || kind === "ellipse" || kind === "line" || kind === "polystar" || kind === "vector") {
            if (node.image) {
                return this.buildImageNode(node, ctx);
            }
            layer = this.buildShapeLayer(node, ctx, { fills: true, strokes: true, geometry: kind, effects: true });
            return { layers: [layer], matte: layer };
        }
        if (kind === "text") {
            layer = this.buildText(node, ctx);
            return { layers: [layer], matte: layer };
        }
        this.unsupported.push(node.name + " (" + node.type + ")");
        return { layers: [], matte: null };
    };

    Importer.prototype.buildNull = function (node, ctx) {
        var nl = ctx.comp.layers.addNull();
        this.stats.nulls++;
        this.setTransform(nl, this.rel(node, ctx), 0, 0, 0, 0, 1, 1);
        nl.name = node.name;
        try {
            nl.outPoint = ctx.comp.duration;
        } catch (e) {}
        if (ctx.parentLayer) {
            nl.parent = ctx.parentLayer;
        }
        this.stats.layers++;

        if (node.blendMode && node.blendMode !== "NORMAL" && node.blendMode !== "PASS_THROUGH") {
            this.warn(node, "group blend mode " + node.blendMode + " needs precomp mode");
        }
        if (node.kind === "frame" && node.clipsContent && this.overflows(node)) {
            this.warn(node, "frame clips its content; clipping is only reproduced in precomp mode");
        }
        var childCtx = {
            comp: ctx.comp,
            containerAbs: ctx.containerAbs,
            parentLayer: nl,
            opacity: ctx.opacity * node.opacity,
            visible: ctx.visible && node.visible !== false
        };
        var layers;
        if (node.kind === "frame") {
            layers = this.buildFrameBody(node, childCtx, true);
        } else {
            if (node.effects && visibleCount(node.effects) > 0) {
                this.warn(node, "effects on groups are only reproduced in precomp mode");
            }
            layers = node.renderChildren === false ? [] : this.buildChildren(node, childCtx);
        }
        return { layers: layers, matte: layers.length === 1 ? layers[0] : null };
    };

    Importer.prototype.buildPrecomp = function (node, ctx) {
        var pc = app.project.items.addComp(node.name, clampCompSize(node.width), clampCompSize(node.height), 1, COMP_DURATION, COMP_FPS);
        pc.parentFolder = this.projectFolder;
        this.stats.comps++;
        this.stats.precomps++;

        var layer = ctx.comp.layers.add(pc);
        this.setTransform(layer, this.rel(node, ctx), 0, 0, 0, 0, 1, 1);
        this.finishLayer(layer, node, ctx, { effects: true });
        // Groups never clip in Figma; frames clip only when clipsContent is on.
        layer.collapseTransformation = !(node.kind === "frame" && node.clipsContent);

        var childCtx = { comp: pc, containerAbs: node.absoluteTransform, parentLayer: null, opacity: 1, visible: true };
        if (node.kind === "frame") {
            this.buildFrameBody(node, childCtx, false);
        } else {
            this.buildChildren(node, childCtx);
        }
        return { layers: [layer], matte: layer };
    };

    // Frame = background (fills) + children + stroke on top (Figma draws frame strokes above content).
    Importer.prototype.buildFrameBody = function (node, ctx, effectsOnBackground) {
        var layers = [];
        var bg = null;
        if (visiblePaints(node.fills).length) {
            if (node.image) {
                bg = this.buildImageLayer(node, ctx, { part: true, name: node.name + " (background)", effects: effectsOnBackground });
            } else {
                bg = this.buildShapeLayer(node, ctx, { fills: true, strokes: false, geometry: "rect", part: true, name: node.name + " (background)", effects: effectsOnBackground });
            }
            layers.push(bg);
        }
        if (effectsOnBackground && !bg && node.effects && visibleCount(node.effects) > 0) {
            this.warn(node, "frame effects without a background fill are only reproduced in precomp mode");
        }
        var kids = this.buildChildren(node, ctx);
        for (var k = 0; k < kids.length; k++) {
            layers.push(kids[k]);
        }
        if (visiblePaints(node.strokes).length && node.strokeWeight > 0) {
            layers.push(this.buildShapeLayer(node, ctx, { fills: false, strokes: true, geometry: "rect", part: true, name: node.name + " (stroke)" }));
        }
        return layers;
    };

    // True when any child's box reaches outside the frame's box.
    Importer.prototype.overflows = function (frame) {
        var inv = mInv(frame.absoluteTransform);
        var kids = frame.children || [];
        for (var k = 0; k < kids.length; k++) {
            var M = mMul(inv, kids[k].absoluteTransform);
            var w = kids[k].width, h = kids[k].height;
            var corners = [mApply(M, 0, 0), mApply(M, w, 0), mApply(M, w, h), mApply(M, 0, h)];
            for (var c = 0; c < 4; c++) {
                if (corners[c][0] < -0.5 || corners[c][1] < -0.5 || corners[c][0] > frame.width + 0.5 || corners[c][1] > frame.height + 0.5) {
                    return true;
                }
            }
        }
        return false;
    };

    // ---------------- shapes ----------------

    function addGroup(contents, name) {
        var g = contents.addProperty("ADBE Vector Group");
        g.name = name;
        return g.property("ADBE Vectors Group");
    }

    function addRectPrim(gc, w, h, roundness) {
        var p = gc.addProperty("ADBE Vector Shape - Rect");
        p.property("ADBE Vector Rect Size").setValue([Math.max(0, w), Math.max(0, h)]);
        p.property("ADBE Vector Rect Position").setValue([0, 0]);
        p.property("ADBE Vector Rect Roundness").setValue(Math.max(0, roundness));
    }

    function addEllipsePrim(gc, w, h) {
        var p = gc.addProperty("ADBE Vector Shape - Ellipse");
        p.property("ADBE Vector Ellipse Size").setValue([Math.max(0, w), Math.max(0, h)]);
        p.property("ADBE Vector Ellipse Position").setValue([0, 0]);
    }

    function addPathPrim(gc, sub) {
        var p = gc.addProperty("ADBE Vector Shape - Group");
        var s = new Shape();
        s.vertices = sub.v;
        s.inTangents = sub.i;
        s.outTangents = sub.o;
        s.closed = sub.closed;
        p.property("ADBE Vector Shape").setValue(s);
    }

    function addOffsetPaths(gc, amount, join) {
        var p = gc.addProperty("ADBE Vector Filter - Offset");
        p.property("ADBE Vector Offset Amount").setValue(amount);
        p.property("ADBE Vector Offset Line Join").setValue(join);
    }

    function addSolidFill(gc, color, opacity, evenOdd) {
        var f = gc.addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(rgb(color));
        f.property("ADBE Vector Fill Opacity").setValue(Math.max(0, Math.min(100, opacity * 100)));
        f.property("ADBE Vector Fill Rule").setValue(evenOdd ? 2 : 1);
    }

    function addSolidStroke(gc, color, opacity, width, cap, join) {
        var s = gc.addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(rgb(color));
        s.property("ADBE Vector Stroke Opacity").setValue(Math.max(0, Math.min(100, opacity * 100)));
        s.property("ADBE Vector Stroke Width").setValue(width);
        s.property("ADBE Vector Stroke Line Cap").setValue(cap);
        s.property("ADBE Vector Stroke Line Join").setValue(join);
    }

    // Vector paths of a node, centred on the node's box (AE layer origin = box centre).
    Importer.prototype.vectorSubpaths = function (node, forFill) {
        var out = [];
        var paths = node.vectorPaths || [];
        var cx = node.width / 2, cy = node.height / 2;
        var self = this;
        for (var k = 0; k < paths.length; k++) {
            if (forFill && paths[k].windingRule === "NONE") {
                continue;
            }
            var subs;
            try {
                subs = parseSvgPath(paths[k].data, function (m) { self.warn(node, m); });
            } catch (e) {
                this.warn(node, "could not parse vector path: " + e.message);
                continue;
            }
            for (var s = 0; s < subs.length; s++) {
                var sub = subs[s];
                for (var v = 0; v < sub.v.length; v++) {
                    sub.v[v] = [sub.v[v][0] - cx, sub.v[v][1] - cy];
                }
                out.push(sub);
            }
        }
        return out;
    };

    // Adds the node's outline to a group. offset > 0 grows it (outside stroke),
    // offset < 0 shrinks it (inside stroke). Primitives are resized; paths get Offset Paths.
    Importer.prototype.addGeometry = function (gc, node, geometry, offset, forFill) {
        var w = node.width, h = node.height;
        var join = JOIN_MAP[node.strokeJoin] || 1;
        var k;
        if (geometry === "rect") {
            var radii = node.cornerRadii || [0, 0, 0, 0];
            if (node.cornerRadius !== null && node.cornerRadius !== undefined) {
                var r = node.cornerRadius;
                addRectPrim(gc, w + 2 * offset, h + 2 * offset, r > 0 ? r + offset : 0);
            } else {
                addPathPrim(gc, roundedRectPath(w, h, radii));
                if (offset) {
                    addOffsetPaths(gc, offset, join);
                }
            }
        } else if (geometry === "ellipse") {
            addEllipsePrim(gc, w + 2 * offset, h + 2 * offset);
        } else if (geometry === "polystar") {
            var ps = node.polystar || { starType: "polygon", pointCount: 3, innerRadius: 0.5 };
            var isStar = ps.starType === "star";
            var outer = 100;
            var inner = outer * (isStar ? ps.innerRadius : 0.5);
            var b = polystarBounds(isStar, ps.pointCount, outer, inner);
            // Figma stretches polygons/stars to fill their box; AE draws them on a circle.
            // Scale the primitive in a nested group so outer strokes are not distorted.
            var ng = gc.addProperty("ADBE Vector Group");
            ng.name = "Polystar";
            var star = ng.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Star");
            star.property("ADBE Vector Star Type").setValue(isStar ? 1 : 2);
            star.property("ADBE Vector Star Points").setValue(ps.pointCount);
            star.property("ADBE Vector Star Position").setValue([0, 0]);
            star.property("ADBE Vector Star Rotation").setValue(0);
            star.property("ADBE Vector Star Outer Radius").setValue(outer);
            if (isStar) {
                star.property("ADBE Vector Star Inner Radius").setValue(inner);
            }
            var tg = ng.property("ADBE Vector Transform Group");
            tg.property("ADBE Vector Anchor").setValue([b.x + b.w / 2, b.y + b.h / 2]);
            tg.property("ADBE Vector Position").setValue([0, 0]);
            tg.property("ADBE Vector Scale").setValue([b.w > 0 ? w / b.w * 100 : 100, b.h > 0 ? h / b.h * 100 : 100]);
            if (offset) {
                addOffsetPaths(gc, offset, join);
            }
        } else if (geometry === "line") {
            addPathPrim(gc, { v: [[-w / 2, 0], [w / 2, 0]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], closed: false });
        } else {
            var subs = this.vectorSubpaths(node, forFill);
            for (k = 0; k < subs.length; k++) {
                addPathPrim(gc, subs[k]);
            }
            if (offset && subs.length) {
                addOffsetPaths(gc, offset, join);
            }
        }
    };

    Importer.prototype.fillRuleEvenOdd = function (node) {
        var paths = node.vectorPaths || [];
        for (var k = 0; k < paths.length; k++) {
            if (paths[k].windingRule === "EVENODD") {
                return true;
            }
        }
        return false;
    };

    Importer.prototype.addFillPaint = function (gc, paint, node) {
        var evenOdd = this.fillRuleEvenOdd(node);
        if (paint.type === "SOLID") {
            addSolidFill(gc, paint.color, paint.opacity * paint.color.a, evenOdd);
            return;
        }
        if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") {
            var gf = gc.addProperty("ADBE Vector Graphic - G-Fill");
            var w = node.width, h = node.height;
            var hs = paint.gradientHandles || { start: [0, 0.5], end: [1, 0.5] };
            gf.property("ADBE Vector Grad Type").setValue(paint.type === "GRADIENT_RADIAL" ? 2 : 1);
            gf.property("ADBE Vector Grad Start Pt").setValue([hs.start[0] * w - w / 2, hs.start[1] * h - h / 2]);
            gf.property("ADBE Vector Grad End Pt").setValue([hs.end[0] * w - w / 2, hs.end[1] * h - h / 2]);
            gf.property("ADBE Vector Fill Opacity").setValue(paint.opacity * 100);
            gf.property("ADBE Vector Fill Rule").setValue(evenOdd ? 2 : 1);
            try {
                gf.property("ADBE Vector Grad Colors").setValue(gradientColorArray(paint.gradientStops));
                return;
            } catch (e) {
                gf.remove();
            }
            var first = paintColor(paint);
            addSolidFill(gc, first, paint.opacity * first.a, evenOdd);
            this.warn(node, "gradient colours can't be set by script; used the first stop colour (" + colorHex(first) + ")");
            return;
        }
        var c = paintColor(paint);
        addSolidFill(gc, c, paint.opacity * c.a, evenOdd);
        this.warn(node, paint.type + " fill is not supported; used " + (paint.gradientStops ? "the first stop colour" : "black"));
    };

    function gradientColorArray(stops) {
        // [pos, r, g, b, ...] followed by [pos, alpha, ...] - the layout AE uses internally.
        var out = [];
        var k;
        for (k = 0; k < stops.length; k++) {
            out.push(stops[k].position, stops[k].color.r, stops[k].color.g, stops[k].color.b);
        }
        for (k = 0; k < stops.length; k++) {
            out.push(stops[k].position, stops[k].color.a);
        }
        return out;
    }

    function colorHex(c) {
        function h(v) {
            var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
            return s.length < 2 ? "0" + s : s;
        }
        return "#" + h(c.r) + h(c.g) + h(c.b);
    }

    // One shape layer per Figma node. Each paint gets its own group (strokes on top),
    // so multiple fills/strokes stack in Figma's order.
    Importer.prototype.buildShapeLayer = function (node, ctx, opts) {
        var layer = ctx.comp.layers.addShape();
        this.stats.shapes++;
        var geometry = opts.geometry;
        var k;
        var gc;

        if (opts.strokes) {
            var strokes = visiblePaints(node.strokes);
            var sw = node.strokeWeight || 0;
            if (node.strokeWeights) {
                this.warn(node, "per-side stroke weights are not supported; used " + sw + "px on all sides");
            }
            if (node.dashPattern && node.dashPattern.length) {
                this.warn(node, "dashed strokes are imported as solid");
            }
            var offset = 0;
            var closed = geometry !== "line";
            if (closed && node.strokeAlign === "INSIDE") {
                offset = -sw / 2;
            } else if (closed && node.strokeAlign === "OUTSIDE") {
                offset = sw / 2;
            }
            var cap = CAP_MAP[node.strokeCap] || 1;
            if (node.strokeCap && node.strokeCap.indexOf("ARROW") === 0) {
                this.warn(node, "arrow stroke caps are imported as butt caps");
            }
            if (sw > 0) {
                for (k = strokes.length - 1; k >= 0; k--) {
                    var sp = strokes[k];
                    gc = addGroup(layer.property("ADBE Root Vectors Group"), "Stroke " + (k + 1));
                    this.addGeometry(gc, node, geometry, offset, false);
                    var sc = paintColor(sp);
                    if (sp.type !== "SOLID") {
                        this.warn(node, sp.type + " stroke is not supported; used the first stop colour (" + colorHex(sc) + ")");
                    }
                    addSolidStroke(gc, sc, sp.opacity * sc.a, sw, cap, JOIN_MAP[node.strokeJoin] || 1);
                }
            }
        }

        // Open vector paths (winding rule NONE) are never filled.
        var canFill = geometry !== "line" && (geometry !== "vector" || this.vectorSubpaths(node, true).length > 0);
        if (opts.fills && canFill) {
            var fills = visiblePaints(node.fills);
            for (k = fills.length - 1; k >= 0; k--) {
                if (fills[k].type === "IMAGE" || fills[k].type === "VIDEO" || fills[k].type === "PATTERN") {
                    if (fills[k].type !== "IMAGE") {
                        this.warn(node, fills[k].type + " fill is not supported");
                    }
                    continue;
                }
                gc = addGroup(layer.property("ADBE Root Vectors Group"), "Fill " + (k + 1));
                this.addGeometry(gc, node, geometry, 0, true);
                this.addFillPaint(gc, fills[k], node);
            }
        }

        if (geometry === "polystar" && node.cornerRadius) {
            this.warn(node, "polygon/star corner radius is not supported");
        }

        this.setTransform(layer, this.rel(node, ctx), node.width / 2, node.height / 2, 0, 0, 1, 1);
        this.finishLayer(layer, node, ctx, { part: opts.part, name: opts.name, effects: opts.effects });
        return layer;
    };

    // ---------------- images ----------------

    Importer.prototype.importFootage = function (relPath) {
        if (this.footageCache[relPath]) {
            return this.footageCache[relPath];
        }
        var f = new File(this.folder.fsName + "/" + relPath);
        if (!f.exists) {
            return null;
        }
        var item = app.project.importFile(new ImportOptions(f));
        item.parentFolder = this.projectFolder;
        this.footageCache[relPath] = item;
        this.stats.footage++;
        return item;
    };

    Importer.prototype.buildImageLayer = function (node, ctx, opts) {
        var footage = this.importFootage(node.image.file);
        if (!footage) {
            this.warn(node, "image " + node.image.file + " is missing; drew the shape without its image");
            return null;
        }
        var layer = ctx.comp.layers.add(footage);
        this.stats.images++;
        var fw = footage.width, fh = footage.height;
        if (node.image.baked && node.absoluteBoundingBox) {
            // Rendered-on-canvas export: axis-aligned, rotation/effects already in the pixels.
            var bb = node.absoluteBoundingBox;
            var M = mMul(mInv(ctx.containerAbs), mTranslate(bb.x, bb.y));
            this.setTransform(layer, M, bb.width / 2, bb.height / 2, fw / 2, fh / 2, bb.width / fw, bb.height / fh);
            this.warn(node, "image was exported with rotation/effects baked in");
            this.finishLayer(layer, node, ctx, { part: opts.part, name: opts.name, effects: false });
        } else {
            // Clean @2x export of the fills: scale = width / pixels (50% for @2x).
            var ex = fw > 0 ? node.width / fw : 1 / node.image.scale;
            var ey = fh > 0 ? node.height / fh : 1 / node.image.scale;
            this.setTransform(layer, this.rel(node, ctx), node.width / 2, node.height / 2, fw / 2, fh / 2, ex, ey);
            this.finishLayer(layer, node, ctx, { part: opts.part, name: opts.name, effects: opts.effects, extraScale: (ex + ey) / 2 });
        }
        return layer;
    };

    Importer.prototype.buildImageNode = function (node, ctx) {
        var layers = [];
        var img = this.buildImageLayer(node, ctx, { effects: true });
        if (!img) {
            var fallback = this.buildShapeLayer(node, ctx, { fills: true, strokes: true, geometry: node.kind, effects: true });
            return { layers: [fallback], matte: fallback };
        }
        layers.push(img);
        if (visiblePaints(node.strokes).length && node.strokeWeight > 0 && !node.image.baked) {
            layers.push(this.buildShapeLayer(node, ctx, { fills: false, strokes: true, geometry: node.kind, name: node.name + " (stroke)" }));
        }
        return { layers: layers, matte: img };
    };

    // ---------------- text ----------------

    function normFont(s) {
        return String(s).toLowerCase().replace(/[\s_\-]+/g, "");
    }

    Importer.prototype.resolveFont = function (fontName, node) {
        var family = fontName.family, style = fontName.style;
        var key = family + "|" + style;
        if (this.fontCache[key] !== undefined) {
            return this.fontCache[key];
        }
        var ps = null;
        var hasFontApi = false;
        try {
            if (app.fonts) {
                hasFontApi = true;
                if (typeof app.fonts.getFontsByFamilyNameAndStyleName === "function") {
                    ps = pickFont(app.fonts.getFontsByFamilyNameAndStyleName(family, style));
                }
                if (!ps && app.fonts.allFonts) {
                    ps = scanFonts(app.fonts.allFonts, family, style);
                }
            }
        } catch (e) {}
        if (!ps && !hasFontApi) {
            // AE < 24 has no font API: guess the usual PostScript name ("Inter-Bold").
            ps = (family + "-" + style).replace(/\s+/g, "");
        }
        if (!ps) {
            // Keep the weight/slant so "bold" or italic text stays visibly different.
            var fb = arialFallback(style);
            this.warn(node, "font \"" + family + " " + style + "\" is not installed; using " + fb.label);
            ps = fb.ps;
        }
        this.fontCache[key] = ps;
        return ps;
    };

    function arialFallback(style) {
        var s = String(style || "").toLowerCase();
        var bold = /(semi|demi|extra|ultra)?\s*bold|black|heavy/.test(s);
        var italic = /italic|oblique/.test(s);
        if (bold && italic) {
            return { ps: "Arial-BoldItalicMT", label: "Arial Bold Italic" };
        }
        if (bold) {
            return { ps: "Arial-BoldMT", label: "Arial Bold" };
        }
        if (italic) {
            return { ps: "Arial-ItalicMT", label: "Arial Italic" };
        }
        return { ps: "ArialMT", label: "Arial" };
    }

    function pickFont(list) {
        if (!list || !list.length) {
            return null;
        }
        for (var k = 0; k < list.length; k++) {
            if (!list[k].isSubstitute) {
                return list[k].postScriptName;
            }
        }
        return null;
    }

    function scanFonts(groups, family, style) {
        var nf = normFont(family), ns = normFont(style);
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            for (var k = 0; k < group.length; k++) {
                var f = group[k];
                if (!f.isSubstitute && normFont(f.familyName) === nf && normFont(f.styleName) === ns) {
                    return f.postScriptName;
                }
            }
        }
        return null;
    }

    function lineHeightPx(lh, fontSize) {
        if (!lh || lh.unit === "AUTO") {
            return null;
        }
        if (lh.unit === "PERCENT") {
            return lh.value / 100 * fontSize;
        }
        return lh.value;
    }

    function trackingFor(ls, fontSize) {
        if (!ls || !ls.value) {
            return 0;
        }
        if (ls.unit === "PERCENT") {
            return Math.round(ls.value * 10); // % of font size -> 1/1000 em
        }
        // AE only accepts whole numbers for tracking ("... is not an integer").
        return Math.round(ls.value / fontSize * 1000);
    }

    function segmentColor(seg) {
        var fills = visiblePaints(seg.fills);
        if (!fills.length) {
            return null;
        }
        var c = paintColor(fills[0]);
        return { r: c.r, g: c.g, b: c.b, a: c.a * fills[0].opacity };
    }

    var JUSTIFY = { LEFT: "LEFT_JUSTIFY", CENTER: "CENTER_JUSTIFY", RIGHT: "RIGHT_JUSTIFY", JUSTIFIED: "FULL_JUSTIFY_LASTLINE_LEFT" };

    // Estimated distance from the top of the Figma text box to the first baseline.
    // Figma centres the font's natural line box (~1.2em, ascent ~0.95em) in the line height.
    function firstBaseline(fontSize, lh) {
        var L = lineHeightPx(lh, fontSize);
        if (L === null) {
            L = 1.2 * fontSize;
        }
        return (L - 1.2 * fontSize) / 2 + 0.95 * fontSize;
    }

    Importer.prototype.buildText = function (node, ctx) {
        var t = node.text;
        var segs = t.segments && t.segments.length ? t.segments : [];
        var chars = t.characters.replace(/\r\n|\n|\r|\u2028|\u2029/g, "\r");
        if (t.textCase === "LOWER") {
            chars = chars.toLowerCase();
        }
        var isBox = t.textAutoResize !== "WIDTH_AND_HEIGHT";
        var maxFs = t.fontSize;
        var k;
        for (k = 0; k < segs.length; k++) {
            maxFs = Math.max(maxFs, segs[k].fontSize);
        }
        var w = node.width, h = node.height;
        var align = t.textAlignHorizontal || "LEFT";
        var alignFrac = align === "CENTER" ? 0.5 : (align === "RIGHT" ? 1 : 0);
        var slack = 2; // a little extra width so AE's metrics don't wrap lines Figma kept
        var vAlign = t.textAlignVertical || "TOP";
        var bw = w + slack;
        var bh = h + ((vAlign === "TOP" && t.textAutoResize !== "TRUNCATE") ? maxFs : 0);

        var layer = isBox ? ctx.comp.layers.addBoxText([bw, bh], chars) : ctx.comp.layers.addText(chars);
        this.stats.texts++;
        var tp = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var td = tp.value;
        var fill = t.fill || { r: 0, g: 0, b: 0, a: 1 };

        td.font = this.resolveFont(t.fontName, node);
        td.fontSize = t.fontSize;
        td.applyFill = true;
        td.fillColor = rgb(fill);
        td.applyStroke = false;
        td.tracking = trackingFor(t.letterSpacing, t.fontSize);
        var L = lineHeightPx(t.lineHeight, t.fontSize);
        try {
            if (L === null) {
                td.autoLeading = true;
            } else {
                td.autoLeading = false;
                td.leading = L;
            }
        } catch (e) {
            if (L !== null) {
                this.warn(node, "could not set leading");
            }
        }
        var just = JUSTIFY[align] || "LEFT_JUSTIFY";
        td.justification = ParagraphJustification[just];
        if (t.textCase === "UPPER") {
            td.allCaps = true;
        } else if (t.textCase === "SMALL_CAPS" || t.textCase === "SMALL_CAPS_FORCED") {
            td.smallCaps = true;
        } else if (t.textCase === "TITLE") {
            this.warn(node, "title case is not supported; text kept as typed");
        }
        if (t.textDecoration && t.textDecoration !== "NONE") {
            this.warn(node, "text decoration " + t.textDecoration + " is not supported");
        }
        if (t.paragraphSpacing) {
            this.warn(node, "paragraph spacing is not supported");
        }
        if (isBox && vAlign !== "TOP") {
            if (typeof BoxVerticalAlignment !== "undefined" && BoxVerticalAlignment[vAlign] !== undefined) {
                td.boxVerticalAlignment = BoxVerticalAlignment[vAlign];
            } else {
                this.warn(node, "vertical alignment " + vAlign + " is not supported by this AE version");
            }
        }
        tp.setValue(td);

        if (t.mixed && segs.length > 1) {
            this.applySegments(tp, node, segs);
        }

        // Opacity of the text fill becomes layer opacity (AE text colour has no alpha).
        var opacityMul = fill.a === undefined ? 1 : fill.a;

        if (isBox) {
            td = tp.value;
            var box = td.boxTextPos;
            if (!box || box.length < 2) {
                box = [-bw / 2, -bh / 2];
            }
            var lead = L === null ? 0 : (L - 1.2 * t.fontSize) / 2;
            this.setTransform(layer, this.rel(node, ctx), -slack * alignFrac, lead, box[0], box[1], 1, 1);
        } else {
            this.setTransform(layer, this.rel(node, ctx), w * alignFrac, firstBaseline(maxFs, t.lineHeight), 0, 0, 1, 1);
        }
        this.finishLayer(layer, node, ctx, { effects: true, opacityMul: opacityMul });
        return layer;
    };

    Importer.prototype.applySegments = function (tp, node, segs) {
        var td = tp.value;
        if (typeof td.characterRange !== "function") {
            this.warn(node, "mixed text styles need After Effects 24.3+; used the first style for all text");
            return;
        }
        var alphaWarned = false;
        for (var k = 0; k < segs.length; k++) {
            var seg = segs[k];
            if (seg.end <= seg.start) {
                continue;
            }
            var cr = td.characterRange(seg.start, seg.end);
            cr.font = this.resolveFont(seg.fontName, node);
            cr.fontSize = seg.fontSize;
            cr.tracking = trackingFor(seg.letterSpacing, seg.fontSize);
            var c = segmentColor(seg);
            if (c) {
                cr.applyFill = true;
                cr.fillColor = rgb(c);
                if (c.a < 0.999 && !alphaWarned) {
                    this.warn(node, "per-character fill opacity is not supported");
                    alphaWarned = true;
                }
            }
            var L = lineHeightPx(seg.lineHeight, seg.fontSize);
            try {
                if (L === null) {
                    cr.autoLeading = true;
                } else {
                    cr.autoLeading = false;
                    cr.leading = L;
                }
            } catch (e) {}
            if (seg.textCase === "UPPER") {
                cr.allCaps = true;
            }
        }
        tp.setValue(td);
    };

    // ------------------------------------------------------------------
    // Public entry point
    // ------------------------------------------------------------------

    function canWriteFiles() {
        try {
            return app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY") === 1;
        } catch (e) {
            return false;
        }
    }

    function summaryText(importer, comp, logPath) {
        var s = importer.stats;
        var lines = [];
        lines.push("Figma import finished: \"" + comp.name + "\" (" + comp.width + " x " + comp.height + ", " + COMP_FPS + " fps, " + COMP_DURATION + " s)");
        lines.push("Layers created: " + s.layers + "  (shapes " + s.shapes + ", text " + s.texts + ", images " + s.images + ", nulls " + s.nulls + ", precomps " + s.precomps + ")");
        lines.push("Effects: " + s.effects + "   Footage items: " + s.footage);
        lines.push("Warnings: " + importer.warnings.length);
        lines.push("Unsupported nodes: " + importer.unsupported.length);
        if (logPath) {
            lines.push("Full log: " + logPath);
        }
        return lines.join("\n");
    }

    function detailText(importer) {
        var lines = [];
        var k;
        if (importer.warnings.length) {
            lines.push("", "Warnings:");
            for (k = 0; k < importer.warnings.length; k++) {
                lines.push("  - " + importer.warnings[k]);
            }
        }
        if (importer.unsupported.length) {
            lines.push("", "Unsupported nodes (skipped):");
            for (k = 0; k < importer.unsupported.length; k++) {
                lines.push("  - " + importer.unsupported[k]);
            }
        }
        return lines.join("\n");
    }

    function writeLog(folder, text) {
        var f = new File(folder.fsName + "/" + LOG_FILE_NAME);
        f.encoding = "UTF-8";
        if (!f.open("w")) {
            return null;
        }
        f.write(text);
        f.close();
        return f.fsName;
    }

    // options: { precomps: bool, writeLog: bool, showSummary: bool }
    function importFolder(folder, options) {
        options = options || {};
        var importer = new Importer(folder, options);
        var comp = null;
        var error = null;
        app.beginUndoGroup("Import Figma Export");
        try {
            comp = importer.run();
        } catch (e) {
            error = e;
        } finally {
            app.endUndoGroup();
        }
        if (error) {
            if (options.showSummary) {
                alert("Figma import failed:\n" + (error.message || error), "Figma -> AE", true);
            }
            return { ok: false, error: String(error.message || error), importer: importer };
        }

        var details = detailText(importer);
        var logPath = null;
        if (options.writeLog) {
            if (canWriteFiles()) {
                logPath = writeLog(folder, summaryText(importer, comp, null) + "\n" + details + "\n");
            } else {
                importer.warnings.push("log not written: enable Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network");
                details = detailText(importer);
            }
        }
        var summary = summaryText(importer, comp, logPath);
        try {
            $.writeln(summary + "\n" + details);
        } catch (e2) {}
        if (options.showSummary) {
            var shown = details.split("\n");
            if (shown.length > 25) {
                shown = shown.slice(0, 25);
                shown.push("  ... (see log for the rest)");
            }
            alert(summary + "\n" + shown.join("\n"), "Figma -> AE");
        }
        return {
            ok: true,
            comp: comp,
            stats: importer.stats,
            warnings: importer.warnings,
            unsupported: importer.unsupported,
            summary: summary,
            logPath: logPath
        };
    }


    // ------------------------------------------------------------------
    // Clipboard import: "Copy for After Effects" in the Figma plugin puts the whole
    // export on the clipboard (see figma-plugin/src/clipboard.ts). We read it with
    // PowerShell (pbpaste on macOS), write scene.json + PNGs to a folder next to the
    // project (or Documents\FigmaToAE) and import that folder.
    // ------------------------------------------------------------------

    var CLIPBOARD_HEADER = "FIGMA_TO_AE_CLIPBOARD 1";
    var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function isWindows() {
        return String($.os).indexOf("Windows") >= 0;
    }

    function readClipboard() {
        var tmp = new File(Folder.temp.fsName + "/figma-to-ae-clipboard.txt");
        if (tmp.exists) {
            tmp.remove();
        }
        var cmd;
        if (isWindows()) {
            cmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command \"Get-Clipboard -Raw | Set-Content -LiteralPath '" +
                tmp.fsName.replace(/'/g, "''") + "' -Encoding ASCII -NoNewline\"";
        } else {
            cmd = "pbpaste > '" + tmp.fsName.replace(/'/g, "'\\''") + "'";
        }
        system.callSystem(cmd);
        if (!tmp.exists) {
            return "";
        }
        tmp.encoding = "UTF-8";
        tmp.open("r");
        var text = tmp.read();
        tmp.close();
        tmp.remove();
        return text;
    }

    // Returns null when the clipboard holds something else; throws when it is a
    // Figma export that got cut off.
    function parseClipboard(text) {
        if (!text || text.substr(0, CLIPBOARD_HEADER.length) !== CLIPBOARD_HEADER) {
            return null;
        }
        var lines = text.split(/\r?\n/);
        var clip = { name: "Figma", scene: null, images: [], complete: false };
        for (var k = 1; k < lines.length; k++) {
            var line = lines[k];
            if (line.indexOf("NAME ") === 0) {
                clip.name = String(parseJSON(line.substring(5)));
            } else if (line === "SCENE") {
                clip.scene = lines[++k];
            } else if (line.indexOf("IMAGE ") === 0) {
                clip.images.push({ path: line.substring(6), data: lines[++k] || "" });
            } else if (line === "END") {
                clip.complete = true;
                break;
            }
        }
        if (!clip.scene || !clip.complete) {
            throw new Error("The Figma data on the clipboard is incomplete. Copy it again in Figma.");
        }
        return clip;
    }

    function base64Decode(s) {
        var map = {};
        var k;
        for (k = 0; k < B64_CHARS.length; k++) {
            map[B64_CHARS.charAt(k)] = k;
        }
        var out = [];
        var chunk = [];
        var buf = 0, bits = 0, v;
        for (k = 0; k < s.length; k++) {
            v = map[s.charAt(k)];
            if (v === undefined) {
                continue; // padding or whitespace
            }
            buf = ((buf << 6) | v) & 0xFFFFFF;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                chunk.push(String.fromCharCode((buf >> bits) & 255));
                if (chunk.length >= 8192) {
                    out.push(chunk.join(""));
                    chunk = [];
                }
            }
        }
        out.push(chunk.join(""));
        return out.join("");
    }

    function writeFile(path, data, encoding) {
        var f = new File(path);
        f.encoding = encoding;
        if (!f.open("w")) {
            throw new Error("Could not write " + path);
        }
        f.write(data);
        f.close();
    }

    function ensureFolder(folder) {
        if (!folder.exists && !folder.create()) {
            throw new Error("Could not create folder " + folder.fsName);
        }
        return folder;
    }

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    // <project folder>\Figma Imports\<frame> <date-time>, or Documents\FigmaToAE\... when unsaved.
    function clipboardTargetFolder(name) {
        var base = app.project.file
            ? new Folder(app.project.file.parent.fsName + "/Figma Imports")
            : new Folder(Folder.myDocuments.fsName + "/FigmaToAE");
        ensureFolder(base);
        var safe = name.replace(/[^A-Za-z0-9 _\-]+/g, "_").replace(/^[\s_]+|[\s_]+$/g, "").substr(0, 60) || "Figma";
        var d = new Date();
        var stamp = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
        var folder = new Folder(base.fsName + "/" + safe + " " + stamp);
        var n = 2;
        while (folder.exists) {
            folder = new Folder(base.fsName + "/" + safe + " " + stamp + "-" + n++);
        }
        return ensureFolder(folder);
    }

    function importFromClipboard(options) {
        options = options || {};
        function fail(message) {
            if (options.showSummary) {
                alert(message, "Figma -> AE", true);
            }
            return { ok: false, error: message };
        }
        if (!canWriteFiles()) {
            return fail("Enable Edit > Preferences > Scripting & Expressions > \"Allow Scripts to Write Files and Access Network\", then try again.");
        }
        var clip;
        try {
            clip = parseClipboard(readClipboard());
        } catch (e) {
            return fail(e.message || String(e));
        }
        if (!clip) {
            return fail("No Figma export on the clipboard.\nIn Figma: select a frame, run the plugin and click \"Copy for After Effects\". Then click \"Paste from Figma\" here.");
        }
        var folder;
        try {
            folder = clipboardTargetFolder(clip.name);
            writeFile(folder.fsName + "/scene.json", clip.scene, "UTF-8");
            if (clip.images.length) {
                ensureFolder(new Folder(folder.fsName + "/images"));
            }
            for (var k = 0; k < clip.images.length; k++) {
                // Only plain file names inside images/ - never write anywhere else.
                if (!/^images\/[A-Za-z0-9_\-]+\.png$/.test(clip.images[k].path)) {
                    return fail("Unexpected image path on the clipboard: " + clip.images[k].path);
                }
                writeFile(folder.fsName + "/" + clip.images[k].path, base64Decode(clip.images[k].data), "BINARY");
            }
        } catch (e2) {
            return fail("Could not save the Figma data: " + (e2.message || e2));
        }
        var result = importFolder(folder, options);
        result.folder = folder;
        return result;
    }

    // ------------------------------------------------------------------
    // ScriptUI panel
    // ------------------------------------------------------------------

    function buildUI(host) {
        var win = (host instanceof Panel) ? host : new Window("palette", "Figma -> After Effects", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        var pasteButton = win.add("button", undefined, "Paste from Figma");
        var folderButton = win.add("button", undefined, "Import from folder...");
        var precompBox = win.add("checkbox", undefined, "Groups/frames as precomps (instead of nulls)");
        precompBox.value = false;
        var logBox = win.add("checkbox", undefined, "Write import log");
        logBox.value = true;
        var status = win.add("statictext", undefined, "In Figma click \"Copy for After Effects\", then \"Paste from Figma\" here.", { multiline: true });
        status.preferredSize = [260, 60];
        win.add("statictext", undefined, "v" + VERSION);

        function report(result) {
            status.text = result.ok
                ? "Imported " + result.stats.layers + " layers, " + result.warnings.length + " warnings."
                : "Import failed: " + result.error;
        }
        pasteButton.onClick = function () {
            report(importFromClipboard({ precomps: precompBox.value, writeLog: logBox.value, showSummary: true }));
        };
        folderButton.onClick = function () {
            var folder = Folder.selectDialog("Select the unzipped Figma export folder (contains scene.json)");
            if (!folder) {
                return;
            }
            report(importFolder(folder, { precomps: precompBox.value, writeLog: logBox.value, showSummary: true }));
        };

        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
        return win;
    }

    var api = {
        version: VERSION,
        importFolder: importFolder,
        importFromClipboard: importFromClipboard,
        parseClipboard: parseClipboard,
        base64Decode: base64Decode,
        parseJSON: parseJSON,
        parseSvgPath: parseSvgPath,
        roundedRectPath: roundedRectPath,
        polystarBounds: polystarBounds,
        mDecompose: mDecompose
    };
    $.global.FigmaToAE = api;

    if (!$.global.FIGMA_TO_AE_NO_UI) {
        buildUI(thisObj);
    }
})(this);
