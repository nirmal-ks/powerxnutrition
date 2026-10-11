import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

/**
 * `npm run dev` only serves its JavaScript to localhost by default. Allow this PC's own
 * network addresses too, so the site works when opened from a phone on the same Wi-Fi
 * (e.g. http://192.168.1.10:3000). Detected automatically, so a new router IP still works.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanAddresses,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost }] : [],
  },
  // products.json (first-run seed) and the catalogue snapshot are read at runtime.
  outputFileTracingIncludes: { "/**": ["./data/*.json"] },
  // PGlite ships a WebAssembly Postgres + data files; pg has optional native bits. Load both from node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "sharp"],
};

export default nextConfig;
