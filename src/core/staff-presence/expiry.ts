import {
  DEFAULT_PRESENCE_EXPIRY_HOURS,
  MAX_PRESENCE_EXPIRY_HOURS,
  MIN_PRESENCE_EXPIRY_HOURS,
  type StaffPresenceState,
} from "./constants";

export function clampPresenceExpiryHours(hours: number): number {
  if (!Number.isFinite(hours)) {
    return DEFAULT_PRESENCE_EXPIRY_HOURS;
  }

  return Math.min(
    MAX_PRESENCE_EXPIRY_HOURS,
    Math.max(MIN_PRESENCE_EXPIRY_HOURS, Math.trunc(hours)),
  );
}

export function presenceExpiresAt(
  markedPresentAt: Date,
  expiryHours: number,
): Date {
  const hours = clampPresenceExpiryHours(expiryHours);
  return new Date(markedPresentAt.getTime() + hours * 60 * 60 * 1000);
}

export function effectivePresenceState(
  state: StaffPresenceState,
  expiresAt: string | Date | null,
  now: Date = new Date(),
): StaffPresenceState {
  if (state !== "present" || expiresAt === null) {
    return "not_present";
  }

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return "not_present";
  }

  return "present";
}
