#!/usr/bin/env node
import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";
import {
  refuseLinkedHostedProject,
  runSupabase,
} from "./lib/local-supabase.mts";
import { applyRootEnvLocalToProcess } from "./lib/local-runtime.mts";
import { assertOrdinaryDevelopmentResetTarget } from "./lib/test-stack/commands.mts";
import { repoRootFromScript } from "./lib/test-stack/paths.mts";

/**
 * Guarded wrapper around `supabase db reset`.
 *
 * Loads `.env.local` when present so local developers do not need to export
 * `VENUBOARD_ENV` in PowerShell. Explicit process environment values still
 * win, which is how CI supplies `VENUBOARD_ENV=local` without that file.
 *
 * After that optional load, the destructive-operation guard still runs before
 * any database work, so a missing, misspelled or production `VENUBOARD_ENV`
 * stops the command instead of being treated as "probably local" (ADR-034).
 *
 * This rebuilds the *local* Docker database: it drops local schemas, replays
 * repository migrations and loads `supabase/seed/01_foundation.sql`. It does not
 * target a linked hosted project. Staging reset is not implemented — there is no
 * staging environment yet. The large performance fixture is not loaded.
 * Manual ordinary-development reset only. Automated tests must use
 * `npm run test:stack:reset` against isolated project venuboard-test.
 */
const OPERATION = "db:reset";
const repoRoot = repoRootFromScript();

applyRootEnvLocalToProcess({ required: false });

const environment = guardDestructiveOperation(OPERATION);
refuseLinkedHostedProject(OPERATION);
assertOrdinaryDevelopmentResetTarget(OPERATION, repoRoot);

console.log(`[${OPERATION}] environment: ${environment}`);
console.log(
  `[${OPERATION}] resetting ordinary local development project venuboard (migrations + deterministic seed). This erases ordinary local development data. It does not touch isolated project venuboard-test. For automated tests use npm run test:stack:reset.`,
);

process.exit(runSupabase(["db", "reset"]));
