import { defineConfig, devices } from "@playwright/test";

import {
  TEST_APP_PORTS,
  TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN,
  TEST_PLAYWRIGHT_ORIGIN,
} from "./src/core/test-stack/identity.ts";
import { requireIsolatedTestEnv } from "./tests/e2e/helpers/isolated-env.ts";

const TEST_URL = TEST_PLAYWRIGHT_ORIGIN;
const LOCAL_DEV_URL = TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN;
const isolated = requireIsolatedTestEnv();

/**
 * End-to-end configuration.
 *
 * Chromium only. Run through `npm run test:e2e`, which injects isolated
 * venuboard-test credentials and refuses `.env.local` / port-3000 reuse.
 *
 * The default project stays on `VENUBOARD_ENV=test` so the Playwright
 * test-identity cookie remains triple-gated. A second project boots ordinary
 * local development on another port so the developer hub can be exercised
 * without weakening that gate. That hub server may use isolated test
 * credentials; `VENUBOARD_ENABLE_TEST_IDENTITY` stays unset there.
 *
 * Not wired into CI yet — the preview strategy is still open (OQ-38).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: TEST_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /local-dev-hub\.spec\.ts|local-ui-gallery\.spec\.ts/,
    },
    {
      name: "local-dev",
      use: { ...devices["Desktop Chrome"], baseURL: LOCAL_DEV_URL },
      testMatch: /local-dev-hub\.spec\.ts|local-ui-gallery\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `npx next dev --hostname 127.0.0.1 --port ${String(TEST_APP_PORTS.playwright)}`,
      url: TEST_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: isolated.apiUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: isolated.publishableKey,
        SUPABASE_SECRET_KEY: isolated.secretKey,
        VENUBOARD_ENV: "test",
        VENUBOARD_ENABLE_TEST_IDENTITY: "1",
        VENUBOARD_PLAYWRIGHT_DIST_DIR: ".next-playwright",
        PORT: String(TEST_APP_PORTS.playwright),
        NEXT_PUBLIC_APP_ORIGIN: TEST_URL,
      },
    },
    {
      command: `npx next dev --hostname 127.0.0.1 --port ${String(TEST_APP_PORTS.playwrightLocalDev)}`,
      url: LOCAL_DEV_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: isolated.apiUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: isolated.publishableKey,
        SUPABASE_SECRET_KEY: isolated.secretKey,
        VENUBOARD_ENV: "local",
        VENUBOARD_ENABLE_TEST_IDENTITY: "",
        VENUBOARD_PLAYWRIGHT_DIST_DIR: ".next-playwright-local",
        PORT: String(TEST_APP_PORTS.playwrightLocalDev),
        NEXT_PUBLIC_APP_ORIGIN: LOCAL_DEV_URL,
      },
    },
  ],
});
