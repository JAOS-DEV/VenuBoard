import { STAFF_ERROR_CODES, type StaffErrorCode } from "./constants";

export interface StaffActionResult {
  ok: boolean;
  code?: StaffErrorCode;
  staffMemberId?: string;
  profileId?: string;
  resetCount?: number;
}

export function normalizeStaffErrorCode(code: unknown): StaffErrorCode {
  if (
    typeof code === "string" &&
    (STAFF_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as StaffErrorCode;
  }
  return "unavailable";
}

export function parseStaffRpcResult(payload: unknown): StaffActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeStaffErrorCode(record.code) };
  }

  return {
    ok: true,
    staffMemberId:
      typeof record.staff_member_id === "string"
        ? record.staff_member_id
        : undefined,
    profileId:
      typeof record.profile_id === "string" ? record.profile_id : undefined,
    resetCount:
      typeof record.reset_count === "number" ? record.reset_count : undefined,
  };
}
