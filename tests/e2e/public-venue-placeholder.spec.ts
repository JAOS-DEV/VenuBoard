import { expect, test } from "@playwright/test";

/**
 * Smoke test for the public development fallback route.
 *
 * It asserts what the scaffold actually promises: the route resolves, the locale
 * prefix is applied, and the slug from the URL is echoed back. When real tenant
 * resolution and public modules exist, this file is where those assertions go.
 *
 * TODO(first-schema): tenant-isolation and permission end-to-end tests cannot be
 * written until the schema, RLS policies and the seed dataset exist. See
 * docs/decisions-and-open-questions.md section 4.1 and ADR-017. Do not add
 * placeholder isolation tests here — a test that cannot fail is worse than none.
 */
test.describe("public venue placeholder", () => {
  test("redirects the bare root to the default locale", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Application scaffold" }),
    ).toBeVisible();
  });

  test("echoes the venue slug and says tenant lookup is not implemented", async ({
    page,
  }) => {
    await page.goto("/en/v/blue-parrot-bar");

    await expect(
      page.getByRole("heading", { level: 1, name: "Public venue site" }),
    ).toBeVisible();
    await expect(page.getByText("blue-parrot-bar")).toBeVisible();
    await expect(
      page.getByText(/Tenant lookup is not implemented/),
    ).toBeVisible();
  });

  test("serves the Thai locale", async ({ page }) => {
    await page.goto("/th/v/blue-parrot-bar");

    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "เว็บไซต์สาธารณะของสถานประกอบการ",
      }),
    ).toBeVisible();
  });
});
