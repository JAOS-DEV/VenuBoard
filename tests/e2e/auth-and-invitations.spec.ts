import { expect, test } from "@playwright/test";

test.describe("sign-in pages", () => {
  test("renders English password and magic-link sign-in", async ({ page }) => {
    await page.goto("/en/sign-in");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with password" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Email me a magic link" }),
    ).toBeVisible();
  });

  test("renders Thai sign-in", async ({ page }) => {
    await page.goto("/th/sign-in");

    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(
      page.getByRole("heading", { name: "เข้าสู่ระบบ" }),
    ).toBeVisible();
    await expect(page.getByLabel("ที่อยู่อีเมล")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "เข้าสู่ระบบด้วยรหัสผ่าน" }),
    ).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("sends anonymous users from /admin to sign-in with a validated return path", async ({
    page,
  }) => {
    await page.goto("/en/admin");

    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/admin");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("shows access denied for an authenticated user without memberships", async ({
    browser,
    baseURL,
  }) => {
    if (baseURL === undefined) {
      throw new Error(
        "Playwright baseURL is required for the test identity cookie",
      );
    }

    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      {
        name: "vb_test_identity",
        value: "authenticated-no-access",
        url: baseURL,
      },
    ]);
    const page = await context.newPage();
    await page.goto("/en/admin");
    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/unauthorized/);
    await context.close();
  });
});

test.describe("invitations and redirect safety", () => {
  test("renders the invalid invitation state", async ({ page }) => {
    await page.goto("/en/invite/not-a-valid-token-xx");
    await expect(
      page.getByRole("heading", { name: "Invitation not found" }),
    ).toBeVisible();
    await expect(
      page.getByText("This invitation link is not valid."),
    ).toBeVisible();
  });

  test("does not honour an external return path", async ({ page }) => {
    await page.goto("/en/sign-in?next=https://evil.example");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);

    await page.goto("/en/sign-in?next=//evil.example");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);

    await page.goto("/en/sign-in?next=%2f%2fevil.example");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);

    await page.goto("/en/sign-in?next=%252f%252fevil.example");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);

    await page.goto("/en/admin?next=https://evil.example");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/admin");
    expect(url.searchParams.get("next")).not.toContain("evil");
  });
});
