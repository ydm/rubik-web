import type { NextConfig } from "next";

/**
 * GitHub Pages serves a project site from `/<repository>/`, so every URL needs
 * that prefix. The deploy workflow sets `BASE_PATH` to it; leave it unset for
 * local builds and custom domains.
 */
const basePath = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");
if (basePath && !basePath.startsWith("/")) {
  throw new Error(`BASE_PATH must start with "/" (got "${basePath}")`);
}

const nextConfig: NextConfig = {
  // A static site (the `out/` folder): GitHub Pages has no server to run.
  // Custom headers can't be sent from here, so none are configured.
  output: "export",
  basePath,
  // Also exposed to the app, for paths it builds itself (worker, videos, …).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // No image optimisation without a server.
  images: { unoptimized: true },
  reactCompiler: true,
  // Allow phones / other devices on the LAN to load the dev server's
  // client assets, HMR and RSC payloads. Without this, Next 16 blocks
  // cross-origin dev requests and the page loads but never hydrates
  // (so the 3D canvas never mounts).
  allowedDevOrigins: [
    "192.168.1.2",
    "192.168.1.*",
    "192.168.0.*",
    "10.0.0.*",
  ],
};

export default nextConfig;
