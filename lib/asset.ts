// Prefix public asset paths with the base path (needed for GitHub Pages sub-path hosting).
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

declare global {
  interface Window {
    // Set by the single-file build (scripts/build-html.mjs): media embedded as data URIs.
    __INLINE_ASSETS?: Record<string, string>;
  }
}

export const asset = (path: string) => {
  if (typeof window !== "undefined" && window.__INLINE_ASSETS?.[path]) return window.__INLINE_ASSETS[path];
  return path.startsWith("/") ? `${base}${path}` : path;
};
