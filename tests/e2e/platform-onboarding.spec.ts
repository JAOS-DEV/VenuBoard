import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { IDEMPOTENCY_STORAGE_KEY } from "../../src/core/onboarding/constants";
import {
  LIVE_BUSINESS_NAME,
  LIVE_DESCRIPTION_EN,
  LIVE_DESCRIPTION_TH,
  LIVE_LEGAL_NAME,
  LIVE_VENUE_NAME_EN,
  LIVE_VENUE_NAME_TH,
  liveOnboardingIdentity,
  loadLiveOnboardingFacts,
  retryLiveOnboarding,
  trialWindowLooksStandard,
  type LiveOnboardingIdentity,
} from "./helpers/onboarding-live";
import {
  openWithTestIdentity,
  signInPlatformAdmin,
} from "./helpers/platform-identity";

async function fillWizard(
  page: Page,
  identity: Pick<
    LiveOnboardingIdentity,
    "slug" | "ownerEmail" | "businessName" | "legalName"
  >,
): Promise<void> {
  await page.getByLabel("Business display name").fill(identity.businessName);
  await page.getByLabel("Legal business name").fill(identity.legalName);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("English venue name").fill(LIVE_VENUE_NAME_EN);
  await page.getByLabel("Thai venue name (optional)").fill(LIVE_VENUE_NAME_TH);
  await page
    .getByLabel("English description (optional)")
    .fill(LIVE_DESCRIPTION_EN);
  await page
    .getByLabel("Thai description (optional)")
    .fill(LIVE_DESCRIPTION_TH);
  await page.getByLabel("Venue slug").fill(identity.slug);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("radio", { name: /General/ }).check();
  await page
    .getByRole("checkbox", { name: /Also support Thai content/ })
    .check();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("checkbox", { name: /^Offers/ }).waitFor();
  await page.getByRole("checkbox", { name: /^Offers/ }).uncheck();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("First business-owner email").fill(identity.ownerEmail);
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

test.describe("platform onboarding access", () => {
  test("sends anonymous users from /platform/onboard to sign-in", async ({
    page,
  }) => {
    await page.goto("/en/platform/onboard");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/platform/onboard");
  });

  test("rejects an external return path from the platform surface", async ({
    page,
  }) => {
    await page.goto("/en/platform?next=https://evil.example");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/platform");
    expect(url.searchParams.get("next")).not.toContain("evil");
  });

  test("lets a platform admin reach the English wizard", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-admin",
    );
    await page.goto("/en/platform/onboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: "Onboard a business and first venue" }),
    ).toBeVisible();
    await expect(page.getByLabel("Business display name")).toBeVisible();
    await context.close();
  });

  test("renders the Thai wizard", async ({ browser, baseURL }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-admin",
    );
    await page.goto("/th/platform/onboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(
      page.getByRole("heading", {
        name: "สร้างธุรกิจและสถานประกอบการแรก",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "ถัดไป" })).toBeVisible();
    await context.close();
  });

  test("keeps platform support off the onboarding wizard", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-support",
    );
    await page.goto("/en/platform/onboard");
    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/unauthorized/);
    await context.close();
  });

  test("blocks an incomplete submission on the first step", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-admin",
    );
    await page.goto("/en/platform/onboard");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByText("Check the highlighted fields before continuing."),
    ).toBeVisible();
    await expect(page.getByLabel("Business display name")).toBeVisible();
    await context.close();
  });

  test("shows the unpublished warning on review", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-admin",
    );
    await page.goto("/en/platform/onboard");
    await fillWizard(page, {
      slug: "e2e-review-lotus",
      ownerEmail: "review.owner@example.com",
      businessName: LIVE_BUSINESS_NAME,
      legalName: LIVE_LEGAL_NAME,
    });
    await expect(
      page.getByText(/This venue will be created unpublished/),
    ).toBeVisible();
    await expect(page.getByText("E2E Lotus Holdings")).toBeVisible();
    await expect(page.getByText("e2e-review-lotus")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create unpublished venue" }),
    ).toBeVisible();
    await context.close();
  });
});

test.describe("platform onboarding RPC result", () => {
  test("creates an unpublished venue and a one-time invitation", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const session = await signInPlatformAdmin(page);
    test.skip(
      !session.ok,
      "local Supabase URL and SUPABASE_SECRET_KEY are required",
    );

    const identity = liveOnboardingIdentity(randomBytes(4).toString("hex"));
    await page.goto("/en/platform/onboard");
    await fillWizard(page, identity);
    await expect(
      page.getByRole("button", { name: "Create unpublished venue" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create unpublished venue" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Venue created" }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("The venue is unpublished. It is not publicly visible."),
    ).toBeVisible();
    await expect(
      page.getByText("Invitation created, not emailed."),
    ).toBeVisible();

    const invite = page.getByLabel("One-time invitation link");
    await expect(invite).toBeVisible();
    const tokenPath = await invite.inputValue();
    expect(tokenPath).toMatch(/^\/en\/invite\//);
    const token = tokenPath.split("/").pop() ?? "";
    expect(token.length).toBeGreaterThan(16);

    const idempotencyKey = await page.evaluate(
      (key) => window.sessionStorage.getItem(key),
      IDEMPOTENCY_STORAGE_KEY,
    );
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const persisted = await page.evaluate(() => ({
      session: { ...window.sessionStorage },
      local: { ...window.localStorage },
    }));
    expect(JSON.stringify(persisted)).not.toContain(token);

    const overviewHref = await page
      .getByRole("link", { name: "Open venue overview" })
      .getAttribute("href");
    expect(overviewHref).toBeTruthy();
    expect(overviewHref ?? "").not.toContain(token);

    const facts = await loadLiveOnboardingFacts(
      {
        slug: identity.slug,
        rawToken: token,
        idempotencyKey: idempotencyKey ?? "",
      },
      {
        email: session.email,
        password: session.password,
      },
    );
    expect(facts).not.toBeNull();
    expect(facts?.businessId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(facts?.venueId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(facts?.businessCount).toBe(1);
    expect(facts?.venueCount).toBe(1);
    expect(facts?.onboardingRunCount).toBe(1);
    expect(facts?.publicationState).toBe("draft");
    expect(facts?.classification).toBe("general");
    expect(facts?.timezone).toBe("Asia/Bangkok");
    expect(facts?.subscriptionVenueId).toBeTruthy();
    expect(facts?.subscriptionState).toBe("trial");
    expect(trialWindowLooksStandard(facts?.trialEndsAt ?? null)).toBe(true);
    expect(facts?.entitledModules).toContain("core_profile");
    expect(facts?.entitledModules).not.toContain("offers");
    expect(facts?.deniedModules).toEqual([]);
    expect(facts?.usedBytes).toBe(0);
    expect(facts?.quotaBytes).toBe(facts?.planQuotaBytes);
    expect(facts?.quotaBytes).toBeGreaterThan(0);
    expect(facts?.primaryColor).toBe("#1F2937");
    expect(facts?.themeKey).toBe("system");
    expect(facts?.englishName).toBe(LIVE_VENUE_NAME_EN);
    expect(facts?.thaiName).toBe(LIVE_VENUE_NAME_TH);
    expect(facts?.invitationScope).toBe("business");
    expect(facts?.invitationRole).toBe("business_owner");
    expect(facts?.invitationVenueId).toBeNull();
    expect(facts?.tokenHashLooksHashed).toBe(true);
    expect(facts?.tokenHashMatches).toBe(true);
    expect(facts?.rawTokenStored).toBe(false);
    expect(facts?.summaryHasToken).toBe(false);
    expect(facts?.auditHasToken).toBe(false);

    const retry = await retryLiveOnboarding({
      email: session.email,
      password: session.password,
      idempotencyKey: idempotencyKey ?? "",
      identity,
    });
    expect(retry).toEqual({
      ok: true,
      idempotent: true,
      hasToken: false,
      businessId: facts?.businessId ?? null,
      venueId: facts?.venueId ?? null,
    });

    const afterRetry = await loadLiveOnboardingFacts(
      {
        slug: identity.slug,
        rawToken: token,
        idempotencyKey: idempotencyKey ?? "",
      },
      {
        email: session.email,
        password: session.password,
      },
    );
    expect(afterRetry?.businessId).toBe(facts?.businessId);
    expect(afterRetry?.venueId).toBe(facts?.venueId);
    expect(afterRetry?.businessCount).toBe(1);
    expect(afterRetry?.venueCount).toBe(1);
    expect(afterRetry?.onboardingRunCount).toBe(1);

    await page.goto(tokenPath);
    await expect(
      page.getByRole("heading", { name: "Accept your invitation" }),
    ).toBeVisible();
    await expect(page.getByText(/business_owner/)).toBeVisible();
    await expect(page.getByText(identity.ownerEmail)).toBeVisible();

    await page.goto(overviewHref ?? "/en/platform");
    await expect(
      page.getByRole("heading", { name: "Platform venue overview" }),
    ).toBeVisible();
    expect(page.url()).not.toContain(token);
    await expect(page.getByText("Unpublished", { exact: true })).toBeVisible();
    await expect(page.getByText(/Entitled modules:/)).toContainText(
      "core_profile",
    );
    await expect(page.getByText(/Entitled modules:/)).not.toContainText(
      "offers",
    );
    await expect(page.getByText(String(facts?.quotaBytes))).toBeVisible();
    await expect(
      page.getByText("The raw invitation token is not stored on this page."),
    ).toBeVisible();
    await expect(page.getByText(token)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(token)).toHaveCount(0);
    await expect(
      page.getByText(
        "This venue remains unpublished until an operator deliberately publishes it.",
      ),
    ).toBeVisible();
  });
});
