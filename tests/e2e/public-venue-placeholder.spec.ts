import { expect, test } from "@playwright/test";

test.describe("public venue route", () => {
  test("redirects the bare root to the default locale", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Application scaffold" }),
    ).toBeVisible();
  });

  test("does not invent a tenant for an unknown slug", async ({ page }) => {
    await page.goto("/en/v/blue-parrot-bar");

    await expect(
      page.getByRole("heading", { level: 1, name: "Venue not available" }),
    ).toBeVisible();
    await expect(page.getByText("Mina Cole")).toHaveCount(0);
  });

  test("serves the Thai locale", async ({ page }) => {
    await page.goto("/th/v/blue-parrot-bar");

    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "สถานประกอบการนี้ไม่พร้อมให้บริการ",
      }),
    ).toBeVisible();
  });
});
