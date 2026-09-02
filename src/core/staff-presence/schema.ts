import { z } from "zod";

import {
  DEFAULT_PRESENCE_EXPIRY_HOURS,
  MAX_PRESENCE_EXPIRY_HOURS,
  MIN_PRESENCE_EXPIRY_HOURS,
  STAFF_ASSIGNMENT_STATES,
  STAFF_CAROUSEL_ORDERS,
  STAFF_CONSENT_STATES,
  STAFF_DISPLAY_MODES,
  STAFF_PRESENCE_STATES,
  STAFF_PUBLICATION_STATES,
} from "./constants";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const staffAvatarPathSchema = z
  .string()
  .trim()
  .regex(
    /^venues\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/staff_presence\/[A-Za-z0-9._-]+$/i,
  )
  .refine((value) => !value.includes("..") && !/^https?:\/\//i.test(value), {
    message: "Avatar path must be a venue-scoped storage reference",
  });

export const createStaffInputSchema = z
  .object({
    venueId: z.string().uuid(),
    internalDisplayName: trimmed(120),
    publicDisplayName: trimmed(120),
    publicTitle: trimmed(80).optional().or(z.literal("")),
    bioEn: z.string().trim().max(400).optional().or(z.literal("")),
    bioTh: z.string().trim().max(400).optional().or(z.literal("")),
    avatarStoragePath: staffAvatarPathSchema.optional().or(z.literal("")),
    displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
    publicationState: z.enum(STAFF_PUBLICATION_STATES).default("draft"),
    consentState: z.enum(STAFF_CONSENT_STATES).default("pending"),
    userId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine(
    (value) =>
      value.publicationState !== "published" ||
      value.consentState === "granted",
    { message: "Published profiles require granted consent" },
  );

export const updateStaffProfileInputSchema = z.object({
  profileId: z.string().uuid(),
  publicDisplayName: trimmed(120),
  publicTitle: trimmed(80).optional().or(z.literal("")),
  bioEn: z.string().trim().max(400).optional().or(z.literal("")),
  bioTh: z.string().trim().max(400).optional().or(z.literal("")),
  avatarStoragePath: staffAvatarPathSchema.optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  publicationState: z.enum(STAFF_PUBLICATION_STATES).optional(),
  assignmentStatus: z.enum(STAFF_ASSIGNMENT_STATES).optional(),
});

export const staffConsentInputSchema = z.object({
  profileId: z.string().uuid(),
  consentState: z.enum(STAFF_CONSENT_STATES),
});

export const staffPresenceInputSchema = z.object({
  profileId: z.string().uuid(),
  state: z.enum(STAFF_PRESENCE_STATES),
});

export const assignStaffInputSchema = z.object({
  staffMemberId: z.string().uuid(),
  venueId: z.string().uuid(),
  publicDisplayName: trimmed(120),
  publicTitle: trimmed(80).optional().or(z.literal("")),
  bioEn: z.string().trim().max(400).optional().or(z.literal("")),
  bioTh: z.string().trim().max(400).optional().or(z.literal("")),
});

export const staffModuleSettingsInputSchema = z.object({
  venueId: z.string().uuid(),
  isEnabled: z.boolean(),
  isPubliclyVisible: z.boolean(),
  displayMode: z.enum(STAFF_DISPLAY_MODES),
  carouselOrder: z.enum(STAFF_CAROUSEL_ORDERS),
  presenceExpiryHours: z.coerce
    .number()
    .int()
    .min(MIN_PRESENCE_EXPIRY_HOURS)
    .max(MAX_PRESENCE_EXPIRY_HOURS)
    .default(DEFAULT_PRESENCE_EXPIRY_HOURS),
  carouselAutoAdvance: z.boolean(),
  headingEn: z.string().trim().max(80).optional().or(z.literal("")),
  headingTh: z.string().trim().max(80).optional().or(z.literal("")),
});

export const adminScopeInputSchema = z.object({
  businessId: z.string().uuid(),
  venueId: z.string().uuid(),
});

export type CreateStaffInput = z.infer<typeof createStaffInputSchema>;
export type UpdateStaffProfileInput = z.infer<
  typeof updateStaffProfileInputSchema
>;
export type StaffModuleSettingsInput = z.infer<
  typeof staffModuleSettingsInputSchema
>;

export function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}
