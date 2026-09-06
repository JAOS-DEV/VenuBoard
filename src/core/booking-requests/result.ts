export const BOOKING_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "unavailable",
] as const;

export type BookingActionCode = (typeof BOOKING_ERROR_CODES)[number];

export type BookingActionResult<T = void> =
  { ok: true; data?: T } | { ok: false; code: BookingActionCode };

export function normalizeBookingErrorCode(code: unknown): BookingActionCode {
  if (
    typeof code === "string" &&
    (BOOKING_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as BookingActionCode;
  }
  return "unavailable";
}

export function mapBookingRpcResult(payload: unknown): BookingActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeBookingErrorCode(record.code) };
  }

  return { ok: true };
}
