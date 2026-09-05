import type { FeedLocale, FeedPostType } from "./constants";
import { FEED_POST_TYPES } from "./constants";
import type { PublicFeedItem, PublicVenueFeedPayload } from "./public-types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asLocale(value: unknown): FeedLocale {
  return value === "th" ? "th" : "en";
}

function asPostType(value: unknown): FeedPostType {
  if (
    typeof value === "string" &&
    (FEED_POST_TYPES as readonly string[]).includes(value)
  ) {
    return value as FeedPostType;
  }
  return "update";
}

function mapItem(
  value: unknown,
  fallbackLocale: FeedLocale,
): PublicFeedItem | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const title = asString(record.title);
  const body = asString(record.body);
  const publishedAt = asString(record.published_at);
  if (title === null || body === null || publishedAt === null) {
    return null;
  }
  return {
    title,
    body,
    postType: asPostType(record.post_type),
    publishedAt,
    isPinned: asBoolean(record.is_pinned) === true,
    locale: asLocale(record.locale ?? fallbackLocale),
  };
}

export function mapPublicVenueFeed(
  payload: unknown,
  fallbackLocale: FeedLocale,
): PublicVenueFeedPayload {
  const hidden: PublicVenueFeedPayload = {
    available: false,
    ok: true,
    heading: null,
    previewEnabled: false,
    previewCount: 3,
    items: [],
    nextCursor: null,
    locale: fallbackLocale,
  };

  const record = asRecord(payload);
  if (record === null || record.ok !== true || record.available !== true) {
    return hidden;
  }

  const rawItems = record.items;
  const items: PublicFeedItem[] = [];
  if (Array.isArray(rawItems)) {
    for (const entry of rawItems) {
      const item = mapItem(entry, fallbackLocale);
      if (item !== null) {
        items.push(item);
      }
    }
  }

  const previewCount =
    typeof record.preview_count === "number" &&
    Number.isInteger(record.preview_count)
      ? Math.min(6, Math.max(1, record.preview_count))
      : 3;

  return {
    available: true,
    ok: true,
    heading: asString(record.heading),
    previewEnabled: asBoolean(record.preview_enabled) === true,
    previewCount,
    items,
    nextCursor: asString(record.next_cursor),
    locale: fallbackLocale,
  };
}

export function isFeedPostPubliclyEligible(input: {
  state: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  quarantinedAt: string | null;
  nowMs?: number;
}): boolean {
  if (input.archivedAt !== null || input.quarantinedAt !== null) {
    return false;
  }
  const now = input.nowMs ?? Date.now();
  if (input.state === "published") {
    if (input.publishedAt === null) {
      return false;
    }
    return Date.parse(input.publishedAt) <= now;
  }
  if (input.state === "scheduled" && input.scheduledFor !== null) {
    return Date.parse(input.scheduledFor) <= now;
  }
  return false;
}
