import { z } from "zod";

/**
 * The four VenuBoard environments. `local`, `staging` and `production` are the
 * three isolated environments of ADR-034; `test` is the automated-test
 * environment, which is local-class and never touches hosted infrastructure.
 *
 * There is deliberately no default and no fallback: an unset or misspelled
 * identifier is an error, never an assumption.
 */
export const VENUBOARD_ENVIRONMENTS = [
  "local",
  "staging",
  "production",
  "test",
] as const;

export const venuboardEnvironmentSchema = z.enum(VENUBOARD_ENVIRONMENTS);

export type VenuBoardEnvironment = z.infer<typeof venuboardEnvironmentSchema>;

/** Environments that must never be pointed at hosted staging or production data. */
const LOCAL_CLASS_ENVIRONMENTS: readonly VenuBoardEnvironment[] = [
  "local",
  "test",
];

export function isLocalClass(environment: VenuBoardEnvironment): boolean {
  return LOCAL_CLASS_ENVIRONMENTS.includes(environment);
}

export function isProduction(environment: VenuBoardEnvironment): boolean {
  return environment === "production";
}

/**
 * The environment badge exists so nobody mistakes staging for production
 * (ADR-034). Production must not advertise itself to the public.
 */
export function shouldShowEnvironmentBadge(
  environment: VenuBoardEnvironment,
): boolean {
  return environment === "local" || environment === "staging";
}
