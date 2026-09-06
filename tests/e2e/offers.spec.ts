import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";
const ATLAS_OWNER_ID = "00000000-0000-4000-8000-000000000020";
const ATLAS_OWNER_EMAIL = "atlas.owner@example.com";
const ATLAS_MANAGER_ID = "00000000-0000-4000-8000-000000000021";
const ATLAS_MANAGER_EMAIL = "atlas.manager@example.com";
const ATLAS_EDITOR_ID = "00000000-0000-4000-8000-000000000022";
const ATLAS_EDITOR_EMAIL = "atlas.editor@example.com";
const ATLAS_BOOKINGS_ID = "00000000-0000-4000-8000-000000000023";
const ATLAS_BOOKINGS_EMAIL = "atlas.bookings@example.com";

const VENUE_IDS: Record<string, string> = {
  "Harbor Light": "00000000-0000-4000-8000-000000000101",
  "Night Orchid": "00000000-0000-4000-8000-000000000201",
  "Trial Garden": "00000000-0000-4000-8000-000000000205",
};

function runId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bangkokLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
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
    await expect(page.getByTestId("offers-admin")).toHaveAttribute(
      "data-venue-id",
      expectedId,
      { timeout: 15_000 },
    );
  }
}

async function enablePublicOffers(page: Page): Promise<void> {
  const enabled = page.locator('input[name="isEnabled"]');
  if ((await enabled.count()) === 0) {
    return;
  }
  await enabled.check();
  await page.locator('input[name="isPubliclyVisible"]').check();
  await page.locator('input[name="homepagePreviewEnabled"]').check();
  await page.locator('input[name="requireManagerApproval"]').uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Saved", {
    timeout: 15_000,
  });
}

async function createDraftOffer(
  page: Page,
  input: {
    title: string;
    validFrom: string;
    validUntil: string;
    titleTh?: string;
    descriptionTh?: string;
    termsTh?: string;
  },
): Promise<void> {
  await page.getByRole("link", { name: "Create offer" }).click();
  await expect(page.getByRole("heading", { name: "New offer" })).toBeVisible();
  await page.getByLabel("Title (English)").fill(input.title);
  await page
    .getByLabel("Description (English)")
    .fill("A fictional lunch promotion for tests.");
  await page.getByLabel("Terms (English)").fill("Informational only.");
  if (input.titleTh) {
    await page.getByLabel("Title (Thai, optional)").fill(input.titleTh);
    await page
      .getByLabel("Description (Thai, optional)")
      .fill(input.descriptionTh ?? "คำอธิบาย");
    await page
      .getByLabel("Terms (Thai, optional)")
      .fill(input.termsTh ?? "ข้อมูลเท่านั้น");
  }
  await page.getByLabel("Valid from (venue time)").fill(input.validFrom);
  await page
    .getByLabel("Valid until (venue time, exclusive)")
    .fill(input.validUntil);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Edit offer" })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("offers — access", () => {
  test("anonymous cannot access offers admin", async ({ page }) => {
    await page.goto("/en/admin/offers");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("harbor.owner can open Harbor Light offers admin", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await expect(page.getByRole("heading", { name: "Offers" })).toBeVisible();
  });

  test("booking manager cannot manage offers", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_BOOKINGS_ID,
      ATLAS_BOOKINGS_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await expect(
      page.getByText("You do not have an offers action in this venue."),
    ).toBeVisible();
  });
});

test.describe("offers — happy path", () => {
  test("owner creates, publishes and views a public offer", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const title = `Harbour lunch ${runId()}`;
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await enablePublicOffers(page);
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    await createDraftOffer(page, {
      title,
      validFrom: from,
      validUntil: until,
      titleTh: "ชุดอาหารทดสอบ",
      descriptionTh: "โปรโมชันสมมติ",
      termsTh: "ข้อมูลเท่านั้น",
    });
    await page
      .getByLabel("Description (English)")
      .fill("A fictional lunch. <script>window.__offerXss=1</script>");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(
      page.getByRole("link", { name: "View public offers" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/en/v/harbor-light/offers");
    const publicCard = page
      .getByTestId("public-offer-card")
      .filter({ hasText: title });
    await expect(publicCard).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      publicCard.getByText("<script>window.__offerXss=1</script>"),
    ).toBeVisible();
    const cardHtml = await publicCard.innerHTML();
    expect(cardHtml).not.toContain("dangerouslySetInnerHTML");
    const executed = await page.evaluate(() => {
      return (window as unknown as { __offerXss?: number }).__offerXss === 1;
    });
    expect(executed).toBe(false);

    const publicSource = await page.content();
    expect(publicSource).not.toContain(HARBOR_OWNER_ID);
    expect(publicSource).not.toContain("approved_at");
    expect(publicSource).not.toContain("pending_approval");
    expect(publicSource).not.toContain("rejection_reason");
    expect(publicSource).not.toContain("actor_user_id");
  });

  test("future-valid offers stay off the public list", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const title = `Future tasting ${runId()}`;
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await enablePublicOffers(page);
    const from = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    const until = bangkokLocal(new Date(Date.now() + 14 * 24 * 60 * 60_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.goto("/en/v/harbor-light/offers");
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("an open public page hides an offer after expiry", async ({ page }) => {
    test.setTimeout(120_000);
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const title = `Short lunch ${runId()}`;
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await enablePublicOffers(page);
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 90_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.goto("/en/v/harbor-light/offers");
    const card = page
      .getByTestId("public-offer-card")
      .filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveCount(0, { timeout: 100_000 });
  });
});

test.describe("offers — workflow", () => {
  test("unpublish, archive and restore stay private", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const title = `Archive lunch ${runId()}`;
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await enablePublicOffers(page);
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("button", { name: "Publish now" })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await page.goto("/en/v/harbor-light/offers");
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/en/admin/offers");
    await page.getByRole("link", { name: `Edit offer: ${title}` }).click();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(
      page.getByRole("button", { name: "Restore to draft" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await expect(page.getByRole("button", { name: "Publish now" })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await page.goto("/en/v/harbor-light/offers");
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("editor cannot self-approve at Trial Garden", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Trial Garden");
    await expect(
      page.getByRole("link", { name: "Create offer" }),
    ).toBeVisible();
    const title = `Garden pastry ${runId()}`;
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    if ((await page.getByRole("button", { name: "Approve" }).count()) > 0) {
      await page.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByRole("status")).toContainText(
        "You do not have permission for that.",
      );
    } else {
      await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(
        0,
      );
    }
  });

  test("material edit invalidates approval", async ({ page, browser }) => {
    const editor = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!editor.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Trial Garden");
    await expect(
      page.getByRole("link", { name: "Create offer" }),
    ).toBeVisible();
    const title = `Approved soup ${runId()}`;
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    const manager = await signInSeedUser(
      managerPage,
      ATLAS_MANAGER_ID,
      ATLAS_MANAGER_EMAIL,
    );
    test.skip(!manager.ok, "local Supabase identity is required");
    await managerPage.goto("/en/admin/offers");
    await selectAdminVenue(managerPage, "Trial Garden");
    await managerPage
      .getByRole("link", { name: `Edit offer: ${title}` })
      .click();
    await managerPage.getByRole("button", { name: "Approve" }).click();
    await expect(managerPage.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await expect(
      managerPage.getByRole("button", { name: "Publish now" }),
    ).toBeVisible();
    await expect(
      managerPage.getByRole("button", { name: "Schedule publication" }),
    ).toBeVisible();

    await page.reload();
    await page.getByLabel("Title (English)").fill(`${title} edited`);
    await page
      .getByLabel("Description (English)")
      .fill("Edited fictional soup copy.");
    await page
      .getByLabel("Terms (English)")
      .fill("Edited informational terms.");
    await page.getByLabel("Title (Thai, optional)").fill("ซุปแก้ไข");
    await page
      .getByLabel("Description (Thai, optional)")
      .fill("คำอธิบายที่แก้ไข");
    await page.getByLabel("Terms (Thai, optional)").fill("ข้อกำหนดที่แก้ไข");
    await page
      .getByLabel("Valid until (venue time, exclusive)")
      .fill(bangkokLocal(new Date(Date.now() + 8 * 24 * 60 * 60_000)));
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Publish now" })).toHaveCount(
      0,
    );

    await managerPage.reload();
    await expect(
      managerPage.getByRole("button", { name: "Publish now" }),
    ).toHaveCount(0);
    await expect(
      managerPage.getByRole("button", { name: "Schedule publication" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await managerPage.reload();
    await managerPage.getByRole("button", { name: "Approve" }).click();
    await expect(managerPage.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await managerPage.getByRole("button", { name: "Publish now" }).click();
    await expect(
      managerPage.getByRole("button", { name: "Unpublish" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await managerPage.goto("/en/v/trial-garden/offers");
    await expect(managerPage.getByText(`${title} edited`)).toBeVisible({
      timeout: 15_000,
    });
    await managerContext.close();
  });
});

test.describe("offers — module states and locales", () => {
  test("Night Orchid offers remain unavailable", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Night Orchid");
    await expect(
      page.getByText("Offers are not included in this venue’s plan."),
    ).toBeVisible();
    await page.goto("/en/v/night-orchid/offers");
    await expect(
      page.getByText("Offers are not available for this venue."),
    ).toBeVisible();
  });

  test("Thai locale falls back to English for EN-only copy", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    const title = `English salad ${runId()}`;
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await enablePublicOffers(page);
    const from = bangkokLocal(new Date(Date.now() - 60_000));
    const until = bangkokLocal(new Date(Date.now() + 7 * 24 * 60 * 60_000));
    await createDraftOffer(page, { title, validFrom: from, validUntil: until });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", {
      timeout: 15_000,
    });
    await page.goto("/th/v/harbor-light/offers");
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });

  test("keyboard, mobile and theme checks", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/offers");
    await selectAdminVenue(page, "Harbor Light");
    await page.keyboard.press("Tab");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(overflow).toBe(false);
    await page.goto("/en/v/harbor-light/offers");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("class", /dark|/);
  });
});
