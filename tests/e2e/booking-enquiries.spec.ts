import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";
const ATLAS_OWNER_ID = "00000000-0000-4000-8000-000000000020";
const ATLAS_OWNER_EMAIL = "atlas.owner@example.com";
const ATLAS_EDITOR_ID = "00000000-0000-4000-8000-000000000022";
const ATLAS_EDITOR_EMAIL = "atlas.editor@example.com";
const ATLAS_BOOKINGS_ID = "00000000-0000-4000-8000-000000000023";
const ATLAS_BOOKINGS_EMAIL = "atlas.bookings@example.com";
const ATLAS_STAFF_ID = "00000000-0000-4000-8000-000000000024";
const ATLAS_STAFF_EMAIL = "atlas.staff@example.com";

const VENUE_IDS: Record<string, string> = {
  "Harbor Light": "00000000-0000-4000-8000-000000000101",
  "Night Orchid": "00000000-0000-4000-8000-000000000201",
};

function runId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    await expect(page.getByTestId("booking-admin")).toHaveAttribute(
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

async function signInOrSkip(
  page: Page,
  userId: string,
  email: string,
): Promise<boolean> {
  const signedIn = await signInSeedUser(page, userId, email);
  if (!signedIn.ok) {
    test.skip(true, "local Supabase identity is required");
    return false;
  }
  return true;
}

test.describe("booking enquiries — public intake", () => {
  test("harbor public site shows a CTA and hides private contacts", async ({
    page,
  }) => {
    await page.goto("/en/v/harbor-light");
    await expect(page.getByTestId("public-booking-cta")).toBeVisible();
    const source = await page.content();
    expect(source).not.toContain("alex.harbour@example.com");
    expect(source).not.toContain("blair.review@example.com");
  });

  test("paused trial garden has no working public form", async ({ page }) => {
    await page.goto("/en/v/trial-garden");
    await expect(page.getByTestId("public-booking-cta")).toHaveCount(0);
    await page.goto("/en/v/trial-garden/enquire");
    await expect(
      page.getByText("This venue is not accepting enquiries right now."),
    ).toBeVisible();
    await expect(page.getByTestId("public-booking-form")).toHaveCount(0);
  });

  test("draft venue enquire route stays unavailable", async ({ page }) => {
    await page.goto("/en/v/draft-room/enquire");
    await expect(
      page.getByText("Enquiries are not available for this venue."),
    ).toBeVisible();
    await expect(page.getByTestId("public-booking-form")).toHaveCount(0);
  });

  test("public happy path double-submit creates one enquiry", async ({
    page,
  }) => {
    const id = runId();
    const name = `Guest ${id}`;
    await page.goto("/en/v/harbor-light");
    const homepageNotice = page.getByTestId("adult-notice");
    const noticeCount = await homepageNotice.count();
    await page.goto("/en/v/harbor-light/enquire");
    await expect(page.getByTestId("adult-notice")).toHaveCount(noticeCount);
    await expect(page.getByTestId("public-booking-form")).toBeVisible();
    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Email").fill(`${id}@example.com`);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Requested date and time").fill("2026-10-01T19:00");
    const submit = page.getByRole("button", { name: "Send enquiry" });
    await Promise.all([submit.click(), submit.click()]);
    await expect(
      page.getByText("Enquiry received. This does not confirm a booking."),
    ).toBeVisible();

    const signedIn = await signInOrSkip(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    if (!signedIn) {
      return;
    }
    await page.goto("/en/admin/bookings");
    await selectAdminVenue(page, "Harbor Light");
    const viewLinks = page.getByRole("link", { name: /View enquiry/ });
    await viewLinks.first().click();
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(`${id}@example.com`)).toBeVisible();
    await page.getByRole("button", { name: "Mark in review" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByRole("button", { name: "Close enquiry" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(page.getByText("Handled")).toBeVisible();
    await page.goto("/en/admin/bookings");
    await selectAdminVenue(page, "Harbor Light");
    if ((await viewLinks.count()) > 1) {
      await viewLinks.nth(1).click();
      await expect(page.getByText(name)).toHaveCount(0);
    }
  });
});

test.describe("booking enquiries — admin access", () => {
  test("anonymous cannot open the queue", async ({ page }) => {
    await page.goto("/en/admin/bookings");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("editor and staff are denied the queue", async ({ page }) => {
    const editor = await signInOrSkip(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    if (!editor) {
      return;
    }
    await page.goto("/en/admin/bookings");
    await expect(
      page.getByText("You do not have a booking action in this venue."),
    ).toBeVisible();

    await page.context().clearCookies();
    const staff = await signInOrSkip(page, ATLAS_STAFF_ID, ATLAS_STAFF_EMAIL);
    if (!staff) {
      return;
    }
    await page.goto("/en/admin/bookings");
    await expect(
      page.getByText("You do not have a booking action in this venue."),
    ).toBeVisible();
  });

  test("booking manager can open Night Orchid and cannot see Harbor contacts", async ({
    page,
  }) => {
    const signedIn = await signInOrSkip(
      page,
      ATLAS_BOOKINGS_ID,
      ATLAS_BOOKINGS_EMAIL,
    );
    if (!signedIn) {
      return;
    }
    await page.goto("/en/admin/bookings");
    await expect(
      page.getByRole("heading", { name: "Enquiries" }),
    ).toBeVisible();
    const venueSelect = page.locator("#admin-venue");
    if ((await venueSelect.count()) > 0) {
      const labels = await venueSelect.locator("option").allTextContents();
      expect(labels.join(" ")).not.toContain("Harbor Light");
    }
    const source = await page.content();
    expect(source).not.toContain("alex.harbour@example.com");
    expect(source).not.toContain("Nok Visitor");
  });

  test("harbor owner cannot open a Night Orchid enquiry", async ({ page }) => {
    const signedIn = await signInOrSkip(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    if (!signedIn) {
      return;
    }
    await page.goto("/en/admin/bookings/00000000-0000-4000-8000-000000000605");
    await expect(page).toHaveURL(/\/en\/admin\/bookings$/);
    const source = await page.content();
    expect(source).not.toContain("nok.visitor@example.com");
  });
});

test.describe("booking enquiries — workflow and layout", () => {
  test("stale in-review action reports a conflict", async ({ browser }) => {
    test.setTimeout(90_000);
    const setup = await browser.newContext();
    const setupPage = await setup.newPage();
    const id = runId();
    const name = `Stale ${id}`;
    await setupPage.goto("/en/v/harbor-light/enquire");
    await setupPage.getByLabel("Your name").fill(name);
    await setupPage.getByLabel("Email").fill(`${id}@example.com`);
    await setupPage
      .getByLabel("Requested date and time")
      .fill("2026-10-01T19:00");
    await setupPage.getByRole("button", { name: "Send enquiry" }).click();
    await expect(
      setupPage.getByText("Enquiry received. This does not confirm a booking."),
    ).toBeVisible();
    await setup.close();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const signedIn = await signInSeedUser(
      pageA,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await pageB.goto("/en/sign-in");
    await pageB.getByLabel("Email address").fill(HARBOR_OWNER_EMAIL);
    await pageB.getByLabel("Password").fill(signedIn.password);
    await pageB.getByRole("button", { name: "Sign in with password" }).click();
    await pageB.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    await pageA.goto("/en/admin/bookings");
    await selectAdminVenue(pageA, "Harbor Light");
    await pageA
      .getByRole("link", { name: /View enquiry/ })
      .first()
      .click();
    await expect(pageA.getByText(name)).toBeVisible();
    const detailUrl = pageA.url();
    await pageB.goto(detailUrl);

    await expect(
      pageA.getByRole("button", { name: "Mark in review" }),
    ).toBeVisible();
    await expect(
      pageB.getByRole("button", { name: "Mark in review" }),
    ).toBeVisible();
    await pageA.getByRole("button", { name: "Mark in review" }).click();
    await expect(pageA.getByText("Saved.")).toBeVisible();
    await pageB.getByRole("button", { name: "Mark in review" }).click();
    await expect(
      pageB.getByText(
        "This action conflicts with the current state. Refresh and try again.",
      ),
    ).toBeVisible();
    await contextA.close();
    await contextB.close();
  });

  test("wrapping filters, keyboard, Thai and themes", async ({ page }) => {
    const signedIn = await signInOrSkip(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    if (!signedIn) {
      return;
    }

    for (const width of [320, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en/admin/bookings");
      await selectAdminVenue(page, "Night Orchid");
      await expect(
        page.getByRole("heading", { name: "Enquiries" }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/en/v/harbor-light/enquire");
    await page.getByLabel("Your name").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();

    await page.goto("/th/v/harbor-light/enquire");
    await expect(
      page.getByRole("button", { name: "ส่งคำสอบถาม" }),
    ).toBeVisible();
    await expect(
      page.getByText("ส่งคำสอบถาม การดำเนินการนี้ไม่ได้ยืนยันการจอง"),
    ).toBeVisible();

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/admin/bookings");
    await expect(
      page.getByRole("heading", { name: "Enquiries" }),
    ).toBeVisible();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(
      page.getByRole("heading", { name: "Enquiries" }),
    ).toBeVisible();
  });
});
