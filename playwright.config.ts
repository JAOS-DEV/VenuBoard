import { defineConfig, devices } from "@playwright/test";

const TEST_PORT = 3100;
const LOCAL_DEV_PORT = 3101;
const TEST_URL = `http://127.0.0.1:${String(TEST_PORT)}`;
const LOCAL_DEV_URL = `http://127.0.0.1:${String(LOCAL_DEV_PORT)}`;

/**
 * End-to-end configuration.
 *
 * Chromium only: a second browser engine costs CI minutes and download size
 * without telling us anything new about a placeholder page. Add engines when
 * there is a public site worth testing cross-browser.
 *
 * The default project stays on `VENUBOARD_ENV=test` so the Playwright
 * test-identity cookie remains triple-gated. A second project boots ordinary
 * local development on another port so the developer hub can be exercised
 * without weakening that gate.
 *
 * Not wired into CI yet — the preview and test-database strategy is still open
 * (OQ-38). Run locally with `npm run test:e2e`.
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
      testIgnore: /local-dev-hub\.spec\.ts/,
    },
    {
      name: "local-dev",
      use: { ...devices["Desktop Chrome"], baseURL: LOCAL_DEV_URL },
      testMatch: /local-dev-hub\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `npx next dev --hostname 127.0.0.1 --port ${String(TEST_PORT)}`,
      url: TEST_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VENUBOARD_ENV: "test",
        VENUBOARD_ENABLE_TEST_IDENTITY: "1",
        VENUBOARD_PLAYWRIGHT_DIST_DIR: ".next-playwright",
        PORT: String(TEST_PORT),
        NEXT_PUBLIC_APP_ORIGIN: TEST_URL,
      },
    },
    {
      command: `npx next dev --hostname 127.0.0.1 --port ${String(LOCAL_DEV_PORT)}`,
      url: LOCAL_DEV_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VENUBOARD_ENV: "local",
        VENUBOARD_ENABLE_TEST_IDENTITY: "",
        VENUBOARD_PLAYWRIGHT_DIST_DIR: ".next-playwright-local",
        PORT: String(LOCAL_DEV_PORT),
        NEXT_PUBLIC_APP_ORIGIN: LOCAL_DEV_URL,
      },
    },
  ],
});
