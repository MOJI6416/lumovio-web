import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Dev-only: proxy /api to the local API. In production Traefik routes /api to the API service. */
const apiProxy = process.env.API_PROXY_TARGET;

/**
 * The Android TV app's newest release (TV document §11.1): .github/workflows/tv-app.yml commits it with this manifest into
 * public/downloads/, so a deploy follows every release and reads it here, at build time.
 */
const tvAppFile = fileURLToPath(new URL("./public/downloads/lumovio-tv.json", import.meta.url));
const tvApp = existsSync(tvAppFile) ? readFileSync(tvAppFile, "utf8") : "";
const tvAppApk = tvApp ? (JSON.parse(tvApp) as { apk: string }).apk : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const config: NextConfig = {
  output: "standalone",
  // Monorepo: trace workspace packages from the repo root so the standalone server is self-contained.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@lumovio/contracts"],
  // Posters/backdrops are served by TMDB's CDN in pre-sized variants; no image proxy on our VPS.
  images: { unoptimized: true },
  experimental: { optimizePackageImports: ["lucide-react", "radix-ui"] },
  env: { LUMOVIO_TV_APP: tvApp },
  async redirects() {
    // lumovio.app/apk — the short address to type into a TV's Downloader: the newest APK, else the page about the app.
    return [
      { source: "/apk", destination: tvAppApk ? `/${tvAppApk}` : "/android-tv", permanent: false },
    ];
  },
  async rewrites() {
    return apiProxy ? [{ source: "/api/:path*", destination: `${apiProxy}/api/:path*` }] : [];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default withNextIntl(config);
