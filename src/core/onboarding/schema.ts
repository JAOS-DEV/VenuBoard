import { z } from "zod";

import { canonicalHexColor } from "./colors";
import { normalizeVenueSlug } from "./slug";

const hexColor = z
  .string()
  .transform((value) => canonicalHexColor(value))
  .pipe(z.string());

const moduleKey = z.string().regex(/^[a-z][a-z0-9_]*$/);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0 ? undefined : value,
    );

export const onboardingBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  defaultLocale: z.enum(["en", "th"]),
});

export const onboardingVenueSchema = z.object({
  nameEn: z.string().trim().min(2).max(120),
  nameTh: optionalText(120),
  descriptionEn: optionalText(2000),
  descriptionTh: optionalText(2000),
  taglineEn: optionalText(200),
  taglineTh: optionalText(200),
  slug: z
    .string()
    .transform((value) => normalizeVenueSlug(value))
    .pipe(z.string()),
  timezone: z.string().min(3).max(64),
  defaultLocale: z.enum(["en", "th"]),
  supportedLocales: z.array(z.enum(["en", "th"])).min(1),
  contentClassification: z.enum([
    "general",
    "nightlife_18_plus",
    "adult_nightlife",
  ]),
  classificationLocked: z.boolean(),
});

export const onboardingBrandingSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  backgroundColor: hexColor,
  textColor: hexColor,
  themeKey: z.string().min(1).max(32),
  fontKey: z.literal("system"),
});

export const onboardingTrialSchema = z.object({
  days: z.literal(30),
  extensionDays: z.number().int().min(0).max(365),
  excludedModuleKeys: z.array(moduleKey),
  individualModuleTrials: z.array(
    z.object({
      moduleKey: moduleKey,
      days: z.number().int().min(1).max(365),
    }),
  ),
  quotaBytes: z.number().int().positive().max(1099511627776).nullable(),
});

export const onboardingOverrideSchema = z.object({
  moduleKey: moduleKey,
  grantType: z.enum(["allow", "deny"]),
  reason: z.string().trim().min(1).max(500),
  endsAt: z
    .string()
    .optional()
    .nullable()
    .transform((value) =>
      value === undefined || value === null || value.length === 0
        ? null
        : value,
    )
    .pipe(z.string().datetime().nullable()),
  quotaBytes: z.number().int().positive().max(1099511627776).nullable(),
});

export const onboardingOwnerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .email()
    .transform((value) => value.toLowerCase()),
});

export const onboardingWizardSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    business: onboardingBusinessSchema,
    venue: onboardingVenueSchema,
    branding: onboardingBrandingSchema,
    trial: onboardingTrialSchema,
    overrides: z.array(onboardingOverrideSchema),
    owner: onboardingOwnerSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.venue.supportedLocales.includes(value.venue.defaultLocale)) {
      ctx.addIssue({
        code: "custom",
        path: ["venue", "supportedLocales"],
        message: "default_locale_required",
      });
    }

    if (value.trial.excludedModuleKeys.includes("core_profile")) {
      ctx.addIssue({
        code: "custom",
        path: ["trial", "excludedModuleKeys"],
        message: "core_profile_required",
      });
    }

    if (
      value.trial.individualModuleTrials.some(
        (row) => row.moduleKey === "core_profile",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["trial", "individualModuleTrials"],
        message: "core_profile_required",
      });
    }

    if (
      value.overrides.some(
        (row) => row.moduleKey === "core_profile" && row.grantType === "deny",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["overrides"],
        message: "core_profile_required",
      });
    }
  });

export type OnboardingWizardInput = z.infer<typeof onboardingWizardSchema>;

export function toOnboardingPayload(
  input: OnboardingWizardInput,
): Record<string, unknown> {
  return {
    business: {
      name: input.business.name,
      legal_name: input.business.legalName,
      country: input.business.country,
      default_locale: input.business.defaultLocale,
      contact_email: input.owner.email,
    },
    venue: {
      name_en: input.venue.nameEn,
      name_th: input.venue.nameTh ?? null,
      description_en: input.venue.descriptionEn ?? null,
      description_th: input.venue.descriptionTh ?? null,
      tagline_en: input.venue.taglineEn ?? null,
      tagline_th: input.venue.taglineTh ?? null,
      slug: input.venue.slug,
      timezone: input.venue.timezone,
      default_locale: input.venue.defaultLocale,
      supported_locales: input.venue.supportedLocales,
      content_classification: input.venue.contentClassification,
      classification_locked_by_platform: input.venue.classificationLocked,
    },
    branding: {
      primary_color: input.branding.primaryColor,
      secondary_color: input.branding.secondaryColor,
      accent_color: input.branding.accentColor,
      background_color: input.branding.backgroundColor,
      text_color: input.branding.textColor,
      theme_key: input.branding.themeKey,
      font_key: input.branding.fontKey,
    },
    trial: {
      days: input.trial.days,
      extension_days: input.trial.extensionDays,
      excluded_module_keys: input.trial.excludedModuleKeys,
      individual_module_trials: input.trial.individualModuleTrials.map(
        (row) => ({
          module_key: row.moduleKey,
          days: row.days,
        }),
      ),
      quota_bytes: input.trial.quotaBytes,
    },
    overrides: input.overrides.map((row) => ({
      module_key: row.moduleKey,
      grant_type: row.grantType,
      reason: row.reason,
      ends_at: row.endsAt,
      quota_bytes: row.quotaBytes,
    })),
    owner: { email: input.owner.email },
  };
}
