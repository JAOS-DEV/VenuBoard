import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/core/i18n/request.ts");

const playwrightDistDir = process.env.VENUBOARD_PLAYWRIGHT_DIST_DIR;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fail the build on type errors rather than shipping them. Linting is a
  // separate `npm run lint` step; Next 16 no longer runs ESLint during build.
  typescript: { ignoreBuildErrors: false },
  // Local and Playwright hit the app via 127.0.0.1; Next 16 blocks that host
  // for /_next resources unless it is listed.
  allowedDevOrigins: ["127.0.0.1"],
  // A package-lock.json exists in a parent directory on this machine. Pin the
  // Turbopack workspace root to this repository so Next does not walk up to it.
  turbopack: {
    root: import.meta.dirname,
  },
  ...(playwrightDistDir !== undefined && playwrightDistDir.length > 0
    ? { distDir: playwrightDistDir }
    : {}),
};

export default withNextIntl(nextConfig);
