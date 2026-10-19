import type { NextConfig } from "next";

/** Static GitHub Pages demo is opt-in; the normal web + FastAPI configuration is unchanged. */
const isStaticDemo = process.env.NEXT_PUBLIC_DEMO === "1";
const ENGINE_URL = process.env.ENGINE_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // no floating Next.js dev badge over the console (it overlapped content and confused reviewers)
  devIndicators: false,
  // allow importing repo-root config/ (e.g. config/district.ts)
  experimental: { externalDir: true },
  // `export` has no server, route handlers, middleware or image optimizer. Keep the Docker/server
  // mode available when the public demo flag is absent.
  output: isStaticDemo ? "export" : "standalone",
  images: isStaticDemo ? { unoptimized: true } : undefined,
  trailingSlash: isStaticDemo,
  ...(isStaticDemo ? {} : {
    // Rewrites stay exclusively in the live (web + engine) build.
    async rewrites() {
      return [{ source: "/api/engine/:path*", destination: `${ENGINE_URL}/:path*` }];
    },
  }),
};

export default nextConfig;
