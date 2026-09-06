import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";

function runId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(overflow).toBe(false);
}

async function assertNoInternalDestinations(page: Page): Promise<void> {
  await expect(
    page.getByRole("link", { name: "Venue administration" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Platform administration" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Developer hub" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "UI gallery" })).toHaveCount(0);
}

function desktopVenueNav(page: Page) {
  return page.getByRole("navigation", { name: "Venue pages" });
}

test.describe("public venue return navigation", () => {
  test("homepage offers, updates and enquiries return to the same venue", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByRole("link", { name: "Harbor Light", exact: true }),
    ).toHaveAttribute("href", /\/v\/harbor-light$/);
    await expect(
      page.getByTestId("public-offers-preview").getByText("Offers", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This week at Harbor Light" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View all offers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View all updates" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "View all offers" }).click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/offers$/);
    await expect(page.getByTestId("public-venue-back")).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);

    await desktopVenueNav(page).getByRole("link", { name: "Updates" }).click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/updates$/);
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);

    await desktopVenueNav(page)
      .getByRole("link", { name: "Send an enquiry" })
      .click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/enquire$/);
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
    await expect(page.getByTestId("public-booking-form")).toHaveCount(0);
  });

  test("direct subpage entry returns home with the current locale and venue", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of ["offers", "updates", "enquire"] as const) {
      await page.goto(`/en/v/harbor-light/${path}`);
      const back = page.getByTestId("public-venue-back");
      await expect(back).toHaveAttribute("href", /\/v\/harbor-light$/);
      await expect(back).toHaveText("Back to Harbor Light");
      await page
        .getByRole("link", { name: "Harbor Light", exact: true })
        .click();
      await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
    }

    await page.goto("/th/v/harbor-light/offers");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("โปรโมชัน").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "สัปดาห์นี้ที่ฮาร์เบอร์ไลต์" }),
    ).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/th\/v\/harbor-light$/);
  });

  test("enquiry success keeps the return link and does not resubmit", async ({
    page,
  }) => {
    const id = runId();
    const name = `Guest ${id}`;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/v/harbor-light/enquire");
    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Email").fill(`${id}@example.com`);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Requested date and time").fill("2026-10-01T19:00");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(
      page.getByText("Enquiry received. This does not confirm a booking."),
    ).toBeVisible();
    expect(page.url()).not.toContain(name);
    expect(page.url()).not.toContain("@example.com");
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
    await expect(page.getByTestId("public-booking-form")).toHaveCount(0);
  });

  test("paused and unavailable enquiry screens still return home", async ({
    page,
  }) => {
    await page.goto("/en/v/trial-garden/enquire");
    await expect(
      page.getByText("This venue is not accepting enquiries right now."),
    ).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/trial-garden$/);

    await page.goto("/en/v/draft-room/enquire");
    await expect(
      page.getByText("Enquiries are not available for this venue."),
    ).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/draft-room$/);
  });
});

test.describe("public venue destination discovery", () => {
  test("desktop and mobile menus stay compact and customer-facing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/v/harbor-light");
    const nav = desktopVenueNav(page);
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Updates" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Send an enquiry" }),
    ).toBeVisible();
    await assertNoInternalDestinations(page);
    await assertNoHorizontalOverflow(page);

    await nav.getByRole("link", { name: "Offers" }).press("Enter");
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/offers$/);

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/en/v/harbor-light");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Updates" })).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Send an enquiry" }),
    ).toBeVisible();
    await assertNoInternalDestinations(page);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light/updates");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await assertNoHorizontalOverflow(page);
  });

  test("Thai menu labels preserve locale on public destinations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/th/v/harbor-light");
    const nav = page.getByRole("navigation", { name: "หน้าสถานประกอบการ" });
    await nav.getByRole("link", { name: "โปรโมชัน" }).click();
    await expect(page).toHaveURL(/\/th\/v\/harbor-light\/offers$/);
    await expect(page.getByTestId("public-venue-back")).toHaveText(
      "กลับไปที่ Harbor Light",
    );
  });

  test("unavailable modules stay out of navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/v/night-orchid");
    const orchidNav = desktopVenueNav(page);
    await expect(orchidNav.getByRole("link", { name: "Offers" })).toHaveCount(
      0,
    );
    await expect(
      orchidNav.getByRole("link", { name: "Updates" }),
    ).toBeVisible();
    await expect(
      orchidNav.getByRole("link", { name: "Send an enquiry" }),
    ).toBeVisible();
    await page.goto("/en/v/night-orchid/offers");
    await expect(
      page.getByText("Offers are not available for this venue."),
    ).toBeVisible();
    await expect(
      desktopVenueNav(page).getByRole("link", { name: "Offers" }),
    ).toHaveCount(0);
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/night-orchid$/);

    await page.goto("/en/v/trial-garden");
    const gardenNav = desktopVenueNav(page);
    await expect(
      gardenNav.getByRole("link", { name: "Send an enquiry" }),
    ).toHaveCount(0);
    await expect(
      gardenNav.getByRole("link", { name: "Updates" }),
    ).toBeVisible();
    await expect(page.getByTestId("public-feed-preview")).toHaveCount(0);
    await gardenNav.getByRole("link", { name: "Updates" }).click();
    await expect(page).toHaveURL(/\/en\/v\/trial-garden\/updates$/);
    await expect(page.getByText("No public updates right now.")).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/trial-garden$/);
    await desktopVenueNav(page).getByRole("link", { name: "Offers" }).click();
    await expect(page).toHaveURL(/\/en\/v\/trial-garden\/offers$/);
    await expect(page.getByTestId("public-venue-back")).toBeVisible();
    await page.getByTestId("public-venue-back").click();
    await expect(page).toHaveURL(/\/en\/v\/trial-garden$/);
  });

  test("disabling the homepage preview does not hide an available destination", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    async function setHarborPreview(enabled: boolean): Promise<void> {
      await page.goto("/en/admin/offers");
      const venueSelect = page.locator("#admin-venue");
      if ((await venueSelect.count()) > 0) {
        await venueSelect.selectOption({ label: "Harbor Light" });
        await page.getByRole("button", { name: "Use this venue" }).click();
      }
      const checkbox = page.locator('input[name="homepagePreviewEnabled"]');
      if (enabled) {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByRole("status")).toContainText("Saved", {
        timeout: 15_000,
      });
    }

    try {
      await setHarborPreview(false);
      await page.goto("/en/v/harbor-light");
      await expect(page.getByTestId("public-offers-preview")).toHaveCount(0);
      await expect(
        desktopVenueNav(page).getByRole("link", { name: "Offers" }),
      ).toBeVisible();
      await desktopVenueNav(page).getByRole("link", { name: "Offers" }).click();
      await expect(page).toHaveURL(/\/en\/v\/harbor-light\/offers$/);
      await expect(
        page.getByRole("heading", { name: "This week at Harbor Light" }),
      ).toBeVisible();
    } finally {
      await setHarborPreview(true);
    }
  });
});
