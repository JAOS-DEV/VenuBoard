import { expect, test } from "@playwright/test";

import {
  signInPlatformAdmin,
  signInSeedUser,
} from "./helpers/platform-identity";

/**
 * Temporary visual review captures. Written under test-results/review,
 * which is gitignored. Do not commit these files.
 */
test.describe("review screenshots", () => {
  test("capture representative viewports", async ({ page }) => {
    test.setTimeout(120_000);
    const shots: Array<{
      path: string;
      url: string;
      colorScheme?: "light" | "dark";
      viewport: { width: number; height: number };
    }> = [
      {
        path: "test-results/review/public-390-light.png",
        url: "/en/v/harbor-light",
        colorScheme: "light",
        viewport: { width: 390, height: 844 },
      },
      {
        path: "test-results/review/public-390-dark.png",
        url: "/en/v/harbor-light",
        colorScheme: "dark",
        viewport: { width: 390, height: 844 },
      },
      {
        path: "test-results/review/signin-390.png",
        url: "/en/sign-in",
        viewport: { width: 390, height: 844 },
      },
      {
        path: "test-results/review/public-desktop.png",
        url: "/en/v/harbor-light",
        viewport: { width: 1280, height: 800 },
      },
    ];

    for (const shot of shots) {
      await page.setViewportSize(shot.viewport);
      const theme = shot.colorScheme ?? "light";
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(shot.url);
      await page.evaluate((value) => {
        window.localStorage.setItem("venuboard-theme", value);
      }, theme);
      await page.reload();
      if (theme === "dark") {
        await expect(page.locator("html")).toHaveClass(/dark/);
      }
      await page.screenshot({
        path: shot.path,
        fullPage: true,
      });
    }

    const owner = await signInSeedUser(
      page,
      "00000000-0000-4000-8000-000000000010",
      "harbor.owner@example.com",
    );
    if (owner.ok) {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const shot of [
        { path: "test-results/review/admin-390.png", url: "/en/admin" },
        {
          path: "test-results/review/staff-admin-390.png",
          url: "/en/admin/staff",
        },
        {
          path: "test-results/review/events-admin-390.png",
          url: "/en/admin/events",
        },
      ] as const) {
        await page.goto(shot.url);
        await page.screenshot({ path: shot.path, fullPage: true });
      }
    }

    const platform = await signInPlatformAdmin(page);
    if (platform.ok) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/en/platform");
      await page.screenshot({
        path: "test-results/review/platform-admin-390.png",
        fullPage: true,
      });
    }

    expect(shots.length).toBeGreaterThan(0);
  });
});
