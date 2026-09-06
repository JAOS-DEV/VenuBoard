export const OFFER_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "inactive",
  "unavailable",
] as const;

export type OfferActionCode = (typeof OFFER_ERROR_CODES)[number];

export type OfferActionResult<T = void> =
  { ok: true; data?: T } | { ok: false; code: OfferActionCode };

export function normalizeOfferErrorCode(code: unknown): OfferActionCode {
  if (
    typeof code === "string" &&
    (OFFER_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as OfferActionCode;
  }
  return "unavailable";
}

export function mapOfferRpcResult(payload: unknown): OfferActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeOfferErrorCode(record.code) };
  }

  return { ok: true };
}

export function mapOfferRpcResultWithId(
  payload: unknown,
): OfferActionResult<{ offerId: string }> {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeOfferErrorCode(record.code) };
  }

  if (typeof record.offer_id === "string") {
    return { ok: true, data: { offerId: record.offer_id } };
  }

  return { ok: true };
}
