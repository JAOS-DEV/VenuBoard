import type { OfferState } from "./constants";
import type { OfferValidityLabel } from "./directory";
import type { UiStatusKey } from "@/core/ui/status";

export function offerStateCopyKey(state: OfferState | string): UiStatusKey {
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

export function offerStateBadgeVariant(
  state: OfferState | string,
): "draft" | "pending" | "scheduled" | "published" | "archived" | "secondary" {
  const key = offerStateCopyKey(state);
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

export function offerValidityLabel(
  validFrom: string,
  validUntil: string,
  nowMs = Date.now(),
): OfferValidityLabel {
  const from = Date.parse(validFrom);
  const until = Date.parse(validUntil);
  if (Number.isNaN(from) || Number.isNaN(until)) {
    return "expired";
  }
  if (nowMs < from) {
    return "upcoming";
  }
  if (nowMs < until) {
    return "active";
  }
  return "expired";
}

export function formatOfferValidityRange(
  validFrom: string,
  validUntil: string,
  locale: "en" | "th",
  timeZone: string,
): string {
  const from = new Date(validFrom);
  const until = new Date(validUntil);
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
    return "";
  }
  const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(from)} – ${fmt.format(until)}`;
}

export function materialOfferFieldsChanged(
  before: {
    titleEn: string;
    descriptionEn: string;
    termsEn: string;
    titleTh: string;
    descriptionTh: string;
    termsTh: string;
    validFromLocal: string;
    validUntilLocal: string;
    mediaStoragePath?: string | null;
  },
  after: {
    titleEn: string;
    descriptionEn: string;
    termsEn: string;
    titleTh: string;
    descriptionTh: string;
    termsTh: string;
    validFromLocal: string;
    validUntilLocal: string;
    mediaStoragePath?: string | null;
  },
): boolean {
  return (
    before.titleEn !== after.titleEn ||
    before.descriptionEn !== after.descriptionEn ||
    before.termsEn !== after.termsEn ||
    before.titleTh !== after.titleTh ||
    before.descriptionTh !== after.descriptionTh ||
    before.termsTh !== after.termsTh ||
    before.validFromLocal !== after.validFromLocal ||
    before.validUntilLocal !== after.validUntilLocal ||
    (before.mediaStoragePath ?? "") !== (after.mediaStoragePath ?? "")
  );
}
