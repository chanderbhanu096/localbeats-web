import type { NextConfig } from "next";

// GitHub Pages serves a project repo under /<repo>/, so every asset needs that
// prefix. It appears ONLY here — everything else in the app uses relative URLs
// and inherits it, so moving to a root-served host means deleting these lines.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export: no server, no API routes. All data lives on the phone in IndexedDB.
  output: "export",
  basePath,
  // Emit out/index.html and link with trailing slashes — static hosts resolve
  // directory URLs, not extensionless files.
  trailingSlash: true,
  // Without this Turbopack walks up to /Users/main and adopts a stray lockfile there.
  turbopack: { root: __dirname },
};

export default nextConfig;
