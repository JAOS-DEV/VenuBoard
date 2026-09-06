import type { PublicOfferItem } from "./public-types";

export function isPublicOfferLive(
  validUntil: string,
  nowMs = Date.now(),
): boolean {
  const until = Date.parse(validUntil);
  return !Number.isNaN(until) && until > nowMs;
}

export function livePublicOffers<T extends { validUntil: string }>(
  items: readonly T[],
  nowMs = Date.now(),
): T[] {
  return items.filter((item) => isPublicOfferLive(item.validUntil, nowMs));
}

export function msUntilOfferExpiry(
  validUntil: string,
  nowMs = Date.now(),
): number | null {
  const until = Date.parse(validUntil);
  if (Number.isNaN(until)) {
    return null;
  }
  return until - nowMs;
}

export function nextPublicOfferRefreshAt(
  items: readonly PublicOfferItem[],
  nowMs = Date.now(),
): number | null {
  let earliest: number | null = null;
  for (const item of items) {
    const remaining = msUntilOfferExpiry(item.validUntil, nowMs);
    if (remaining === null) {
      continue;
    }
    if (remaining <= 0) {
      return nowMs;
    }
    if (earliest === null || nowMs + remaining < earliest) {
      earliest = nowMs + remaining;
    }
  }
  return earliest;
}
