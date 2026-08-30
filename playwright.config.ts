import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;

/**
 * End-to-end configuration.
 *
 * Chromium only: a second browser engine costs CI minutes and download size
 * without telling us anything new about a placeholder page. Add engines when
 * there is a public site worth testing cross-browser.
 *
 * Not wired into CI yet — the preview and test-database strategy is still open
 * (OQ-38). Run locally with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The dev server needs an explicit environment identifier; there is no
      // fallback by design.
      VENUBOARD_ENV: "test",
    },
  },
});
