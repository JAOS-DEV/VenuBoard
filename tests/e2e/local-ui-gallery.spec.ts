import { expect, test } from "@playwright/test";

test.describe("local UI gallery", () => {
  test("is reachable only on the local-dev server", async ({ page }) => {
    const response = await page.goto("/en/dev/ui");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "UI component gallery" }),
    ).toBeVisible();
  });

  test("captures developer hub review screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/dev");
    await expect(
      page.getByRole("heading", { name: "Local developer hub" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/review/dev-hub-390.png",
      fullPage: true,
    });
  });
});
