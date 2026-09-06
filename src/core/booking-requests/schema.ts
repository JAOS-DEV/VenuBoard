import { z } from "zod";

import {
  BOOKING_EMAIL_MAX,
  BOOKING_HEADING_MAX,
  BOOKING_INSTRUCTIONS_MAX,
  BOOKING_MESSAGE_MAX,
  BOOKING_NAME_MAX,
  BOOKING_OUTCOMES,
} from "./constants";

const idempotencyKeySchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

export const SubmitBookingEnquirySchema = z.object({
  venueSlug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(BOOKING_NAME_MAX),
  email: z.string().trim().email().max(BOOKING_EMAIL_MAX),
  partySize: z.number().int().min(1).max(50),
  requestedLocal: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/),
  locale: z.enum(["en", "th"]),
  message: z.string().trim().max(BOOKING_MESSAGE_MAX).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type SubmitBookingEnquiryInput = z.infer<
  typeof SubmitBookingEnquirySchema
>;

export const BookingEnquiryIdSchema = z.object({
  enquiryId: z.string().uuid(),
  expectedRowVersion: z.number().int().min(1),
});

export const CloseBookingEnquirySchema = BookingEnquiryIdSchema.extend({
  outcome: z.enum(BOOKING_OUTCOMES),
});

export type CloseBookingEnquiryInput = z.infer<
  typeof CloseBookingEnquirySchema
>;

export const UpdateBookingSettingsSchema = z
  .object({
    venueId: z.string().uuid(),
    isEnabled: z.boolean(),
    isPubliclyVisible: z.boolean(),
    acceptingEnquiries: z.boolean(),
    minPartySize: z.number().int().min(1).max(20),
    maxPartySize: z.number().int().min(1).max(50),
    horizonDays: z.number().int().min(1).max(365),
    leadTimeMinutes: z.number().int().min(0).max(10080),
    headingEn: z.string().trim().max(BOOKING_HEADING_MAX).optional(),
    headingTh: z.string().trim().max(BOOKING_HEADING_MAX).optional(),
    instructionsEn: z.string().trim().max(BOOKING_INSTRUCTIONS_MAX).optional(),
    instructionsTh: z.string().trim().max(BOOKING_INSTRUCTIONS_MAX).optional(),
  })
  .strict();

export type UpdateBookingSettingsInput = z.infer<
  typeof UpdateBookingSettingsSchema
>;
