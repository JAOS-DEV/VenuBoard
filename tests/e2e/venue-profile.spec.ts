import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";
const ATLAS_OWNER_ID = "00000000-0000-4000-8000-000000000020";
const ATLAS_OWNER_EMAIL = "atlas.owner@example.com";
const ATLAS_EDITOR_ID = "00000000-0000-4000-8000-000000000022";
const ATLAS_EDITOR_EMAIL = "atlas.editor@example.com";
const PLATFORM_SUPPORT_ID = "00000000-0000-4000-8000-000000000002";
const PLATFORM_SUPPORT_EMAIL = "platform.support@example.com";

const VENUE_IDS: Record<string, string> = {
  "Harbor Light": "00000000-0000-4000-8000-000000000101",
  "Night Orchid": "00000000-0000-4000-8000-000000000201",
  "Draft Room": "00000000-0000-4000-8000-000000000202",
};

function bangkokDate(offsetDays: number): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const utc = Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays);
  const shifted = new Date(utc);
  const y = String(shifted.getUTCFullYear()).padStart(4, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function selectAdminVenue(page: Page, venueName: string): Promise<void> {
  const venueSelect = page.locator("#admin-venue");
  if ((await venueSelect.count()) === 0) {
    return;
  }
  await venueSelect.selectOption({ label: venueName });
  await page.getByRole("button", { name: "Use this venue" }).click();
  const expectedId = VENUE_IDS[venueName];
  if (expectedId !== undefined) {
    await expect(page.getByTestId("venue-profile-admin")).toHaveAttribute(
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

test.describe("venue profile — public site", () => {
  test("Harbor Light shows public identity, contacts and listed hours", async ({
    page,
  }) => {
    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByRole("heading", { level: 1, name: "Harbor Light" }),
    ).toBeVisible();
    await expect(page.getByTestId("public-venue-profile")).toBeVisible();
    await expect(page.getByTestId("venue-preview-banner")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:harbor.public@example.com",
    );
    await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute(
      "href",
      "tel:+66810000101",
    );
    await expect(page.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "https://harbor-light.example.com/",
    );
    await expect(
      page.getByRole("link", { name: "Get directions" }),
    ).toHaveAttribute("href", /openstreetmap\.org\/directions/);
    await expect(page.getByTestId("hours-status")).toBeVisible();
    await expect(page.getByTestId("hours-status")).toContainText(
      /according to listed hours|Hours not provided/,
    );
    await page.getByText("Venue timezone: Asia/Bangkok").click();
    await expect(page.getByText("Sunday: Closed")).toBeVisible();
    await expect(page.getByText("11:00–14:00, 17:00–22:00")).toBeVisible();
    await expect(page.getByText(bangkokDate(1))).toBeVisible();
    await expect(page.getByText("Private fixture note")).toHaveCount(0);
    await expect(page.getByText("harbor.owner@example.com")).toHaveCount(0);
  });

  test("Night Orchid shows overnight hours and the 18+ notice", async ({
    page,
  }) => {
    await page.goto("/en/v/night-orchid");
    await expect(
      page.getByRole("heading", { level: 1, name: "Night Orchid" }),
    ).toBeVisible();
    await expect(page.getByTestId("adult-notice")).toBeVisible();
    await expect(page.getByRole("link", { name: "Email" })).toHaveCount(0);
    await page.getByText("Venue timezone: Asia/Bangkok").click();
    await expect(
      page.getByText("18:00–02:00 (next day)").first(),
    ).toBeVisible();
  });

  test("Trial Garden reports hours not provided", async ({ page }) => {
    await page.goto("/en/v/trial-garden");
    await expect(page.getByTestId("hours-status")).toHaveText(
      "Hours not provided",
    );
  });

  test("anonymous users cannot preview Draft Room", async ({ page }) => {
    const response = await page.goto("/en/v/draft-room");
    await expect(
      page.getByRole("heading", { level: 1, name: "Venue not available" }),
    ).toBeVisible();
    await expect(page.getByTestId("venue-preview-banner")).toHaveCount(0);
    const cacheControl = response?.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|private|no-cache/i);
    expect(cacheControl).not.toMatch(/s-maxage|public/i);
    await page.goto("/en/v/draft-room?preview=true");
    await expect(
      page.getByRole("heading", { level: 1, name: "Venue not available" }),
    ).toBeVisible();
  });

  test("unrelated signed-in users cannot preview Draft Room", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/v/draft-room");
    await expect(
      page.getByRole("heading", { level: 1, name: "Venue not available" }),
    ).toBeVisible();
    await expect(page.getByTestId("venue-preview-banner")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: "Draft Room" }),
    ).toHaveCount(0);
  });
});

test.describe("venue profile — admin", () => {
  test("anonymous cannot access profile admin", async ({ page }) => {
    await page.goto("/en/admin/profile");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("owner edits public copy and the public site updates", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const marker = `Pier lamp ${Date.now().toString().slice(-6)}`;
    await page.goto("/en/admin/profile");
    await selectAdminVenue(page, "Harbor Light");
    await expect(page.getByTestId("venue-timezone")).toHaveText("Asia/Bangkok");
    const tagline = page.getByLabel("Short description (English)");
    await tagline.fill(marker);
    await page.getByRole("button", { name: "Save public information" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(marker)).toBeVisible();
    await page.goto("/en/admin/profile");
    await selectAdminVenue(page, "Harbor Light");
    await tagline.fill("Light on the water");
    await page.getByRole("button", { name: "Save public information" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
  });

  test("owner can add a date exception without flattening split hours", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/profile");
    await selectAdminVenue(page, "Harbor Light");
    const extra = bangkokDate(5);
    await page.getByLabel("Exception date").fill(extra);
    await page.getByRole("button", { name: "Save hours" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.goto("/en/v/harbor-light");
    await page.getByText("Venue timezone: Asia/Bangkok").click();
    await expect(page.getByText("11:00–14:00, 17:00–22:00")).toBeVisible();
    await expect(page.getByText(extra)).toBeVisible();
  });

  test("atlas.owner can privately preview then unpublish Draft Room", async ({
    page,
    browser,
    baseURL,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const previewResponse = await page.goto("/en/v/draft-room");
    await expect(page.getByTestId("venue-preview-banner")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Draft Room" }),
    ).toBeVisible();
    const previewCache = previewResponse?.headers()["cache-control"] ?? "";
    expect(previewCache).toMatch(/no-store|private|no-cache/i);
    expect(previewCache).not.toMatch(/s-maxage/i);
    const anonWhileDraft = await browser.newContext({ baseURL });
    const anonDraftPage = await anonWhileDraft.newPage();
    await anonDraftPage.goto("/en/v/draft-room");
    await expect(
      anonDraftPage.getByRole("heading", {
        level: 1,
        name: "Venue not available",
      }),
    ).toBeVisible();
    await expect(
      anonDraftPage.getByRole("heading", { level: 1, name: "Draft Room" }),
    ).toHaveCount(0);
    await anonWhileDraft.close();
    await page.goto("/en/v/draft-room/enquire");
    await expect(page.getByTestId("public-booking-form")).toHaveCount(0);
    await expect(page.getByTestId("venue-preview-banner")).toHaveCount(0);
    await page.goto("/en/admin/profile");
    await selectAdminVenue(page, "Draft Room");
    await expect(page.getByTestId("publication-state")).toContainText("draft");
    await page.getByRole("button", { name: "Publish venue site" }).click();
    await expect(page.getByRole("status")).toContainText("Published", {
      timeout: 15_000,
    });
    const anonContext = await browser.newContext({ baseURL });
    const anon = await anonContext.newPage();
    await anon.goto("/en/v/draft-room");
    await expect(
      anon.getByRole("heading", { level: 1, name: "Draft Room" }),
    ).toBeVisible();
    await anonContext.close();
    await page.getByRole("button", { name: "Unpublish venue site" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Unpublish venue site" })
      .click();
    await expect(page.getByRole("status")).toContainText("Unpublished", {
      timeout: 15_000,
    });
    const closedContext = await browser.newContext({ baseURL });
    const closed = await closedContext.newPage();
    await closed.goto("/en/v/draft-room");
    await expect(
      closed.getByRole("heading", { level: 1, name: "Venue not available" }),
    ).toBeVisible();
    await closed.goto("/en/v/draft-room/enquire");
    await expect(closed.getByTestId("public-booking-form")).toHaveCount(0);
    await closedContext.close();
  });

  test("content editor cannot manage the venue profile", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/profile");
    await expect(
      page.getByText("You cannot manage this venue profile."),
    ).toBeVisible();
  });

  test("platform support cannot open tenant profile admin", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      PLATFORM_SUPPORT_ID,
      PLATFORM_SUPPORT_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/profile");
    await expect(page).toHaveURL(/unauthorized|sign-in|platform/);
    await expect(page.getByTestId("venue-profile-admin")).toHaveCount(0);
  });
});

test.describe("venue profile — mobile, Thai, theme, keyboard", () => {
  test("Thai public profile wraps without sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/th/v/harbor-light");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(
      page.getByRole("heading", { level: 1, name: "ฮาร์เบอร์ไลต์" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "มืด" }).click();
    await expect(page.locator("html")).toHaveAttribute("class", /dark/);
    await page.getByRole("button", { name: "เมนู" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "โปรโมชัน" })
      .click();
    await expect(page).toHaveURL(/\/th\/v\/harbor-light\/offers/);
    await page.getByTestId("public-venue-back").click();
    await expect(
      page.getByRole("heading", { level: 1, name: "ฮาร์เบอร์ไลต์" }),
    ).toBeVisible();
  });

  test("keyboard can reach contact actions on the homepage", async ({
    page,
  }) => {
    await page.goto("/en/v/harbor-light");
    await page.getByRole("link", { name: "Get directions" }).focus();
    await expect(
      page.getByRole("link", { name: "Get directions" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
  });
});
