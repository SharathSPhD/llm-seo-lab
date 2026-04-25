import type { NextConfig } from "next";

/**
 * Minimal Next.js 15 config for the llm-seo-lab dashboard.
 *
 * - `transpilePackages` brings in `@llm-seo-lab/shared` directly from the
 *   workspace so the dashboard always sees the latest types without a publish
 *   step.
 * - `output: "standalone"` lets us ship the dashboard as a single Node bundle
 *   alongside the cli-worker daemon (so a self-host install only needs Node).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@llm-seo-lab/shared"],
  typedRoutes: false,
};

export default nextConfig;
