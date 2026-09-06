import type { BookingClosureOutcome, BookingEnquiryState } from "./constants";

export function bookingStateCopyKey(
  state: BookingEnquiryState | string,
): "stateNew" | "stateInReview" | "stateClosed" {
  if (state === "in_review") {
    return "stateInReview";
  }
  if (state === "closed") {
    return "stateClosed";
  }
  return "stateNew";
}

export function bookingOutcomeCopyKey(
  outcome: BookingClosureOutcome | string | null,
):
  | "outcomeHandled"
  | "outcomeDeclined"
  | "outcomeDuplicate"
  | "outcomeSpam"
  | "outcomeWithdrawn"
  | "outcomeNone" {
  if (outcome === "handled") {
    return "outcomeHandled";
  }
  if (outcome === "declined") {
    return "outcomeDeclined";
  }
  if (outcome === "duplicate") {
    return "outcomeDuplicate";
  }
  if (outcome === "spam") {
    return "outcomeSpam";
  }
  if (outcome === "withdrawn") {
    return "outcomeWithdrawn";
  }
  return "outcomeNone";
}

export function bookingStateBadgeVariant(
  state: BookingEnquiryState | string,
): "pending" | "scheduled" | "archived" {
  if (state === "in_review") {
    return "scheduled";
  }
  if (state === "closed") {
    return "archived";
  }
  return "pending";
}

export function formatVenueLocalDateTime(
  isoInstant: string,
  timeZone: string,
  locale: "en" | "th",
): string {
  const instant = new Date(isoInstant);
  if (Number.isNaN(instant.getTime())) {
    return "";
  }
  const tag = locale === "th" ? "th-TH" : "en-GB";
  return new Intl.DateTimeFormat(tag, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}
