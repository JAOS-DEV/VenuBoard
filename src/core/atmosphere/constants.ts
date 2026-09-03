export const ATMOSPHERE_MODULE_KEY = "atmosphere" as const;

export const ATMOSPHERE_STATES = [
  "calm",
  "social",
  "lively",
  "high_energy",
] as const;

export type AtmosphereState = (typeof ATMOSPHERE_STATES)[number];

export const ATMOSPHERE_EXPIRY_MINUTES = [
  30, 60, 90, 120, 180, 240, 360,
] as const;

export type AtmosphereExpiryMinutes =
  (typeof ATMOSPHERE_EXPIRY_MINUTES)[number];

export const DEFAULT_ATMOSPHERE_EXPIRY_MINUTES = 120 as const;

export const ATMOSPHERE_PRESENTATIONS = ["card", "compact", "badge"] as const;

export type AtmospherePresentation = (typeof ATMOSPHERE_PRESENTATIONS)[number];

export function isAtmosphereState(value: string): value is AtmosphereState {
  return (ATMOSPHERE_STATES as readonly string[]).includes(value);
}

export function isAtmosphereExpiryMinutes(
  value: number,
): value is AtmosphereExpiryMinutes {
  return (ATMOSPHERE_EXPIRY_MINUTES as readonly number[]).includes(value);
}

export function clampAtmosphereExpiryMinutes(
  value: number,
): AtmosphereExpiryMinutes {
  if (isAtmosphereExpiryMinutes(value)) {
    return value;
  }
  return DEFAULT_ATMOSPHERE_EXPIRY_MINUTES;
}

export function expiresAtFromMinutes(
  setAt: Date,
  minutes: AtmosphereExpiryMinutes,
): Date {
  return new Date(setAt.getTime() + minutes * 60_000);
}

export function isAtmosphereCurrent(
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expires.getTime() > now.getTime();
}

export function remainingMinutes(
  expiresAt: string | Date,
  now: Date = new Date(),
): number {
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 60_000));
}
