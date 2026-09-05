import type { FeedPostState, FeedPostType } from "./constants";
import type { UiStatusKey } from "@/core/ui/status";

export function feedStateCopyKey(state: FeedPostState | string): UiStatusKey {
  if (state === "pending_approval") {
    return "pending";
  }
  if (state === "draft") {
    return "draft";
  }
  if (state === "scheduled") {
    return "scheduled";
  }
  if (state === "published") {
    return "published";
  }
  if (state === "archived") {
    return "archived";
  }
  return "temporarilyUnavailable";
}

export function feedStateBadgeVariant(
  state: FeedPostState | string,
): "draft" | "pending" | "scheduled" | "published" | "archived" | "secondary" {
  const key = feedStateCopyKey(state);
  if (
    key === "draft" ||
    key === "pending" ||
    key === "scheduled" ||
    key === "published" ||
    key === "archived"
  ) {
    return key;
  }
  return "secondary";
}

export function feedTypeCopyKey(
  type: FeedPostType | string,
): "typeAnnouncement" | "typeNotice" | "typeUpdate" {
  if (type === "announcement") {
    return "typeAnnouncement";
  }
  if (type === "notice") {
    return "typeNotice";
  }
  return "typeUpdate";
}

export function formatFeedPublicDate(
  iso: string,
  locale: "en" | "th",
  timeZone = "UTC",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
