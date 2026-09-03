export const ATMOSPHERE_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "unavailable",
] as const;

export type AtmosphereActionCode = (typeof ATMOSPHERE_ERROR_CODES)[number];

export type AtmosphereActionResult =
  { ok: true } | { ok: false; code: AtmosphereActionCode };

export function normalizeAtmosphereErrorCode(
  code: unknown,
): AtmosphereActionCode {
  if (
    typeof code === "string" &&
    (ATMOSPHERE_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as AtmosphereActionCode;
  }
  return "unavailable";
}

export function mapAtmosphereRpcResult(
  payload: unknown,
): AtmosphereActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeAtmosphereErrorCode(record.code) };
  }

  return { ok: true };
}
