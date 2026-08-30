import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/core/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fail the build on type errors rather than shipping them. Linting is a
  // separate `npm run lint` step; Next 16 no longer runs ESLint during build.
  typescript: { ignoreBuildErrors: false },
  // A package-lock.json exists in a parent directory on this machine. Pin the
  // Turbopack workspace root to this repository so Next does not walk up to it.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
