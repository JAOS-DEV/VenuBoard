import { expect, test } from "@playwright/test";

const SECRET_PATTERN =
  /SUPABASE_SECRET|service_role|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

test.describe("local developer hub", () => {
  test("is reachable while signed out and lists local services and personas", async ({
    page,
  }) => {
    const response = await page.goto("/en/dev");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Local developer hub" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Developer hub" }),
    ).toBeVisible();

    await expect(
      page
        .locator('[data-slot="card"]', {
          hasText: "VenuBoard application",
        })
        .getByRole("link", { name: "Open local tool" }),
    ).toHaveAttribute("href", "http://localhost:3000");
    await expect(
      page
        .locator('[data-slot="card"]', {
          hasText: "Supabase Studio",
        })
        .getByRole("link", { name: "Open local tool" }),
    ).toHaveAttribute("href", "http://127.0.0.1:54323");
    await expect(
      page
        .locator('[data-slot="card"]', {
          hasText: "Local email inbox",
        })
        .getByRole("link", { name: "Open local tool" }),
    ).toHaveAttribute("href", "http://127.0.0.1:54324");
    await expect(
      page
        .locator('[data-slot="card"]', {
          hasText: "Supabase Auth health",
        })
        .getByRole("link", { name: "Open local tool" }),
    ).toHaveAttribute("href", "http://127.0.0.1:54321/auth/v1/health");

    await expect(
      page.getByRole("heading", { name: "Platform administrator" }),
    ).toBeVisible();
    await expect(page.getByText("platform.admin@example.com")).toBeVisible();
    await expect(page.getByText("harbor.owner@example.com")).toBeVisible();
    await expect(page.getByText("deactivated.user@example.com")).toBeVisible();
    await expect(page.getByText("dual.staff@example.com")).toBeVisible();

    const html = await page.content();
    expect(html).not.toMatch(SECRET_PATTERN);
    await expect(page.locator('main input[type="password"]')).toHaveCount(0);
    await expect(page.locator('main input[name="password"]')).toHaveCount(0);
  });

  test("opens platform-admin sign-in with a safe platform destination", async ({
    page,
  }) => {
    await page.goto("/en/dev");
    await page
      .locator('[data-slot="card"]', {
        has: page.getByRole("heading", { name: "Platform administrator" }),
      })
      .getByRole("link", { name: "Open sign-in" })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("persona")).toBe("platform-admin");
    expect(url.searchParams.get("next")).toBe("/platform");
    await expect(page.getByLabel("Email address")).toHaveValue(
      "platform.admin@example.com",
    );
    await expect(page.getByLabel("Password")).toHaveValue("");
    await expect(page.locator('input[name="next"]')).toHaveValue("/platform");
  });

  test("opens venue-owner sign-in with a safe admin destination", async ({
    page,
  }) => {
    await page.goto("/en/dev");
    await page
      .locator('[data-slot="card"]', {
        has: page.getByRole("heading", { name: "Independent venue owner" }),
      })
      .getByRole("link", { name: "Open sign-in" })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("persona")).toBe("harbor-owner");
    expect(url.searchParams.get("next")).toBe("/admin");
    await expect(page.getByLabel("Email address")).toHaveValue(
      "harbor.owner@example.com",
    );
    await expect(page.locator('input[name="next"]')).toHaveValue("/admin");
  });

  test("does not prefill an unknown persona", async ({ page }) => {
    await page.goto("/en/sign-in?persona=not-a-real-persona");
    await expect(page.getByLabel("Email address")).toHaveValue("");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);
  });

  test("links sign-in to the hub and the mailbox after a successful local request", async ({
    page,
  }) => {
    await page.goto("/en/sign-in?persona=platform-admin");
    await expect(
      page.getByRole("link", { name: "Local developer hub" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open the local email inbox" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Email me a magic link" }).click();

    const mailbox = page.getByRole("link", {
      name: "Open the local email inbox",
    });
    const error = page.getByRole("alert");
    await expect(mailbox.or(error)).toBeVisible();

    if (await mailbox.isVisible()) {
      await expect(
        page.getByText("Magic link requested. Open the local email inbox."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "If an account exists for that address, a sign-in link has been sent.",
        ),
      ).toBeVisible();
      await expect(mailbox).toHaveAttribute("href", "http://127.0.0.1:54324");
    } else {
      await expect(
        page.getByText("Magic link requested. Open the local email inbox."),
      ).toHaveCount(0);
    }
  });

  test("exposes the hub from local development navigation", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "Developer hub" }).click();
    await expect(page).toHaveURL(/\/en\/dev$/);
    await expect(
      page.getByRole("heading", { name: "Local developer hub" }),
    ).toBeVisible();
  });
});
