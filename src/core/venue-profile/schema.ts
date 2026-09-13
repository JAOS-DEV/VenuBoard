import { z } from "zod";

import {
  VENUE_DESCRIPTION_MAX,
  VENUE_DIRECTIONS_MAX,
  VENUE_NAME_MAX,
  VENUE_TAGLINE_MAX,
} from "./constants";
import { validateWeeklySchedule, type WeeklyDaySchedule } from "./hours";
import { publicHttpUrl, publicMailtoHref, publicTelHref } from "./links";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0 ? undefined : value,
    );

const intervalSchema = z.object({
  opens: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closes: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closesNextDay: z.boolean(),
});

export const SaveVenueProfileSchema = z
  .object({
    venueId: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
    name: z.string().trim().min(1).max(VENUE_NAME_MAX),
    nameEn: optionalText(VENUE_NAME_MAX),
    taglineEn: optionalText(VENUE_TAGLINE_MAX),
    descriptionEn: optionalText(VENUE_DESCRIPTION_MAX),
    directionsEn: optionalText(VENUE_DIRECTIONS_MAX),
    nameTh: optionalText(VENUE_NAME_MAX),
    taglineTh: optionalText(VENUE_TAGLINE_MAX),
    descriptionTh: optionalText(VENUE_DESCRIPTION_MAX),
    directionsTh: optionalText(VENUE_DIRECTIONS_MAX),
    addressLine1: optionalText(120),
    addressLine2: optionalText(120),
    city: optionalText(80),
    province: optionalText(80),
    postalCode: optionalText(20),
    country: z.string().trim().min(2).max(2).optional(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    email: optionalText(254),
    phone: optionalText(24),
    website: optionalText(200),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === null) !== (value.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        message: "latitude and longitude must be provided together",
        path: ["latitude"],
      });
    }
    if (value.website !== undefined && publicHttpUrl(value.website) === null) {
      ctx.addIssue({
        code: "custom",
        message: "website must be an http(s) URL",
        path: ["website"],
      });
    }
    if (value.email !== undefined && publicMailtoHref(value.email) === null) {
      ctx.addIssue({
        code: "custom",
        message: "email must be a valid public address",
        path: ["email"],
      });
    }
    if (value.phone !== undefined && publicTelHref(value.phone) === null) {
      ctx.addIssue({
        code: "custom",
        message: "telephone must be a bounded public number",
        path: ["phone"],
      });
    }
  });

export const SaveVenueHoursSchema = z
  .object({
    venueId: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
    mode: z.enum(["unknown", "scheduled"]),
    week: z.array(
      z.object({
        day: z.number().int().min(1).max(7),
        closed: z.boolean(),
        intervals: z.array(intervalSchema),
      }),
    ),
    exceptions: z.array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        closed: z.boolean(),
        intervals: z.array(intervalSchema),
        internalNote: optionalText(200),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "unknown") {
      return;
    }
    if (!validateWeeklySchedule(value.week as WeeklyDaySchedule[])) {
      ctx.addIssue({
        code: "custom",
        message: "weekly schedule is invalid",
        path: ["week"],
      });
    }
  });

export const SetVenuePublicationSchema = z.object({
  venueId: z.string().uuid(),
  expectedUpdatedAt: z.string().min(1),
  publicationState: z.enum(["draft", "published"]),
});

export const SaveVenueBrandingSchema = z.object({
  venueId: z.string().uuid(),
  themeKey: z.enum(["system", "midnight", "daylight"]),
  fontKey: z.literal("system"),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
