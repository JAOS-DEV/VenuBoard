/**
 * Ordinary local-development gate for the developer hub and related assistance.
 *
 * This is independent of the Playwright `vb_test_identity` triple gate.
 * Availability requires `VENUBOARD_ENV=local` and a non-production Node mode.
 * Every other state — including `test`, staging, production, preview, unset
 * and invalid identifiers — must fail closed.
 */
export function isOrdinaryLocalDevelopment(
  environment: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  return environment === "local" && nodeEnv !== "production";
}
