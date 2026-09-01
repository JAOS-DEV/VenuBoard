import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createOnboardingDraft } from "@/core/onboarding/wizard-state";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("onboarding storage quota", () => {
  it("does not duplicate the seeded 5 GiB plan default in application constants", () => {
    const constants = readFileSync(
      join(ROOT, "src/core/onboarding/constants.ts"),
      "utf8",
    );
    const catalogue = readFileSync(
      join(ROOT, "src/core/onboarding/catalogue.ts"),
      "utf8",
    );
    expect(constants).not.toContain("5368709120");
    expect(constants).not.toContain("5_368_709_120");
    expect(catalogue).not.toContain("5368709120");
    expect(catalogue).not.toContain("5_368_709_120");
    expect(
      createOnboardingDraft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1").trial
        .quotaBytes,
    ).toBeNull();
  });
});
