import { z } from "zod";

import { FEED_POST_TYPES } from "./constants";

const titleSchema = z.string().trim().min(1).max(120);
const bodySchema = z.string().trim().min(1).max(2000);
const optionalTitleSchema = z.string().trim().max(120).optional();
const optionalBodySchema = z.string().trim().max(2000).optional();

export const CreateFeedPostSchema = z.object({
  venueId: z.string().min(1),
  postType: z.enum(FEED_POST_TYPES).default("update"),
  titleEn: titleSchema,
  bodyEn: bodySchema,
  titleTh: optionalTitleSchema,
  bodyTh: optionalBodySchema,
});

export type CreateFeedPostInput = z.infer<typeof CreateFeedPostSchema>;

export const UpdateFeedPostSchema = CreateFeedPostSchema.omit({
  venueId: true,
}).extend({
  postId: z.string().min(1),
});

export type UpdateFeedPostInput = z.infer<typeof UpdateFeedPostSchema>;

export const RejectFeedPostSchema = z.object({
  postId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

export type RejectFeedPostInput = z.infer<typeof RejectFeedPostSchema>;

export const ScheduleFeedPostSchema = z.object({
  postId: z.string().min(1),
  scheduledFor: z.string().min(1),
});

export type ScheduleFeedPostInput = z.infer<typeof ScheduleFeedPostSchema>;

export const CopyFeedPostSchema = z.object({
  postId: z.string().min(1),
  destVenueId: z.string().min(1),
});

export type CopyFeedPostInput = z.infer<typeof CopyFeedPostSchema>;

export const FeedPostIdSchema = z.object({
  postId: z.string().min(1),
});

export const UpdateFeedSettingsSchema = z.object({
  venueId: z.string().min(1),
  isEnabled: z.boolean(),
  isPubliclyVisible: z.boolean(),
  requireManagerApproval: z.boolean(),
  homepagePreviewEnabled: z.boolean(),
  homepagePreviewCount: z.number().int().min(1).max(6),
  horizonDays: z.number().int().min(1).max(730),
  displayDensity: z.enum(["compact", "comfortable"]),
  headingEn: z.string().trim().max(80).optional(),
  headingTh: z.string().trim().max(80).optional(),
});

export type UpdateFeedSettingsInput = z.infer<typeof UpdateFeedSettingsSchema>;
