import { z } from "zod";

import {
  OFFER_DESCRIPTION_MAX,
  OFFER_HEADING_MAX,
  OFFER_PREVIEW_COUNT_MAX,
  OFFER_PREVIEW_COUNT_MIN,
  OFFER_TERMS_MAX,
  OFFER_TITLE_MAX,
} from "./constants";

const titleSchema = z.string().trim().min(1).max(OFFER_TITLE_MAX);
const descriptionSchema = z.string().trim().min(1).max(OFFER_DESCRIPTION_MAX);
const termsSchema = z.string().trim().min(1).max(OFFER_TERMS_MAX);
const optionalTitleSchema = z.string().trim().max(OFFER_TITLE_MAX).optional();
const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(OFFER_DESCRIPTION_MAX)
  .optional();
const optionalTermsSchema = z.string().trim().max(OFFER_TERMS_MAX).optional();
const venueLocalSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/);

const optionalMediaPathSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine((value) => {
    if (value === undefined || value.length === 0) {
      return true;
    }
    if (
      value.includes("://") ||
      value.includes("..") ||
      value.startsWith("/") ||
      value.includes("\\")
    ) {
      return false;
    }
    return /^venues\/[0-9a-f-]{36}\/offers\//i.test(value);
  }, "media path must be venue-scoped");

const offerContentSchema = z.object({
  titleEn: titleSchema,
  descriptionEn: descriptionSchema,
  termsEn: termsSchema,
  titleTh: optionalTitleSchema,
  descriptionTh: optionalDescriptionSchema,
  termsTh: optionalTermsSchema,
  validFromLocal: venueLocalSchema,
  validUntilLocal: venueLocalSchema,
  mediaStoragePath: optionalMediaPathSchema,
});

function refineThaiBundle(
  value: {
    titleTh?: string;
    descriptionTh?: string;
    termsTh?: string;
  },
  ctx: z.RefinementCtx,
): void {
  const thValues = [value.titleTh, value.descriptionTh, value.termsTh].map(
    (part) => (part ?? "").trim(),
  );
  const filled = thValues.filter((part) => part.length > 0).length;
  if (filled > 0 && filled < 3) {
    ctx.addIssue({
      code: "custom",
      message: "Thai title, description and terms must be provided together",
      path: ["titleTh"],
    });
  }
}

export const CreateOfferSchema = offerContentSchema
  .extend({
    venueId: z.string().min(1),
  })
  .superRefine(refineThaiBundle);

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

export const UpdateOfferSchema = offerContentSchema
  .extend({
    offerId: z.string().min(1),
  })
  .superRefine(refineThaiBundle);

export type UpdateOfferInput = z.infer<typeof UpdateOfferSchema>;

export const RejectOfferSchema = z.object({
  offerId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

export type RejectOfferInput = z.infer<typeof RejectOfferSchema>;

export const ScheduleOfferSchema = z.object({
  offerId: z.string().min(1),
  scheduledFor: z.string().min(1),
});

export type ScheduleOfferInput = z.infer<typeof ScheduleOfferSchema>;

export const OfferIdSchema = z.object({
  offerId: z.string().min(1),
});

export const UpdateOffersSettingsSchema = z.object({
  venueId: z.string().min(1),
  isEnabled: z.boolean(),
  isPubliclyVisible: z.boolean(),
  requireManagerApproval: z.boolean(),
  homepagePreviewEnabled: z.boolean(),
  homepagePreviewCount: z
    .number()
    .int()
    .min(OFFER_PREVIEW_COUNT_MIN)
    .max(OFFER_PREVIEW_COUNT_MAX),
  headingEn: z.string().trim().max(OFFER_HEADING_MAX).optional(),
  headingTh: z.string().trim().max(OFFER_HEADING_MAX).optional(),
});

export type UpdateOffersSettingsInput = z.infer<
  typeof UpdateOffersSettingsSchema
>;
