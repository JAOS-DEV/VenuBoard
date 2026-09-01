import {
  DEFAULT_BRANDING,
  DEFAULT_TIMEZONE,
  STANDARD_TRIAL_DAYS,
} from "./constants";
import type { OnboardingWizardInput } from "./schema";

export const ONBOARDING_STEPS = [
  "business",
  "venue",
  "classification",
  "branding",
  "modules",
  "owner",
  "review",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingDraft {
  idempotencyKey: string;
  business: OnboardingWizardInput["business"];
  venue: Omit<OnboardingWizardInput["venue"], "contentClassification"> & {
    contentClassification:
      OnboardingWizardInput["venue"]["contentClassification"] | "";
  };
  branding: OnboardingWizardInput["branding"];
  trial: OnboardingWizardInput["trial"];
  overrides: OnboardingWizardInput["overrides"];
  owner: { email: string };
}

export function createOnboardingDraft(idempotencyKey: string): OnboardingDraft {
  return {
    idempotencyKey,
    business: {
      name: "",
      legalName: "",
      country: "TH",
      defaultLocale: "en",
    },
    venue: {
      nameEn: "",
      nameTh: undefined,
      descriptionEn: undefined,
      descriptionTh: undefined,
      taglineEn: undefined,
      taglineTh: undefined,
      slug: "",
      timezone: DEFAULT_TIMEZONE,
      defaultLocale: "en",
      supportedLocales: ["en"],
      contentClassification: "",
      classificationLocked: false,
    },
    branding: { ...DEFAULT_BRANDING },
    trial: {
      days: STANDARD_TRIAL_DAYS,
      extensionDays: 0,
      excludedModuleKeys: [],
      individualModuleTrials: [],
      quotaBytes: null,
    },
    overrides: [],
    owner: { email: "" },
  };
}
