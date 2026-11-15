import type { NextConfig } from "next";

// All data comes from the analysis service (FastAPI). The browser only ever calls
// relative /api/* paths; Next proxies them so there is no CORS and one origin to configure.
const ANALYSIS_API_ORIGIN = (process.env.ANALYSIS_API_ORIGIN || "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Separate build dirs let several builds run side by side (e.g. NEXT_DIST_DIR=.next-map).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${ANALYSIS_API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
