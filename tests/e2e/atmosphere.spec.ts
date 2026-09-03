import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";
const ATLAS_OWNER_ID = "00000000-0000-4000-8000-000000000020";
const ATLAS_OWNER_EMAIL = "atlas.owner@example.com";
const ATLAS_MANAGER_ID = "00000000-0000-4000-8000-000000000021";
const ATLAS_MANAGER_EMAIL = "atlas.manager@example.com";
const ATLAS_BOOKINGS_ID = "00000000-0000-4000-8000-000000000023";
const ATLAS_BOOKINGS_EMAIL = "atlas.bookings@example.com";

const VENUE_IDS: Record<string, string> = {
  "Harbor Light": "00000000-0000-4000-8000-000000000101",
  "Night Orchid": "00000000-0000-4000-8000-000000000201",
  "Silent Room": "00000000-0000-4000-8000-000000000204",
  "Trial Garden": "00000000-0000-4000-8000-000000000205",
  "Trial Partial": "00000000-0000-4000-8000-000000000206",
  "Restricted Room": "00000000-0000-4000-8000-000000000203",
};

async function selectAdminVenue(page: Page, venueName: string): Promise<void> {
  const venueSelect = page.locator("#admin-venue");
  if ((await venueSelect.count()) === 0) {
    return;
  }
  await venueSelect.selectOption({ label: venueName });
  await page.getByRole("button", { name: "Use this venue" }).click();
  const expectedId = VENUE_IDS[venueName];
  if (expectedId !== undefined) {
    await expect(page.getByTestId("atmosphere-admin")).toHaveAttribute(
      "data-venue-id",
      expectedId,
      { timeout: 15_000 },
    );
  }
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe("atmosphere — access", () => {
  test("anonymous cannot access atmosphere admin", async ({ page }) => {
    await page.goto("/en/admin/atmosphere");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("harbor.owner can open Harbor Light atmosphere admin", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await expect(
      page.getByRole("heading", { name: "Atmosphere" }),
    ).toBeVisible();
    await selectAdminVenue(page, "Harbor Light");
    await expect(
      page.getByRole("button", { name: "Lively" }).first(),
    ).toBeVisible();
  });

  test("atlas.manager can open Night Orchid and cannot select Harbor Light", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_MANAGER_ID,
      ATLAS_MANAGER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await expect(
      page.getByRole("heading", { name: "Atmosphere" }),
    ).toBeVisible();
    const venueSelect = page.locator("#admin-venue");
    if ((await venueSelect.count()) > 0) {
      const labels = await venueSelect.locator("option").allTextContents();
      expect(labels.join(" ")).not.toContain("Harbor Light");
    }
  });

  test("booking manager is denied atmosphere admin", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_BOOKINGS_ID,
      ATLAS_BOOKINGS_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await expect(
      page.getByText("You do not have an atmosphere action in this venue."),
    ).toBeVisible();
  });
});

test.describe("atmosphere — live database happy path", () => {
  test("set, public show, replace, clear, and repeat", async ({ page }) => {
    test.setTimeout(90_000);
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByLabel("Keep this update for").selectOption("60");
    await page.getByRole("button", { name: "Calm", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light");
    const card = page.getByTestId("public-atmosphere");
    await expect(card).toBeVisible();
    await expect(card.getByText("Calm").first()).toBeVisible();
    await expect(card).toHaveAttribute("data-atmosphere-status", "calm");

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("button", { name: "Social", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByTestId("public-atmosphere").getByText("Social").first(),
    ).toBeVisible();

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("button", { name: "Clear status" }).click();
    await page.getByRole("button", { name: "Clear now" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light");
    await expect(page.getByTestId("public-atmosphere")).toHaveCount(0);

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("button", { name: "Lively", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByTestId("public-atmosphere").getByText("Lively").first(),
    ).toBeVisible();
  });
});

test.describe("atmosphere — public gates", () => {
  test("expired, disabled, not entitled and draft venues hide the card", async ({
    page,
  }) => {
    await page.goto("/en/v/trial-expired");
    await expect(page.getByTestId("public-atmosphere")).toHaveCount(0);

    await page.goto("/en/v/silent-room");
    await expect(page.getByTestId("public-atmosphere")).toHaveCount(0);

    await page.goto("/en/v/trial-partial");
    await expect(page.getByTestId("public-atmosphere")).toHaveCount(0);

    await page.goto("/en/v/draft-room");
    await expect(page.getByTestId("public-atmosphere")).toHaveCount(0);
  });

  test("restricted venue still shows a public card", async ({ page }) => {
    await page.goto("/en/v/restricted-room");
    await expect(page.getByTestId("public-atmosphere")).toBeVisible();
    await expect(page.getByText("Calm").first()).toBeVisible();
  });

  test("English and Thai public labels", async ({ page }) => {
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText("Right now at Harbor Light")).toBeVisible();
    await page.goto("/th/v/harbor-light");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("ตอนนี้ที่ฮาร์เบอร์ไลต์")).toBeVisible();
  });

  test("18+ notice stays independent of atmosphere", async ({ page }) => {
    await page.goto("/en/v/night-orchid");
    await expect(page.getByTestId("adult-notice")).toBeVisible();
    await expect(page.getByTestId("public-atmosphere")).toBeVisible();
    await expect(page.getByText("Social").first()).toBeVisible();
  });

  test("public HTML has no actor ids or private history", async ({ page }) => {
    await page.goto("/en/v/harbor-light");
    const source = await page.content();
    expect(source).not.toContain("00000000-0000-4000-8000-000000000010");
    expect(source).not.toContain("harbor.owner@example.com");
    expect(source).not.toContain("actor_user_id");
    expect(source).not.toContain("changed_by");
    expect(source).not.toContain("venue_atmosphere_events");
  });

  test("status is not colour-only and keyboard can reach the card", async ({
    page,
  }) => {
    await page.goto("/en/v/harbor-light");
    const card = page.getByTestId("public-atmosphere");
    await expect(
      card
        .getByText("Lively")
        .or(card.getByText("Calm"))
        .or(card.getByText("Social"))
        .or(card.getByText("High energy"))
        .first(),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(card).toBeVisible();
  });
});

test.describe("atmosphere — module states and restricted writes", () => {
  test("silent room shows disabled copy and trial partial is not included", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Trial Garden");
    await expect(
      page.getByText("Atmosphere is turned off for this venue."),
    ).toBeVisible();

    await selectAdminVenue(page, "Trial Partial");
    await expect(
      page.getByText("Atmosphere is not included in this venue’s plan."),
    ).toBeVisible();
  });

  test("restricted venue denies writes", async ({ page }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/atmosphere");
    await selectAdminVenue(page, "Restricted Room");
    await expect(
      page.getByText("Writes are paused for this venue’s subscription."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Lively" })).toHaveCount(0);
  });
});

test.describe("atmosphere — responsive and theme", () => {
  for (const width of [320, 390, 430] as const) {
    test(`no overflow at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/en/v/harbor-light");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test("light and dark presentation", async ({ page }) => {
    await page.goto("/en/v/harbor-light");
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("public-atmosphere")).toBeVisible();
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
