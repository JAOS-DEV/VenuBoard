export const TEST_IDENTITY_COOKIE = "vb_test_identity";

export const TEST_IDENTITY_TOKENS = [
  "authenticated-no-access",
  "authenticated-deactivated",
] as const;

export type TestIdentityToken = (typeof TEST_IDENTITY_TOKENS)[number];

export function isTestIdentityToken(
  value: string | undefined,
): value is TestIdentityToken {
  return (
    value !== undefined &&
    (TEST_IDENTITY_TOKENS as readonly string[]).includes(value)
  );
}

export function isTestIdentityFlagEnabled(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
}

/**
 * Browser-test identity cookie. All three conditions are required:
 * `VENUBOARD_ENV=test`, `NODE_ENV !== production`, and the explicit
 * `VENUBOARD_ENABLE_TEST_IDENTITY` flag. Local, staging, preview and
 * production must never honour the cookie.
 */
export function isTestIdentityEnabled(
  environment: string,
  nodeEnv: string | undefined,
  enableFlag: boolean,
): boolean {
  return (
    environment === "test" && nodeEnv !== "production" && enableFlag === true
  );
}
