import { expect, test, type Page } from "@playwright/test";

async function waitForHomepage(page: Page, venue: string): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: venue, exact: true }),
  ).toBeVisible();
}

async function scrollHomepage(page: Page): Promise<number> {
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(max).toBeGreaterThan(200);
  const y = Math.round(Math.max(220, max * 0.55));
  await page.evaluate((top) => {
    window.scrollTo(0, top);
    window.dispatchEvent(new Event("scroll"));
  }, y);
  const actual = await page.evaluate(() => window.scrollY);
  expect(actual).toBeGreaterThan(150);
  return actual;
}

async function expectScrollNear(
  page: Page,
  expected: number,
  tolerance = 90,
): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 8_000 })
    .toBeGreaterThanOrEqual(Math.max(0, expected - tolerance));
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(expected + tolerance);
}

async function expectNearTop(page: Page): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 8_000 })
    .toBeLessThan(50);
}

async function waitForPublicChrome(
  page: Page,
  viewportWidth: number,
): Promise<void> {
  if (viewportWidth >= 768) {
    await expect(
      page.getByRole("navigation", { name: "Venue pages" }),
    ).toBeVisible();
    return;
  }
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
}

async function openPublicDestination(
  page: Page,
  viewportWidth: number,
  name: string,
): Promise<void> {
  if (viewportWidth >= 768) {
    await page
      .getByRole("navigation", { name: "Venue pages" })
      .getByRole("link", { name })
      .click({ force: true });
    return;
  }
  await page.getByRole("button", { name: "Menu" }).click({ force: true });
  await page
    .getByRole("dialog")
    .getByRole("link", { name })
    .click({ force: true });
}

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.describe("public venue homepage scroll restoration", () => {
  for (const viewport of VIEWPORTS) {
    test(`restores homepage position from Offers, Updates and Enquiries at ${String(viewport.width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/en/v/harbor-light");
      await waitForHomepage(page, "Harbor Light");
      await waitForPublicChrome(page, viewport.width);

      const fromOffers = await scrollHomepage(page);
      await openPublicDestination(page, viewport.width, "Offers");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light\/offers$/);
      await page.getByTestId("public-venue-back").click();
      await waitForHomepage(page, "Harbor Light");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
      await expectScrollNear(page, fromOffers);

      const fromUpdates = await scrollHomepage(page);
      await openPublicDestination(page, viewport.width, "Updates");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light\/updates$/);
      await page.getByTestId("public-venue-back").click();
      await waitForHomepage(page, "Harbor Light");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
      await expectScrollNear(page, fromUpdates);

      const fromEnquire = await scrollHomepage(page);
      await openPublicDestination(page, viewport.width, "Send an enquiry");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light\/enquire$/);
      await page.getByTestId("public-venue-back").click();
      await waitForHomepage(page, "Harbor Light");
      await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
      await expectScrollNear(page, fromEnquire);
    });
  }

  test("direct subpage entry and Home/identity return to the top", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light/offers");
    await page.getByTestId("public-venue-back").click();
    await waitForHomepage(page, "Harbor Light");
    await expectNearTop(page);

    await page.goto("/en/v/harbor-light/updates");
    await page.evaluate(() => window.scrollTo(0, 240));
    await page.getByRole("link", { name: "Harbor Light", exact: true }).click();
    await waitForHomepage(page, "Harbor Light");
    await expectNearTop(page);

    await page.goto("/en/v/harbor-light/enquire");
    await page.evaluate(() => window.scrollTo(0, 180));
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Home" }).click();
    await waitForHomepage(page, "Harbor Light");
    await expectNearTop(page);
  });

  test("saved positions are not reused across venues or locales", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light");
    await waitForHomepage(page, "Harbor Light");
    await scrollHomepage(page);
    await openPublicDestination(page, 390, "Offers");
    await expect(page).toHaveURL(/\/offers$/);

    await page.goto("/en/v/night-orchid/updates");
    await page.getByTestId("public-venue-back").click();
    await waitForHomepage(page, "Night Orchid");
    await expectNearTop(page);

    await page.goto("/th/v/harbor-light/offers");
    await page.getByTestId("public-venue-back").click();
    await waitForHomepage(page, "Harbor Light");
    await expectNearTop(page);
  });

  test("browser back restores the homepage without the custom back-link intent", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light");
    await waitForHomepage(page, "Harbor Light");
    await waitForPublicChrome(page, 390);
    const y = await scrollHomepage(page);
    await openPublicDestination(page, 390, "Offers");
    await expect(page).toHaveURL(/\/offers$/);
    await page.goBack();
    await waitForHomepage(page, "Harbor Light");
    await expectScrollNear(page, y);
  });

  test("mobile viewport wheel can move immediately after restore", async ({
    page,
  }) => {
    test.info().annotations.push({
      type: "note",
      description:
        "Chromium project has no touch-scroll emulation; this covers the 390px viewport with wheel. Check a real phone separately.",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/v/harbor-light");
    await waitForHomepage(page, "Harbor Light");
    await waitForPublicChrome(page, 390);
    const saved = await scrollHomepage(page);
    await openPublicDestination(page, 390, "Updates");
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/updates$/);
    await page.getByTestId("public-venue-back").click();
    await waitForHomepage(page, "Harbor Light");
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
    await expectScrollNear(page, saved);

    const afterRestore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(180, 480);
    await page.mouse.wheel(0, -200);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeLessThan(afterRestore - 40);
    const afterUp = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(
      afterUp + 40,
    );
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeGreaterThan(afterUp + 40);
  });

  test("wheel and keyboard can move immediately after restore without snap-back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/v/harbor-light");
    await waitForHomepage(page, "Harbor Light");
    await waitForPublicChrome(page, 1280);
    const saved = await scrollHomepage(page);
    await openPublicDestination(page, 1280, "Offers");
    await expect(page).toHaveURL(/\/en\/v\/harbor-light\/offers$/);
    await page.getByTestId("public-venue-back").click();
    await waitForHomepage(page, "Harbor Light");
    await expect(page).toHaveURL(/\/en\/v\/harbor-light$/);
    await expectScrollNear(page, saved);

    const afterRestore = await page.evaluate(() => ({
      y: window.scrollY,
      max: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(afterRestore.y).toBeGreaterThan(150);
    expect(afterRestore.max - afterRestore.y).toBeGreaterThan(150);

    await page.mouse.move(240, 420);
    await page.mouse.wheel(0, -220);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeLessThan(afterRestore.y - 40);
    const afterWheelUp = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(
      afterWheelUp + 40,
    );

    await page.mouse.wheel(0, 220);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeGreaterThan(afterWheelUp + 40);
    const afterWheelDown = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
      afterWheelDown - 40,
    );

    await page.evaluate(() => {
      const main = document.getElementById("main");
      if (!(main instanceof HTMLElement)) {
        return;
      }
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    });
    const beforePageUp = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("PageUp");
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeLessThan(beforePageUp - 40);
    const afterPageUp = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(
      afterPageUp + 40,
    );
    await page.keyboard.press("PageDown");
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeGreaterThan(afterPageUp + 40);
    const afterPageDown = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
      afterPageDown - 40,
    );
  });
});
