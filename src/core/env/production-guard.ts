import { isProduction, type VenuBoardEnvironment } from "./environment.ts";
import { parseServerEnv } from "./schema.ts";

/**
 * The production guard for destructive commands (ADR-034, ADR-035).
 *
 * Reset, re-seed, truncate and bulk-fixture commands check the environment
 * identifier at runtime and refuse to run against production. This is a
 * runtime guard, not a naming convention: it must fail closed when the
 * environment cannot be determined at all.
 *
 * Note on the explicit `.ts` import extensions in this module and its
 * neighbours: the `scripts/` commands are executed directly by Node, which
 * strips types but requires exact specifiers. `allowImportingTsExtensions`
 * keeps TypeScript happy with the same paths.
 */

export class DestructiveOperationBlockedError extends Error {
  readonly operation: string;
  readonly environment: VenuBoardEnvironment;

  constructor(operation: string, environment: VenuBoardEnvironment) {
    super(
      `Refusing to run "${operation}": VENUBOARD_ENV is "${environment}". ` +
        `Destructive database commands are only permitted in local, test and staging environments.`,
    );
    this.name = "DestructiveOperationBlockedError";
    this.operation = operation;
    this.environment = environment;
  }
}

/**
 * Throws unless `environment` is one where destructive work is acceptable.
 * Pure, so it can be unit tested without touching `process.env`.
 */
export function assertDestructiveOperationAllowed(
  operation: string,
  environment: VenuBoardEnvironment,
): void {
  if (isProduction(environment)) {
    throw new DestructiveOperationBlockedError(operation, environment);
  }
}

/**
 * Guard entry point for command-line scripts. Validation runs first, so an
 * unset or misspelled `VENUBOARD_ENV` blocks the command rather than being
 * treated as "probably local".
 */
export function guardDestructiveOperation(
  operation: string,
  raw: Record<string, string | undefined> = process.env,
): VenuBoardEnvironment {
  const { VENUBOARD_ENV } = parseServerEnv(raw);

  assertDestructiveOperationAllowed(operation, VENUBOARD_ENV);

  return VENUBOARD_ENV;
}
