import { expect, test } from "@playwright/test";

import { signInSeedUser } from "./helpers/platform-identity";

test.describe("staff presence", () => {
  test("anonymous cannot access staff admin", async ({ page }) => {
    await page.goto("/en/admin/staff");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unknown public slug does not leak private staff fields", async ({
    page,
  }) => {
    await page.goto("/en/v/blue-parrot-bar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Harbor Light|Venue not available/,
    );
    const source = await page.content();
    expect(source).not.toContain("Mina Cole (internal)");
    expect(source).not.toContain("internal_display_name");
  });

  test("harbor-light public carousel is English and keyboard operable", async ({
    page,
  }) => {
    await page.goto("/en/v/harbor-light");
    await expect(
      page.getByRole("heading", { level: 1, name: "Harbor Light" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Team on the floor" }),
    ).toBeVisible();
    await expect(page.getByText("Mina Cole")).toBeVisible();
    await expect(page.getByText("In now")).toBeVisible();
    await expect(page.getByText("Jules Park")).toHaveCount(0);
    const scroller = page.locator("[tabindex='0']").first();
    await scroller.focus();
    await page.keyboard.press("ArrowRight");
    const source = await page.content();
    expect(source).not.toContain("Mina Cole (internal)");
    expect(source).not.toContain("harbor.owner@example.com");
  });

  test("Thai public carousel uses Thai heading and bio", async ({ page }) => {
    await page.goto("/th/v/harbor-light");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("ทีมที่อยู่ตอนนี้")).toBeVisible();
    await expect(page.getByText("โฮสต์ริมท่าเรือสำหรับรอบเย็น")).toBeVisible();
  });

  test("18+ notice remains independent of staff at night-orchid", async ({
    page,
  }) => {
    await page.goto("/en/v/night-orchid");
    await expect(page.getByTestId("adult-notice")).toBeVisible();
    await expect(page.getByText("In tonight")).toBeVisible();
    await expect(page.getByText("Nok Siri")).toBeVisible();
    await expect(page.getByText("Casey Ng")).toHaveCount(0);
    await expect(page.getByText("Sam Harbor")).toHaveCount(0);
  });

  test("owner can add, publish, toggle and withdraw on the live database", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const signedIn = await signInSeedUser(
      page,
      "00000000-0000-4000-8000-000000000010",
      "harbor.owner@example.com",
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");

    await page.goto("/en/admin/staff");
    await expect(
      page.getByRole("heading", { name: "Staff presence" }),
    ).toBeVisible();

    const venueSelect = page.getByRole("combobox", { name: "Venue" });
    if ((await venueSelect.count()) > 0) {
      await venueSelect.selectOption({ label: "Harbor Light" });
      await page.getByRole("button", { name: "Use this venue" }).click();
      await expect(
        page.getByRole("heading", { name: "Staff presence" }),
      ).toBeVisible();
    }

    const runId = Date.now().toString(36);
    const publicName = `E2E Harbor Public ${runId}`;

    await page
      .getByLabel("Internal display name")
      .fill(`E2E Harbor Internal ${runId}`);
    await page.getByLabel("Public display name").fill(publicName);
    await page.getByRole("button", { name: "Add staff" }).click();
    await expect(page.getByRole("heading", { name: publicName })).toBeVisible();

    const card = page.locator("[data-slot='card']").filter({
      hasText: publicName,
    });
    await card.getByRole("button", { name: "Record consent granted" }).click();
    await card
      .locator("select[name='publicationState']")
      .selectOption("published");
    await card.getByRole("button", { name: "Save public profile" }).click();
    await card.getByRole("button", { name: "Mark present" }).click();

    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(publicName)).toBeVisible();
    await expect(page.getByText("In now").first()).toBeVisible();

    await page.goto("/en/admin/staff");
    const liveCard = page.locator("[data-slot='card']").filter({
      hasText: publicName,
    });
    await liveCard.getByRole("button", { name: "Mark not present" }).click();
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(publicName)).toBeVisible();
    await expect(
      page
        .locator("article")
        .filter({ hasText: publicName })
        .getByText("Not currently in"),
    ).toBeVisible();

    await page.goto("/en/admin/staff");
    const withdrawn = page.locator("[data-slot='card']").filter({
      hasText: publicName,
    });
    await withdrawn.getByRole("button", { name: "Withdraw consent" }).click();
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(publicName)).toHaveCount(0);

    await page.goto("/en/admin/staff");
    const deactivateCard = page.locator("[data-slot='card']").filter({
      hasText: publicName,
    });
    await deactivateCard.getByLabel(/I confirm deactivation/).check();
    await deactivateCard.getByRole("button", { name: "Deactivate" }).click();
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(publicName)).toHaveCount(0);

    await page.goto("/en/admin/staff");
    const restoreCard = page.locator("[data-slot='card']").filter({
      hasText: publicName,
    });
    await restoreCard.getByLabel(/I confirm restoration/).check();
    await restoreCard.getByRole("button", { name: "Restore" }).click();
    await expect(
      restoreCard.getByText("draft", { exact: false }),
    ).toBeVisible();
    await page.goto("/en/v/harbor-light");
    await expect(page.getByText(publicName)).toHaveCount(0);
  });

  test("manager can open night-orchid and cannot see harbor private names", async ({
    page,
  }) => {
    const signedIn = await signInSeedUser(
      page,
      "00000000-0000-4000-8000-000000000021",
      "atlas.manager@example.com",
    );
    test.skip(!signedIn.ok, "local Supabase identity is required");
    await page.goto("/en/admin/staff");
    await expect(
      page.getByRole("heading", { name: "Staff presence" }),
    ).toBeVisible();
    const source = await page.content();
    expect(source).not.toContain("Mina Cole (internal)");
  });

  test("module disabled venue does not render a staff carousel", async ({
    page,
  }) => {
    await page.goto("/en/v/trial-partial");
    await expect(page.getByText("Lina Pratt")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Trial Partial" }),
    ).toBeVisible();
  });
});
