import { expect, test } from "@playwright/test";

test.describe("developer hub outside ordinary local development", () => {
  test("returns a real 404 for /en/dev in the test environment", async ({
    page,
  }) => {
    const response = await page.goto("/en/dev");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Developer hub" })).toHaveCount(
      0,
    );
  });

  test("ignores a developer-persona parameter on sign-in", async ({ page }) => {
    await page.goto("/en/sign-in?persona=platform-admin&next=/platform");
    await expect(page.getByLabel("Email address")).toHaveValue("");
    await expect(page.locator('input[name="next"]')).toHaveValue("/platform");
    await expect(
      page.getByRole("link", { name: "Local developer hub" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open the local email inbox" }),
    ).toHaveCount(0);
  });
});
