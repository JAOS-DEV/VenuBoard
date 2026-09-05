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
const COPY_SOURCE_POST_ID = "00000000-0000-4000-8000-00000000050f";

const VENUE_IDS: Record<string, string> = {
  "Harbor Light": "00000000-0000-4000-8000-000000000101",
  "Night Orchid": "00000000-0000-4000-8000-000000000201",
  "Draft Room": "00000000-0000-4000-8000-000000000202",
  "Restricted Room": "00000000-0000-4000-8000-000000000203",
  "Trial Partial": "00000000-0000-4000-8000-000000000206",
};

function runId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    await expect(page.getByTestId("feed-admin")).toHaveAttribute(
      "data-venue-id",
      expectedId,
      { timeout: 15_000 },
    );
  }
}

async function openPostByTitle(page: Page, title: string): Promise<void> {
  await expect(page.getByText(title, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("link", { name: `Edit update: ${title}` }).click();
  await expect(
    page.getByRole("heading", { name: "Edit update" }),
  ).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe("feed — access", () => {
  test("anonymous cannot access feed admin", async ({ page }) => {
    await page.goto("/en/admin/feed");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("harbor.owner can open Harbor Light feed admin", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
    await selectAdminVenue(page, "Harbor Light");
    await expect(
      page.getByRole("link", { name: "Create update" }),
    ).toBeVisible();
  });

  test("atlas.manager cannot select Harbor Light", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_MANAGER_ID,
      ATLAS_MANAGER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    const venueSelect = page.locator("#admin-venue");
    if ((await venueSelect.count()) > 0) {
      const labels = await venueSelect.locator("option").allTextContents();
      expect(labels.join(" ")).not.toContain("Harbor Light");
    }
    const source = await page.content();
    expect(source).not.toContain("Harbour kitchen hours");
    await expect(
      page.getByRole("link", { name: /Edit update: Harbour kitchen hours/ }),
    ).toHaveCount(0);
  });

  test("booking manager is denied feed admin", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_BOOKINGS_ID,
      ATLAS_BOOKINGS_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await expect(
      page.getByText("You do not have a feed action in this venue."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit update/ })).toHaveCount(
      0,
    );
  });
});

test.describe("feed — live database happy path", () => {
  test("create, translate, publish, schedule, unpublish, pin, archive", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const id = runId();
    const title = `Harbor live ${id}`;
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("link", { name: "Create update" }).click();
    await page.getByLabel("Title (English)").fill(title);
    await page.getByLabel("Body (English)").fill("Plain public update.");
    await page.getByLabel("Title (Thai, optional)").fill(`ไทย ${id}`);
    await page.getByLabel("Body (Thai, optional)").fill("ข้อความภาษาไทย");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/en\/admin\/feed\/[0-9a-f-]{36}/);
    const publishedPublic = page.getByRole("link", {
      name: "View public updates",
    });
    await expect(publishedPublic).toBeVisible();
    await expect(publishedPublic).toHaveAttribute(
      "href",
      "/en/v/harbor-light/updates",
    );
    expect(await publishedPublic.getAttribute("href")).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );

    await page.goto("/en/v/harbor-light");
    await expect(page.getByTestId("public-feed-preview")).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto("/en/v/harbor-light/updates");
    await expect(page.getByText(title).first()).toBeVisible();
    const publicSource = await page.content();
    expect(publicSource).not.toContain(HARBOR_OWNER_ID);
    expect(publicSource).not.toContain("pending_approval");
    expect(publicSource).not.toContain("rejection_reason");
    expect(publicSource).not.toContain("actor_user_id");

    await page.goto("/th/v/harbor-light/updates");
    await expect(page.getByText(`ไทย ${id}`).first()).toBeVisible();

    const scheduledTitle = `Harbor later ${id}`;
    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("link", { name: "Create update" }).click();
    await page.getByLabel("Title (English)").fill(scheduledTitle);
    await page.getByLabel("Body (English)").fill("Stays private until due.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await page.locator("#feed-scheduled").fill(toDatetimeLocal(future));
    await page.getByRole("button", { name: "Schedule publication" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light/updates");
    expect(await page.content()).not.toContain(scheduledTitle);

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await openPostByTitle(page, title);
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await page.goto("/en/v/harbor-light/updates");
    expect(await page.content()).not.toContain(title);

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await openPostByTitle(page, title);
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light");
    await expect(page.getByTestId("public-feed-card").first()).toHaveAttribute(
      "data-feed-pinned",
      "true",
    );

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await openPostByTitle(page, title);
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await page.goto("/en/v/harbor-light/updates");
    expect(await page.content()).not.toContain(title);

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("link", { name: "Archived" }).click();
    await openPostByTitle(page, title);
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await page.goto("/en/v/harbor-light/updates");
    expect(await page.content()).not.toContain(title);
  });
});

test.describe("feed — approval and copy", () => {
  test("editor cannot approve own post; manager publishes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const id = runId();
    const title = `Orchid live ${id}`;

    const editorSignIn = await signInSeedUser(
      page,
      ATLAS_EDITOR_ID,
      ATLAS_EDITOR_EMAIL,
    );
    test.skip(!editorSignIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Night Orchid");
    await page.getByRole("link", { name: "Create update" }).click();
    await page.getByLabel("Title (English)").fill(title);
    await page.getByLabel("Body (English)").fill("Needs approval.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish now" })).toHaveCount(
      0,
    );

    await page.goto("/en/v/night-orchid/updates");
    expect(await page.content()).not.toContain(title);

    await page.context().clearCookies();
    const managerSignIn = await signInSeedUser(
      page,
      ATLAS_MANAGER_ID,
      ATLAS_MANAGER_EMAIL,
    );
    test.skip(!managerSignIn.ok, "manager sign-in failed");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Night Orchid");
    await openPostByTitle(page, title);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Publish now" })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/en/v/night-orchid/updates");
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/en/v/night-orchid");
    await expect(page.getByTestId("adult-notice")).toBeVisible();
  });

  test("same-business copy starts as a draft", async ({ page }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Night Orchid");
    await page.goto(`/en/admin/feed/${COPY_SOURCE_POST_ID}`);
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible();
    await page
      .getByLabel("Destination venue")
      .selectOption({ label: "Trial Garden" });
    await page.getByRole("button", { name: "Copy to venue" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
  });

  test("harbor.owner cannot copy Night Orchid content", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    expect(await page.content()).not.toContain("Copy source announcement");
  });
});

test.describe("feed — public gates", () => {
  test("disabled, not entitled, draft and leftover titles stay hidden", async ({
    page,
  }) => {
    await page.goto("/en/v/trial-partial");
    expect(await page.content()).not.toContain("Partial leftover");
    await page.goto("/en/v/draft-room");
    expect(await page.content()).not.toContain("Draft room leftover");
    await page.goto("/en/v/silent-room");
    expect(await page.content()).not.toContain("Silent leftover");
    await page.goto("/en/v/night-orchid/updates");
    const source = await page.content();
    expect(source).not.toContain("Night Orchid Draft");
    expect(source).not.toContain("Future closing notice");
    expect(source).toContain("Due scheduled update");
  });

  test("restricted venue still shows a public notice", async ({ page }) => {
    await page.goto("/en/v/restricted-room/updates");
    await expect(page.getByText("Restricted room notice")).toBeVisible();
  });

  test("English-only post falls back on the Thai page", async ({ page }) => {
    await page.goto("/th/v/harbor-light/updates");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("English-only harbour note")).toBeVisible();
  });

  test("script text is escaped", async ({ page }) => {
    test.setTimeout(60_000);
    const id = runId();
    const title = `Harbor xss ${id}`;
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("link", { name: "Create update" }).click();
    await page.getByLabel("Title (English)").fill(title);
    await page
      .getByLabel("Body (English)")
      .fill("<script>window.__feedXss=1</script>");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/v/harbor-light/updates");
    const xssCard = page.getByTestId("public-feed-card").filter({
      hasText: title,
    });
    await expect(xssCard).toBeVisible();
    await expect(
      xssCard.getByText("<script>window.__feedXss=1</script>"),
    ).toBeVisible();
    const executed = await page.evaluate(() => {
      return (window as unknown as { __feedXss?: number }).__feedXss === 1;
    });
    expect(executed).toBe(false);

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await openPostByTitle(page, title);
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("feed — module states", () => {
  test("trial partial is disabled and draft room is not entitled", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      ATLAS_OWNER_ID,
      ATLAS_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Trial Partial");
    await expect(
      page.getByText("Updates are turned off for this venue."),
    ).toBeVisible();

    await selectAdminVenue(page, "Draft Room");
    await expect(
      page.getByText("Updates are not included in this venue’s plan."),
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

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Restricted Room");
    await expect(
      page
        .getByText("Writes are paused for this venue’s subscription.")
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Create update" })).toHaveCount(
      0,
    );
  });
});

test.describe("feed — responsive, theme, pagination", () => {
  for (const width of [320, 375, 390, 430, 768, 1280] as const) {
    test(`no overflow at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({
        width,
        height: width >= 768 ? 1024 : 844,
      });
      await page.goto("/en/v/harbor-light/updates");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test("light and dark presentation", async ({ page }) => {
    await page.goto("/en/v/harbor-light/updates");
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("public-feed-card").first()).toBeVisible();
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("load more appears and keyboard can reach it", async ({ page }) => {
    await page.goto("/en/v/harbor-light/updates");
    const loadMore = page.getByRole("button", { name: "Load more" });
    await expect(loadMore).toBeVisible();
    await loadMore.focus();
    await expect(loadMore).toBeFocused();
    const before = await page.getByTestId("public-feed-card").count();
    expect(before).toBeGreaterThan(0);
    await loadMore.click();
    await expect
      .poll(async () => page.getByTestId("public-feed-card").count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(before);
  });
});

const HARBOR_KITCHEN_POST_ID = "00000000-0000-4000-8000-000000000501";
const HARBOR_KITCHEN_TITLE = "Harbour kitchen hours";

async function assertEditActionLooksLikeAButton(page: Page): Promise<void> {
  const edit = page.getByRole("link", {
    name: `Edit update: ${HARBOR_KITCHEN_TITLE}`,
  });
  await expect(edit).toBeVisible();
  const metrics = await edit.evaluate((element) => {
    const styles = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      height: box.height,
      borderWidth: Number.parseFloat(styles.borderTopWidth),
      background: styles.backgroundColor,
    };
  });
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.borderWidth).toBeGreaterThanOrEqual(1);
  expect(metrics.background).not.toMatch(
    /^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/,
  );
}

test.describe("feed — edit action", () => {
  test("authorized owner can keyboard-activate a 44px edit button", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    const edit = page.getByRole("link", {
      name: `Edit update: ${HARBOR_KITCHEN_TITLE}`,
    });
    await expect(edit).toBeVisible();
    await expect(edit).toHaveAccessibleName(
      `Edit update: ${HARBOR_KITCHEN_TITLE}`,
    );
    await assertEditActionLooksLikeAButton(page);
    await edit.focus();
    await expect(edit).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/en/admin/feed/${HARBOR_KITCHEN_POST_ID}`),
    );
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible();
  });

  test("Thai locale keeps a labelled edit action", async ({ page }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.goto("/th/admin/feed");
    const edit = page.getByRole("link", { name: /แก้ไขข่าวสาร/ });
    await expect(edit.first()).toBeVisible();
    await edit.first().click();
    await expect(page).toHaveURL(/\/th\/admin\/feed\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole("heading", { name: "แก้ไขข่าวสาร" }),
    ).toBeVisible();
  });

  test("edit action stays distinct in light and dark themes", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      HARBOR_OWNER_ID,
      HARBOR_OWNER_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/feed");
    await selectAdminVenue(page, "Harbor Light");
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await assertEditActionLooksLikeAButton(page);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await assertEditActionLooksLikeAButton(page);
  });
});

async function openHarborFeedAdmin(page: Page): Promise<boolean> {
  const signedIn = await signInSeedUser(
    page,
    HARBOR_OWNER_ID,
    HARBOR_OWNER_EMAIL,
  );
  if (!signedIn.ok) {
    return false;
  }
  await page.goto("/en/admin/feed");
  await selectAdminVenue(page, "Harbor Light");
  await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
  return true;
}

async function assertFilterSelectsReachable(page: Page): Promise<void> {
  const status = page.getByRole("combobox", { name: "Status" });
  const type = page.getByRole("combobox", { name: "Content type" });
  await expect(status).toBeVisible();
  await expect(type).toBeVisible();
  await expect(page.getByTestId("responsive-filter-selects")).toBeVisible();
  await expect(page.getByTestId("responsive-filter-chips")).toBeHidden();
  await expect(status).toHaveAccessibleName("Status");
  await expect(type).toHaveAccessibleName("Content type");
  await expect(status.locator("option")).toHaveText([
    "All",
    "Drafts",
    "Awaiting approval",
    "Scheduled",
    "Published",
    "Archived",
  ]);
  await expect(type.locator("option")).toHaveText([
    "All types",
    "Update",
    "Announcement",
    "Notice",
  ]);
  const metrics = await page.evaluate(() => {
    const root = document.querySelector(
      '[data-testid="responsive-filter-selects"]',
    );
    if (!(root instanceof HTMLElement)) {
      return { rowOverflow: true, clipped: true, minHeight: 0 };
    }
    const selects = [...root.querySelectorAll("select")];
    const rowOverflow = root.scrollWidth > root.clientWidth + 1;
    const clipped = selects.some((el) => {
      const box = el.getBoundingClientRect();
      return box.left < -1 || box.right > window.innerWidth + 1;
    });
    const minHeight = Math.min(
      ...selects.map((el) => el.getBoundingClientRect().height),
    );
    return { rowOverflow, clipped, minHeight };
  });
  expect(metrics.rowOverflow).toBe(false);
  expect(metrics.clipped).toBe(false);
  expect(metrics.minHeight).toBeGreaterThanOrEqual(44);
}

test.describe("feed — admin filters, public destination, navigation", () => {
  for (const width of [320, 375] as const) {
    test(`admin feed has no horizontal overflow at ${String(width)}px`, async ({
      page,
    }) => {
      test.skip(
        !(await openHarborFeedAdmin(page)),
        "local Supabase identity is required",
      );
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/en/admin/feed");
      await expect(page.getByTestId("feed-admin")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  for (const width of [390, 430] as const) {
    test(`admin filters are reachable without sideways scrolling at ${String(width)}px`, async ({
      page,
    }) => {
      test.skip(
        !(await openHarborFeedAdmin(page)),
        "local Supabase identity is required",
      );
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/en/admin/feed");
      await assertFilterSelectsReachable(page);
      await assertNoHorizontalOverflow(page);
    });
  }

  test("status and content-type filters keep working for keyboard users", async ({
    page,
  }) => {
    test.skip(
      !(await openHarborFeedAdmin(page)),
      "local Supabase identity is required",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/admin/feed");
    const status = page.getByRole("combobox", { name: "Status" });
    const type = page.getByRole("combobox", { name: "Content type" });
    await status.focus();
    await expect(status).toBeFocused();
    await status.selectOption("draft");
    await expect(page).toHaveURL(/filter=draft/);
    await expect(status).toHaveValue("draft");
    await type.focus();
    await expect(type).toBeFocused();
    await type.selectOption("notice");
    await expect(page).toHaveURL(/filter=draft/);
    await expect(page).toHaveURL(/type=notice/);
    await expect(type).toHaveValue("notice");
    await expect(status).toHaveValue("draft");
  });

  test("English and Thai filter labels render", async ({ page }) => {
    test.skip(
      !(await openHarborFeedAdmin(page)),
      "local Supabase identity is required",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/admin/feed");
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Content type" }),
    ).toBeVisible();
    await page.goto("/th/admin/feed");
    await expect(page.getByRole("combobox", { name: "สถานะ" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "ประเภทเนื้อหา" }),
    ).toBeVisible();
  });

  test("list and Thai locale expose a venue-scoped public updates link", async ({
    page,
  }) => {
    test.skip(
      !(await openHarborFeedAdmin(page)),
      "local Supabase identity is required",
    );
    await page.goto("/en/admin/feed");
    const listPublic = page.getByRole("link", { name: "View public updates" });
    await expect(listPublic).toBeVisible();
    await expect(listPublic).toHaveAttribute(
      "href",
      "/en/v/harbor-light/updates",
    );
    expect(await listPublic.getAttribute("href")).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );

    await page.goto("/th/admin/feed");
    const thaiPublic = page.getByRole("link", { name: "ดูข่าวสารสาธารณะ" });
    await expect(thaiPublic).toBeVisible();
    await expect(thaiPublic).toHaveAttribute(
      "href",
      "/th/v/harbor-light/updates",
    );
  });

  test("published seed post exposes View public updates without leaving admin", async ({
    page,
  }) => {
    test.skip(
      !(await openHarborFeedAdmin(page)),
      "local Supabase identity is required",
    );
    await openPostByTitle(page, HARBOR_KITCHEN_TITLE);
    await expect(page).toHaveURL(
      new RegExp(`/en/admin/feed/${HARBOR_KITCHEN_POST_ID}`),
    );
    const publicLink = page.getByRole("link", { name: "View public updates" });
    await expect(publicLink).toBeVisible();
    await expect(publicLink).toHaveAttribute(
      "href",
      "/en/v/harbor-light/updates",
    );
    expect(await publicLink.getAttribute("href")).not.toContain(
      HARBOR_KITCHEN_POST_ID,
    );
    await expect(
      page.getByRole("heading", { name: "Edit update" }),
    ).toBeVisible();
  });

  test("mobile bottom navigation and desktop surfaces switch at md", async ({
    page,
  }) => {
    test.skip(
      !(await openHarborFeedAdmin(page)),
      "local Supabase identity is required",
    );
    const bottom = page.getByRole("navigation", {
      name: "Venue administration",
    });
    const desktop = page.getByRole("navigation", { name: "Surfaces" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/admin/feed");
    await expect(bottom).toBeVisible();
    await expect(bottom.getByRole("link", { name: "Updates" })).toBeVisible();
    await expect(desktop).toBeHidden();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(bottom).toBeHidden();
    await expect(desktop).toBeVisible();
    await expect(desktop.getByRole("link", { name: "Updates" })).toBeVisible();
  });

  test("booking manager still cannot use feed even when navigation is present", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      ATLAS_BOOKINGS_ID,
      ATLAS_BOOKINGS_EMAIL,
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/admin/feed");
    await expect(
      page.getByText("You do not have a feed action in this venue."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit update/ })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("responsive-filter-selects")).toHaveCount(0);
  });
});
