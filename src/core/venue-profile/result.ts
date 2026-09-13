import {
  VENUE_PROFILE_ERROR_CODES,
  type VenueProfileErrorCode,
} from "./constants";

export type VenueProfileActionResult =
  | { ok: true; data?: { updatedAt?: string } }
  | { ok: false; code: VenueProfileErrorCode; errors?: string[] };

export function normalizeVenueProfileErrorCode(
  code: unknown,
): VenueProfileErrorCode {
  if (
    typeof code === "string" &&
    (VENUE_PROFILE_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as VenueProfileErrorCode;
  }
  return "unavailable";
}

export function mapVenueProfileRpcResult(
  payload: unknown,
): VenueProfileActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }
  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    const errors = Array.isArray(record.errors)
      ? record.errors.filter((item): item is string => typeof item === "string")
      : undefined;
    return {
      ok: false,
      code: normalizeVenueProfileErrorCode(record.code),
      errors,
    };
  }
  return {
    ok: true,
    data: {
      updatedAt:
        typeof record.updated_at === "string" ? record.updated_at : undefined,
    },
  };
}
