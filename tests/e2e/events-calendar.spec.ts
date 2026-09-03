import { expect, test, type Page } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

const ATLAS_EDITOR_ID = "00000000-0000-4000-8000-000000000022";
const ATLAS_EDITOR_EMAIL = "atlas.editor@example.com";
const ATLAS_MANAGER_ID = "00000000-0000-4000-8000-000000000021";
const ATLAS_MANAGER_EMAIL = "atlas.manager@example.com";
const ATLAS_OWNER_ID = "00000000-0000-4000-8000-000000000020";
const ATLAS_OWNER_EMAIL = "atlas.owner@example.com";
const HARBOR_OWNER_ID = "00000000-0000-4000-8000-000000000010";
const HARBOR_OWNER_EMAIL = "harbor.owner@example.com";
const COPY_SOURCE_EVENT_ID = "00000000-0000-4000-8000-00000000040c";

function runId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDatetimeLocal(d: Date): string {
  return d.toISOString().slice(0, 16);
}

async function selectAdminVenue(page: Page, venueName: string): Promise<void> {
  const venueSelect = page.locator("#admin-venue");
  if ((await venueSelect.count()) === 0) {
    return;
  }
  await venueSelect.selectOption({ label: venueName });
  await page.getByRole("button", { name: "Use this venue" }).click();
  await expect(venueSelect).toHaveValue(/.+/);
  if (venueName === "Night Orchid") {
    await expect(page.getByRole("link", { name: "Create event" })).toBeVisible({
      timeout: 15_000,
    });
  }
}

async function openEventByTitle(page: Page, title: string): Promise<void> {
  await expect(page.getByText(title, { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("link", { name: `Edit event: ${title}` }).click();
  await expect(page.getByRole("heading", { name: "Edit event" })).toBeVisible();
}

test.describe("events calendar — admin access", () => {
  test("anonymous user cannot access /en/admin/events", async ({ page }) => {
    await page.goto("/en/admin/events");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("atlas.editor can access /en/admin/events", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/events");
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  });

  test("harbor.owner cannot see night_orchid events admin", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Harbor Light");
    const source = await page.content();
    expect(source).not.toContain("Night Orchid Draft");
  });
});

test.describe("events calendar — create and workflow", () => {
  test("editor can create draft, draft is hidden from public, full workflow", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const id = runId();
    const eventTitle = `E2E Event ${id}`;

    const editorSignIn = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!editorSignIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/events/new");
    await expect(
      page.getByRole("heading", { name: "Create event" }),
    ).toBeVisible();

    await page.getByLabel("Title (English)").fill(eventTitle);
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    await page.locator("#starts-at").fill(toDatetimeLocal(startsAt));
    await page.locator("#ends-at").fill(toDatetimeLocal(endsAt));
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/night-orchid");
    const pubSource = await page.content();
    expect(pubSource).not.toContain(eventTitle);

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Night Orchid");
    await openEventByTitle(page, eventTitle);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.context().clearCookies();
    const managerSignIn = await signInSeedUser(
      page,
      ATLAS_MANAGER_ID,
      ATLAS_MANAGER_EMAIL,
    );
    if (!managerSignIn.ok) {
      test.skip(true, "manager sign-in failed");
      return;
    }

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Night Orchid");
    await openEventByTitle(page, eventTitle);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/night-orchid");
    await expect(page.getByText(eventTitle).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Night Orchid");
    await openEventByTitle(page, eventTitle);
    await page.getByRole("button", { name: "Cancel event" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/night-orchid");
    const cancelledSource = await page.content();
    expect(cancelledSource).not.toContain(eventTitle);
  });
});

test.describe("events calendar — copy and cross-business", () => {
  test("same-business copy (night_orchid -> trial_garden) by atlas.owner", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Night Orchid");
    await page.goto(`/en/admin/events/${COPY_SOURCE_EVENT_ID}`);
    await expect(
      page.getByRole("heading", { name: "Edit event" }),
    ).toBeVisible();

    const destSelect = page.getByLabel("Destination venue");
    await destSelect.selectOption({ label: "Trial Garden" });
    await page.getByRole("button", { name: "Copy to venue" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
  });

  test("harbor.owner cannot copy night_orchid event (cross-business denied)", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/events");
    await selectAdminVenue(page, "Harbor Light");
    const source = await page.content();
    expect(source).not.toContain("Copy Source Event");
  });
});

test.describe("events calendar — public display", () => {
  test("module disabled: public calendar not shown on trial_partial", async ({
    page,
  }) => {
    await page.goto("/en/v/trial-partial");
    const source = await page.content();
    expect(source).not.toContain("Disabled Module Public");
  });

  test("English calendar displays on public venue page (night-orchid)", async ({
    page,
  }) => {
    await page.goto("/en/v/night-orchid");
    await expect(
      page.getByRole("heading", { name: "Night Orchid", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Orchid Open Night").first()).toBeVisible();
  });

  test("Thai calendar displays on public venue page (night-orchid)", async ({
    page,
  }) => {
    await page.goto("/th/v/night-orchid");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("คืนดอกกล้วยไม้เปิด").first()).toBeVisible();
  });

  test("public HTML does not expose internal fields", async ({ page }) => {
    await page.goto("/en/v/night-orchid");
    const source = await page.content();
    expect(source).not.toContain("approval_status");
    expect(source).not.toContain("rejection_reason");
    expect(source).not.toContain("actor_user_id");
  });

  test("keyboard navigation on public calendar (Tab and Enter on prev/next)", async ({
    page,
  }) => {
    await page.goto("/en/v/night-orchid");
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();
    await grid.focus();
    await expect(grid).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("PageDown");

    const prevButton = page.getByRole("button", { name: "Previous month" });
    if ((await prevButton.isEnabled()) === true) {
      await prevButton.focus();
      await expect(prevButton).toBeFocused();
      await page.keyboard.press("Enter");
    }

    await expect(
      page.getByRole("heading", { name: "Night Orchid", exact: true }),
    ).toBeVisible();
  });

  test("18+ notice remains independent of the events calendar", async ({
    page,
  }) => {
    await page.goto("/en/v/night-orchid");
    await expect(page.getByTestId("adult-notice")).toBeVisible();
    await expect(page.getByText("Orchid Open Night").first()).toBeVisible();
  });
});
