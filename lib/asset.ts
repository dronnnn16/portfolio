// Prefix public asset paths with the base path (needed for GitHub Pages sub-path hosting).
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const asset = (path: string) => (path.startsWith("/") ? `${base}${path}` : path);
