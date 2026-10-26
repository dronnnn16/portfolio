import type { NextConfig } from "next";

// Vercel: no env needed. GitHub Pages: the workflow sets STATIC_EXPORT=true and
// NEXT_PUBLIC_BASE_PATH=/<repo> so the site is exported as static files.
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isStaticExport && {
    output: "export",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
