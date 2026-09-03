import { expect, test, type Page } from "@playwright/test";

import {
  signInPlatformAdmin,
  signInSeedUser,
} from "./helpers/platform-identity";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

const PUBLIC_ROUTES = ["/en/sign-in", "/en/v/harbor-light"] as const;

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe("responsive matrix", () => {
  for (const viewport of VIEWPORTS) {
    test(`no overflow at ${String(viewport.width)}px on public and auth routes`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      for (const route of PUBLIC_ROUTES) {
        await page.goto(route);
        await expect(page.locator("#main")).toBeVisible();
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test("public Harbor Light hides internal chrome and raw states", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByRole("heading", { level: 1, name: "Harbor Light" }),
    ).toBeVisible();
    await expect(page.getByText("Development fallback route")).toHaveCount(0);
    await expect(page.getByText("not_entitled")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Surfaces" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Platform administration" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Venue administration" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Developer hub" })).toHaveCount(
      0,
    );
  });

  test("calendar cells do not contain full event descriptions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/night-orchid");
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();
    await expect(grid.getByText("Orchid Open Night")).toHaveCount(0);
    await expect(page.getByText("Orchid Open Night").first()).toBeVisible();
  });

  test("theme control is available and persists on the public site", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light");
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("venuboard-theme"),
    );
    expect(stored).toBe("dark");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("sign-in primary actions meet the 44px target", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/sign-in");
    const password = page.getByRole("button", {
      name: "Sign in with password",
    });
    const box = await password.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("signed-in admin and platform routes do not overflow at 390px", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const owner = await signInSeedUser(
      page,
      "00000000-0000-4000-8000-000000000010",
      "harbor.owner@example.com",
    );
    test.skip(!owner.ok, "local Supabase identity is required");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/en/admin",
      "/en/admin/staff",
      "/en/admin/events",
    ] as const) {
      await page.goto(route);
      await expect(page.locator("#main")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }

    const platform = await signInPlatformAdmin(page);
    test.skip(!platform.ok, "local Supabase identity is required");
    await page.goto("/en/platform");
    await expect(page.locator("#main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.goto("/en/platform/onboard");
    await expect(page.locator("#main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
