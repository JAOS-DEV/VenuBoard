import { describe, expect, it } from "vitest";

import {
  onboardingWizardSchema,
  toOnboardingPayload,
} from "@/core/onboarding/schema";
import { createOnboardingDraft } from "@/core/onboarding/wizard-state";

function validDraft() {
  const draft = createOnboardingDraft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  draft.business.name = "Lotus Pier Holdings";
  draft.business.legalName = "Lotus Pier Holdings Co., Ltd.";
  draft.venue.nameEn = "Lotus Pier";
  draft.venue.slug = "Lotus Pier";
  draft.venue.contentClassification = "adult_nightlife";
  draft.owner.email = "New.Owner@Example.com";
  return draft;
}

describe("onboardingWizardSchema", () => {
  it("normalises slug, email, colours and maps the payload", () => {
    const parsed = onboardingWizardSchema.parse(validDraft());
    expect(parsed.venue.slug).toBe("lotus-pier");
    expect(parsed.owner.email).toBe("new.owner@example.com");
    expect(parsed.branding.primaryColor).toBe("#1F2937");

    const payload = toOnboardingPayload(parsed);
    expect(payload).toMatchObject({
      business: { legal_name: "Lotus Pier Holdings Co., Ltd." },
      venue: {
        name_en: "Lotus Pier",
        slug: "lotus-pier",
        content_classification: "adult_nightlife",
      },
      owner: { email: "new.owner@example.com" },
      trial: { quota_bytes: null },
    });
    expect(JSON.stringify(payload)).not.toContain("5368709120");
  });

  it("rejects an incomplete business step and core_profile exclusion", () => {
    const incomplete = createOnboardingDraft(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    );
    expect(onboardingWizardSchema.safeParse(incomplete).success).toBe(false);

    const excluded = validDraft();
    excluded.trial.excludedModuleKeys = ["core_profile"];
    const result = onboardingWizardSchema.safeParse(excluded);
    expect(result.success).toBe(false);
  });

  it("rejects invalid colours and unknown classification", () => {
    const colours = validDraft();
    colours.branding.primaryColor = "rgb(1,2,3)";
    expect(onboardingWizardSchema.safeParse(colours).success).toBe(false);

    const classification = validDraft();
    classification.venue.contentClassification = "nudity" as never;
    expect(onboardingWizardSchema.safeParse(classification).success).toBe(
      false,
    );
  });
});
