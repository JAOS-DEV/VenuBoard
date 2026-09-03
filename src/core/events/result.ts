export const EVENT_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "inactive",
  "unavailable",
] as const;

export type EventActionCode = (typeof EVENT_ERROR_CODES)[number];

export type EventActionResult<T = void> =
  { ok: true; data?: T } | { ok: false; code: EventActionCode };

export function normalizeEventErrorCode(code: unknown): EventActionCode {
  if (
    typeof code === "string" &&
    (EVENT_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as EventActionCode;
  }
  return "unavailable";
}

export function mapEventRpcResult(payload: unknown): EventActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeEventErrorCode(record.code) };
  }

  return { ok: true };
}

export function mapEventRpcResultWithId(
  payload: unknown,
): EventActionResult<{ eventId: string }> {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeEventErrorCode(record.code) };
  }

  if (typeof record.event_id === "string") {
    return { ok: true, data: { eventId: record.event_id } };
  }

  return { ok: true };
}
