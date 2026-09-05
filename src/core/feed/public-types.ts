import type { FeedLocale, FeedPostType } from "./constants";

export interface PublicFeedItem {
  title: string;
  body: string;
  postType: FeedPostType;
  publishedAt: string;
  isPinned: boolean;
  locale: FeedLocale;
}

export interface PublicVenueFeedPayload {
  available: boolean;
  ok: boolean;
  heading: string | null;
  previewEnabled: boolean;
  previewCount: number;
  items: PublicFeedItem[];
  nextCursor: string | null;
  locale: FeedLocale;
}
