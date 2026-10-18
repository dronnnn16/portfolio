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
    var VERSION = "1.1.1";
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
    // Transfer from the Figma plugin without files.
    //
    // "Copy for After Effects" puts the whole export on the clipboard as one ASCII
    // text block (figma-plugin/src/clipboard.ts):
    //
    //   FIGMA_TO_AE_CLIPBOARD 2          (1 = old plugin, scene not compressed)
    //   NAME "Hero"
    //   SCENEZ                           (v1: SCENE)
    //   <base64 of the deflated scene.json>   (v1: the JSON itself)
    //   IMAGE images/img_001_Photo.png
    //   <base64 PNG>
    //   END
    //
    // Main path: the user pastes it into the panel's text box (Ctrl+V). On some PCs
    // AE cannot start external programs, so reading the clipboard with PowerShell
    // ("Paste from Figma") is only a fast path. Big exports can come as the plugin's
    // ZIP instead, which this panel reads directly (no unzipping).
    // ------------------------------------------------------------------

    var CLIPBOARD_HEADER = "FIGMA_TO_AE_CLIPBOARD";
    var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var B64_MAP = null;

    function isWindows() {
        return String($.os).indexOf("Windows") >= 0;
    }

    // Fast path only: on PCs where AE may not start external programs this returns "".
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
        try {
            system.callSystem(cmd);
        } catch (e) {
            return "";
        }
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

    function trimStr(s) {
        return s.replace(/^\s+|\s+$/g, "");
    }

    // Parses the copied text. Tolerates CRLF/CR/LF, blank lines, surrounding spaces,
    // text before the header (e.g. the box hint) and data lines broken by wrapping.
    // Returns null when there is no Figma export in the text; throws when the export
    // is there but cut off or damaged.
    function parseClipboard(text) {
        text = String(text || "");
        var at = text.indexOf(CLIPBOARD_HEADER);
        if (at < 0) {
            return null;
        }
        var raw = text.substring(at).split(/\r\n|\r|\n/);
        var lines = [];
        var k;
        for (k = 0; k < raw.length; k++) {
            var t = trimStr(raw[k]);
            if (t !== "") {
                lines.push(t);
            }
        }
        var version = parseInt(trimStr(lines[0].substring(CLIPBOARD_HEADER.length)), 10);
        if (version !== 1 && version !== 2) {
            throw new Error("This Figma export needs a newer version of the After Effects panel (format " + lines[0] + ").");
        }
        function isKeyword(line) {
            return line === "SCENE" || line === "SCENEZ" || line === "END" || line.indexOf("NAME ") === 0 || line.indexOf("IMAGE ") === 0;
        }
        // A data block is every line up to the next keyword, joined back together.
        function block(start) {
            var parts = [];
            var j = start;
            while (j < lines.length && !isKeyword(lines[j])) {
                parts.push(lines[j]);
                j++;
            }
            return { data: parts.join(""), next: j };
        }
        var clip = { version: version, name: "Figma", scene: null, sceneZ: null, images: [], complete: false, length: text.length };
        k = 1;
        while (k < lines.length) {
            var line = lines[k];
            var b;
            if (line.indexOf("NAME ") === 0) {
                try {
                    clip.name = String(parseJSON(line.substring(5)));
                } catch (eName) {
                    clip.name = line.substring(5);
                }
                k++;
            } else if (line === "SCENE" || line === "SCENEZ") {
                b = block(k + 1);
                if (line === "SCENE") {
                    clip.scene = b.data;
                } else {
                    clip.sceneZ = b.data;
                }
                k = b.next;
            } else if (line.indexOf("IMAGE ") === 0) {
                b = block(k + 1);
                clip.images.push({ path: trimStr(line.substring(6)), data: b.data });
                k = b.next;
            } else if (line === "END") {
                clip.complete = true;
                break;
            } else {
                k++;
            }
        }
        if (!clip.complete || (clip.scene === null && clip.sceneZ === null)) {
            var err = new Error("The Figma data is cut off (got " + text.length + " characters, but the end is missing).");
            err.cutOff = true;
            throw err;
        }
        if (clip.sceneZ !== null) {
            clip.scene = bytesToString(inflateRaw(base64DecodeBytes(clip.sceneZ)));
        }
        if (clip.scene.charAt(0) !== "{") {
            throw new Error("The Figma data is damaged (scene is not JSON). Copy it again in Figma.");
        }
        return clip;
    }

    function base64Map() {
        if (!B64_MAP) {
            B64_MAP = {};
            for (var k = 0; k < B64_CHARS.length; k++) {
                B64_MAP[B64_CHARS.charAt(k)] = k;
            }
        }
        return B64_MAP;
    }

    // Base64 -> array of byte values. Ignores whitespace and padding.
    function base64DecodeBytes(s) {
        var map = base64Map();
        var out = [];
        var buf = 0, bits = 0, v;
        for (var k = 0; k < s.length; k++) {
            v = map[s.charAt(k)];
            if (v === undefined) {
                continue;
            }
            buf = ((buf << 6) | v) & 0xFFFFFF;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.push((buf >> bits) & 255);
            }
        }
        return out;
    }

    // Array of byte values -> "binary" string (one char per byte), for File BINARY writes.
    function bytesToString(bytes) {
        var parts = [];
        for (var k = 0; k < bytes.length; k += 4096) {
            parts.push(String.fromCharCode.apply(null, bytes.slice(k, k + 4096)));
        }
        return parts.join("");
    }

    function base64Decode(s) {
        return bytesToString(base64DecodeBytes(s));
    }

    // Raw DEFLATE (RFC 1951) decoder, after zlib's "puff". Input and output are arrays
    // of byte values. Used for the compressed scene and for deflated ZIP entries.
    var INF_LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    var INF_LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    var INF_DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    var INF_DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    var INF_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

    function inflateRaw(src) {
        var pos = 0, bitbuf = 0, bitcnt = 0;
        var out = [];

        function fail(msg) {
            throw new Error("Compressed data is damaged (" + msg + ")");
        }
        function bits(need) {
            var val = bitbuf;
            while (bitcnt < need) {
                if (pos >= src.length) {
                    fail("unexpected end");
                }
                val |= src[pos++] << bitcnt;
                bitcnt += 8;
            }
            bitbuf = val >> need;
            bitcnt -= need;
            return val & ((1 << need) - 1);
        }
        function construct(lengths, off, n) {
            var h = { count: [], symbol: [] };
            var offs = [];
            var len, sym, left;
            for (len = 0; len <= 15; len++) {
                h.count[len] = 0;
            }
            for (sym = 0; sym < n; sym++) {
                h.count[lengths[off + sym]]++;
            }
            if (h.count[0] === n) {
                return h;
            }
            left = 1;
            for (len = 1; len <= 15; len++) {
                left <<= 1;
                left -= h.count[len];
                if (left < 0) {
                    fail("over-subscribed code");
                }
            }
            offs[1] = 0;
            for (len = 1; len < 15; len++) {
                offs[len + 1] = offs[len] + h.count[len];
            }
            for (sym = 0; sym < n; sym++) {
                if (lengths[off + sym] !== 0) {
                    h.symbol[offs[lengths[off + sym]]++] = sym;
                }
            }
            return h;
        }
        function decode(h) {
            var code = 0, first = 0, index = 0, count;
            for (var len = 1; len <= 15; len++) {
                code |= bits(1);
                count = h.count[len];
                if (code - count < first) {
                    return h.symbol[index + (code - first)];
                }
                index += count;
                first += count;
                first <<= 1;
                code <<= 1;
            }
            fail("bad code");
        }
        function codes(lencode, distcode) {
            var sym, len, dist, start, k;
            while (true) {
                sym = decode(lencode);
                if (sym < 256) {
                    out.push(sym);
                } else if (sym === 256) {
                    return;
                } else {
                    sym -= 257;
                    if (sym >= 29) {
                        fail("bad length");
                    }
                    len = INF_LBASE[sym] + bits(INF_LEXT[sym]);
                    sym = decode(distcode);
                    if (sym >= 30) {
                        fail("bad distance");
                    }
                    dist = INF_DBASE[sym] + bits(INF_DEXT[sym]);
                    if (dist > out.length) {
                        fail("distance too far");
                    }
                    start = out.length - dist;
                    for (k = 0; k < len; k++) {
                        out.push(out[start + k]);
                    }
                }
            }
        }
        function stored() {
            bitbuf = 0;
            bitcnt = 0;
            if (pos + 4 > src.length) {
                fail("unexpected end");
            }
            var len = src[pos] | (src[pos + 1] << 8);
            var nlen = src[pos + 2] | (src[pos + 3] << 8);
            pos += 4;
            if (len !== (~nlen & 0xFFFF)) {
                fail("bad stored block");
            }
            if (pos + len > src.length) {
                fail("unexpected end");
            }
            for (var k = 0; k < len; k++) {
                out.push(src[pos++]);
            }
        }
        var fixedLen = null, fixedDist = null;
        function fixed() {
            if (!fixedLen) {
                var l = [];
                var s;
                for (s = 0; s < 144; s++) { l[s] = 8; }
                for (; s < 256; s++) { l[s] = 9; }
                for (; s < 280; s++) { l[s] = 7; }
                for (; s < 288; s++) { l[s] = 8; }
                fixedLen = construct(l, 0, 288);
                var d = [];
                for (s = 0; s < 30; s++) { d[s] = 5; }
                fixedDist = construct(d, 0, 30);
            }
            codes(fixedLen, fixedDist);
        }
        function dynamic() {
            var nlen = bits(5) + 257;
            var ndist = bits(5) + 1;
            var ncode = bits(4) + 4;
            var lengths = [];
            var index, sym, len;
            if (nlen > 286 || ndist > 30) {
                fail("bad counts");
            }
            for (index = 0; index < 19; index++) {
                lengths[INF_ORDER[index]] = index < ncode ? bits(3) : 0;
            }
            var lencode = construct(lengths, 0, 19);
            index = 0;
            while (index < nlen + ndist) {
                sym = decode(lencode);
                if (sym < 16) {
                    lengths[index++] = sym;
                } else {
                    len = 0;
                    if (sym === 16) {
                        if (index === 0) {
                            fail("repeat with no first length");
                        }
                        len = lengths[index - 1];
                        sym = 3 + bits(2);
                    } else if (sym === 17) {
                        sym = 3 + bits(3);
                    } else {
                        sym = 11 + bits(7);
                    }
                    if (index + sym > nlen + ndist) {
                        fail("too many lengths");
                    }
                    while (sym--) {
                        lengths[index++] = len;
                    }
                }
            }
            if (!lengths[256]) {
                fail("no end-of-block code");
            }
            codes(construct(lengths, 0, nlen), construct(lengths, nlen, ndist));
        }

        var last, type;
        do {
            last = bits(1);
            type = bits(2);
            if (type === 0) {
                stored();
            } else if (type === 1) {
                fixed();
            } else if (type === 2) {
                dynamic();
            } else {
                fail("bad block type");
            }
        } while (!last);
        return out;
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

    var SAFE_IMAGE_PATH = /^images\/[A-Za-z0-9_\-]+\.png$/;
    var WRITE_PREF_MESSAGE = "Enable Edit > Preferences > Scripting & Expressions > \"Allow Scripts to Write Files and Access Network\", then try again.";
    var NO_EXPORT_MESSAGE = "This doesn't contain a Figma export.\nIn Figma: select a frame, run the plugin and click \"Copy for After Effects\". Then click the box in this panel, press Ctrl+V and click \"Import pasted data\".";
    var CUT_OFF_HELP = "\n\nThe paste box can only hold a limited amount of text on some PCs. For this frame, click \"or download a ZIP instead\" in the Figma plugin, then \"Load Figma ZIP...\" here.";

    function failResult(options, message, extra) {
        if (options.showSummary) {
            alert(message, "Figma -> AE", true);
        }
        var r = { ok: false, error: message };
        if (extra) {
            for (var key in extra) {
                if (extra.hasOwnProperty(key)) {
                    r[key] = extra[key];
                }
            }
        }
        return r;
    }

    // Writes scene.json + images (each { path, binary }) to a new folder and imports it.
    function saveAndImport(name, sceneText, sceneEncoding, images, options) {
        var folder;
        try {
            folder = clipboardTargetFolder(name);
            writeFile(folder.fsName + "/scene.json", sceneText, sceneEncoding);
            if (images.length) {
                ensureFolder(new Folder(folder.fsName + "/images"));
            }
            for (var k = 0; k < images.length; k++) {
                writeFile(folder.fsName + "/" + images[k].path, images[k].binary, "BINARY");
            }
        } catch (e) {
            return failResult(options, "Could not save the Figma data: " + (e.message || e));
        }
        var result = importFolder(folder, options);
        result.folder = folder;
        return result;
    }

    // Paste box: import the text the user pasted into the panel.
    function importFromText(text, options) {
        options = options || {};
        if (!canWriteFiles()) {
            return failResult(options, WRITE_PREF_MESSAGE);
        }
        var clip;
        try {
            clip = parseClipboard(text);
        } catch (e) {
            return failResult(options, (e.message || String(e)) + (e.cutOff ? CUT_OFF_HELP : ""), { cutOff: !!e.cutOff });
        }
        if (!clip) {
            return failResult(options, NO_EXPORT_MESSAGE);
        }
        var images = [];
        for (var k = 0; k < clip.images.length; k++) {
            // Only plain file names inside images/ - never write anywhere else.
            if (!SAFE_IMAGE_PATH.test(clip.images[k].path)) {
                return failResult(options, "Unexpected image path in the Figma data: " + clip.images[k].path);
            }
            images.push({ path: clip.images[k].path, binary: base64Decode(clip.images[k].data) });
        }
        return saveAndImport(clip.name, clip.scene, "UTF-8", images, options);
    }

    // "Paste from Figma": try reading the clipboard directly; when this PC doesn't allow
    // it, ask for the paste box instead of claiming the clipboard is empty.
    function importFromClipboard(options) {
        options = options || {};
        if (!canWriteFiles()) {
            return failResult(options, WRITE_PREF_MESSAGE);
        }
        var text = readClipboard();
        if (!text) {
            return failResult(options,
                "After Effects can't read the clipboard on this PC.\nClick the box in this panel, press Ctrl+V, then click \"Import pasted data\".",
                { needsPasteBox: true });
        }
        return importFromText(text, options);
    }

    // --- ZIP from the plugin's "download a ZIP instead", read directly (no unzipping) ---

    function readBinaryFile(file) {
        file.encoding = "BINARY";
        if (!file.open("r")) {
            throw new Error("Could not open " + file.fsName);
        }
        var data = file.read();
        file.close();
        return data;
    }

    function u16(s, p) {
        return s.charCodeAt(p) | (s.charCodeAt(p + 1) << 8);
    }

    function u32(s, p) {
        return u16(s, p) + u16(s, p + 2) * 65536;
    }

    function stringToBytes(s, start, end) {
        var out = [];
        for (var k = start; k < end; k++) {
            out.push(s.charCodeAt(k) & 255);
        }
        return out;
    }

    // Returns [{ name, data (binary string) }] for every file in a ZIP (stored or deflated).
    function readZipEntries(data) {
        var eocd = -1;
        for (var p = data.length - 22; p >= 0 && p >= data.length - 22 - 65535; p--) {
            if (u32(data, p) === 0x06054b50) {
                eocd = p;
                break;
            }
        }
        if (eocd < 0) {
            throw new Error("This is not a ZIP file (or it is damaged).");
        }
        var count = u16(data, eocd + 10);
        var cd = u32(data, eocd + 16);
        var entries = [];
        for (var k = 0; k < count; k++) {
            if (u32(data, cd) !== 0x02014b50) {
                throw new Error("The ZIP file is damaged.");
            }
            var method = u16(data, cd + 10);
            var csize = u32(data, cd + 20);
            var nameLen = u16(data, cd + 28);
            var extraLen = u16(data, cd + 30);
            var commentLen = u16(data, cd + 32);
            var local = u32(data, cd + 42);
            var name = data.substr(cd + 46, nameLen).replace(/\\/g, "/");
            cd += 46 + nameLen + extraLen + commentLen;
            if (name.charAt(name.length - 1) === "/") {
                continue; // folder entry
            }
            var start = local + 30 + u16(data, local + 26) + u16(data, local + 28);
            var body;
            if (method === 0) {
                body = data.substr(start, csize);
            } else if (method === 8) {
                body = bytesToString(inflateRaw(stringToBytes(data, start, start + csize)));
            } else {
                throw new Error("Unsupported compression in the ZIP (" + name + ").");
            }
            entries.push({ name: name, data: body });
        }
        return entries;
    }

    function importZipFile(file, options) {
        options = options || {};
        if (!canWriteFiles()) {
            return failResult(options, WRITE_PREF_MESSAGE);
        }
        var scene = null;
        var images = [];
        try {
            var entries = readZipEntries(readBinaryFile(file));
            // Allow the files to sit inside one top folder (a re-zipped export folder).
            var prefix = null;
            var k;
            for (k = 0; k < entries.length; k++) {
                var m = /^(.*\/)?scene\.json$/.exec(entries[k].name);
                if (m) {
                    prefix = m[1] || "";
                    scene = entries[k].data;
                    break;
                }
            }
            if (prefix === null) {
                return failResult(options, "This ZIP has no scene.json. Use the ZIP made by the Figma plugin (\"or download a ZIP instead\").");
            }
            for (k = 0; k < entries.length; k++) {
                var n = entries[k].name;
                if (n.substr(0, prefix.length) === prefix && n.substr(prefix.length, 7) === "images/") {
                    var rel = n.substr(prefix.length);
                    if (!SAFE_IMAGE_PATH.test(rel)) {
                        return failResult(options, "Unexpected file in the ZIP: " + n);
                    }
                    images.push({ path: rel, binary: entries[k].data });
                }
            }
        } catch (e) {
            return failResult(options, e.message || String(e));
        }
        // scene.json bytes are copied as they are (BINARY keeps its UTF-8 intact).
        return saveAndImport(file.name.replace(/(-figma-ae)?\.zip$/i, ""), scene, "BINARY", images, options);
    }

    function downloadsFolder() {
        var home = Folder.myDocuments.parent;
        return home ? new Folder(home.fsName + "/Downloads") : null;
    }

    // ------------------------------------------------------------------
    // ScriptUI panel
    // ------------------------------------------------------------------

    var PASTE_HINT = "Click here, press Ctrl+V, then Import pasted data";

    function buildUI(host) {
        var win = (host instanceof Panel) ? host : new Window("palette", "Figma -> After Effects", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        win.add("statictext", undefined, "1. Figma: Copy for After Effects   2. Paste below (Ctrl+V)   3. Import");
        var box = win.add("edittext", undefined, PASTE_HINT, { multiline: true, scrolling: true, wantReturn: true });
        box.preferredSize = [280, 90];
        box.onActivate = function () {
            if (box.text === PASTE_HINT) {
                box.text = "";
            }
        };

        var row1 = win.add("group");
        row1.orientation = "row";
        row1.alignChildren = ["fill", "center"];
        var importButton = row1.add("button", undefined, "Import pasted data");
        var pasteButton = row1.add("button", undefined, "Paste from Figma");

        var row2 = win.add("group");
        row2.orientation = "row";
        row2.alignChildren = ["fill", "center"];
        var zipButton = row2.add("button", undefined, "Load Figma ZIP...");
        var folderButton = row2.add("button", undefined, "Import from folder...");

        var precompBox = win.add("checkbox", undefined, "Groups/frames as precomps (instead of nulls)");
        precompBox.value = false;
        var logBox = win.add("checkbox", undefined, "Write import log");
        logBox.value = true;
        var status = win.add("statictext", undefined, "Paste the Figma data into the box above.", { multiline: true });
        status.preferredSize = [280, 44];
        win.add("statictext", undefined, "v" + VERSION);

        function opts() {
            return { precomps: precompBox.value, writeLog: logBox.value, showSummary: true };
        }
        function report(result) {
            status.text = result.ok
                ? "Imported " + result.stats.layers + " layers, " + result.warnings.length + " warnings."
                : "Import failed: " + result.error.split("\n")[0];
            return result;
        }

        importButton.onClick = function () {
            var text = box.text;
            if (!text || text === PASTE_HINT) {
                status.text = "The box is empty. In Figma click \"Copy for After Effects\", then click the box and press Ctrl+V.";
                box.active = true;
                return;
            }
            status.text = "Importing " + Math.round(text.length / 1024) + " KB of Figma data...";
            if (report(importFromText(text, opts())).ok) {
                box.text = "";
            }
        };
        pasteButton.onClick = function () {
            var result = report(importFromClipboard(opts()));
            if (result.needsPasteBox) {
                status.text = "Click the box above, press Ctrl+V, then \"Import pasted data\".";
                box.active = true;
            }
        };
        zipButton.onClick = function () {
            var file;
            var dl = downloadsFolder();
            var filter = isWindows() ? "Figma export ZIP:*.zip,All files:*.*" : function (f) {
                return f instanceof Folder || /\.zip$/i.test(f.name);
            };
            if (dl && dl.exists) {
                // openDlg on a File starts the dialog in that file's folder (Downloads).
                file = new File(dl.fsName + "/figma-export.zip").openDlg("Select the ZIP from the Figma plugin", filter, false);
            } else {
                file = File.openDialog("Select the ZIP from the Figma plugin", filter, false);
            }
            if (file) {
                report(importZipFile(file, opts()));
            }
        };
        folderButton.onClick = function () {
            var folder = Folder.selectDialog("Select the unzipped Figma export folder (contains scene.json)");
            if (!folder) {
                return;
            }
            report(importFolder(folder, opts()));
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
        importFromText: importFromText,
        importFromClipboard: importFromClipboard,
        importZipFile: importZipFile,
        parseClipboard: parseClipboard,
        base64Decode: base64Decode,
        inflateRaw: inflateRaw,
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
