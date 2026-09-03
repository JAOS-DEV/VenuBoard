import { z } from "zod";

export const CreateEventSchema = z.object({
  venueId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  timezone: z.string().min(1),
  isAllDay: z.boolean().default(false),
  titleEn: z.string().min(1).max(160),
  summaryEn: z.string().max(280).optional(),
  descriptionEn: z.string().max(8000).optional(),
  ctaLabelEn: z.string().max(80).optional(),
  titleTh: z.string().max(160).optional(),
  summaryTh: z.string().max(280).optional(),
  descriptionTh: z.string().max(8000).optional(),
  ctaLabelTh: z.string().max(80).optional(),
  posterStoragePath: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventDraftSchema = CreateEventSchema.omit({
  venueId: true,
}).extend({
  eventId: z.string().min(1),
});

export type UpdateEventDraftInput = z.infer<typeof UpdateEventDraftSchema>;

export const RejectEventSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export type RejectEventInput = z.infer<typeof RejectEventSchema>;

export const ScheduleEventSchema = z.object({
  eventId: z.string().min(1),
  publishAt: z.string().min(1),
});

export type ScheduleEventInput = z.infer<typeof ScheduleEventSchema>;

export const CancelEventSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type CancelEventInput = z.infer<typeof CancelEventSchema>;

export const CopyEventSchema = z.object({
  eventId: z.string().min(1),
  destVenueId: z.string().min(1),
});

export type CopyEventInput = z.infer<typeof CopyEventSchema>;
