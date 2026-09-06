import type { VenuBoardEnvironment } from "@/core/env/environment";

/**
 * Hosted public intake stays fail-closed until a production abuse-control
 * provider is explicitly accepted. Local and test use database quotas and
 * idempotency only.
 */
export function publicBookingIntakeAllowed(
  environment: VenuBoardEnvironment,
): boolean {
  return environment === "local" || environment === "test";
}
