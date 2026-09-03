import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openWithTestIdentity } from "./helpers/platform-identity";

const PAGES = ["/en/sign-in", "/en/v/harbor-light", "/en"] as const;

test.describe("accessibility smoke", () => {
  for (const route of PAGES) {
    test(`axe serious+critical on ${route}`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious,
        serious
          .map((item) => `${item.id}: ${item.help} (${item.nodes.length})`)
          .join("\n"),
      ).toEqual([]);
    });
  }

  test("axe serious+critical on platform administration", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openWithTestIdentity(
      browser,
      baseURL,
      "platform-admin",
    );
    await page.goto("/en/platform");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    await context.close();
    expect(
      serious,
      serious
        .map((item) => `${item.id}: ${item.help} (${item.nodes.length})`)
        .join("\n"),
    ).toEqual([]);
  });
});
