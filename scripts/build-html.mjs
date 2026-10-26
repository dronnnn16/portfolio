// Bundles the static export (out/) into one self-contained HTML file:
// CSS, fonts, icon and JS are all inlined, so it opens straight from disk.
// Usage: npm run build:html  →  dron-portfolio.html
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "out";
const outFile = "dron-portfolio.html";
const read = (p) => readFileSync(join(root, p.replace(/^\//, "")));
const b64 = (p) => read(p).toString("base64");

let html = read("index.html").toString("utf8");

// Stylesheet → inline <style>, fonts embedded as base64
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*\/>/g, (_, href) => {
  const css = read(href)
    .toString("utf8")
    .replace(/url\((\/_next\/static\/media\/[^)]+\.woff2)\)/g, (_m, f) => `url(data:font/woff2;base64,${b64(f)})`);
  return `<style>${css}</style>`;
});
html = html.replace(/<link rel="preload"[^>]*\/>/g, "");
html = html.replace(/<link rel="icon" href="\/icon\.svg[^"]*"/, `<link rel="icon" href="data:image/svg+xml;base64,${b64("/icon.svg")}"`);

// External scripts → inline at the end of <body>, webpack runtime last
const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)]
  .map((m) => m[1])
  .filter((s) => !s.includes("polyfills"))
  .sort((a, b) => Number(a.includes("webpack-")) - Number(b.includes("webpack-")));
html = html.replace(/<script src="[^"]+"[^>]*><\/script>/g, "");
const js = srcs.map((s) => `<script>${read(s).toString("utf8").replaceAll("</script", "<\\/script")}</script>`).join("");
html = html.replace("</body>", () => `${js}</body>`);

// Embedded page data: drop font preload hints, point stylesheet refs at an empty sheet (real CSS is inlined)
html = html.replace(/:HL\[\\"\/_next\/static\/media\/[^\]]*\]\\n/g, "");
html = html.replace(/\/_next\/static\/css\/[a-z0-9]+\.css/g, "data:text/css,");

writeFileSync(outFile, html);
console.log(`${outFile} — ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
