/**
 * Normalise authentication provider errors into generic codes the UI may show.
 * Distinctions such as "user not found" versus "wrong password" are never
 * returned to the client.
 */

export const AUTH_ERROR_CODES = [
  "auth_failed",
  "validation_failed",
  "rate_limited",
  "unavailable",
  "unauthenticated",
  "invitation_unavailable",
  "email_mismatch",
  "account_inactive",
  "membership_conflict",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const RATE_LIMIT_PATTERN = /rate|too many|over_request/i;
const NETWORK_PATTERN = /fetch|network|unavailable|timeout/i;

export function normalizeAuthError(error: unknown): AuthErrorCode {
  if (error === null || error === undefined) {
    return "auth_failed";
  }

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";

  if (RATE_LIMIT_PATTERN.test(message)) {
    return "rate_limited";
  }

  if (NETWORK_PATTERN.test(message)) {
    return "unavailable";
  }

  return "auth_failed";
}

export function normalizeInvitationAcceptCode(
  code: string | null | undefined,
): AuthErrorCode {
  switch (code) {
    case "unauthenticated":
    case "invitation_unavailable":
    case "email_mismatch":
    case "account_inactive":
    case "membership_conflict":
      return code;
    default:
      return "invitation_unavailable";
  }
}
