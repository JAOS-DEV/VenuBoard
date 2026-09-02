#!/usr/bin/env node
import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";
import {
  refuseLinkedHostedProject,
  runSupabase,
} from "./lib/local-supabase.mts";
import { applyRootEnvLocalToProcess } from "./lib/local-runtime.mts";

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
 */
const OPERATION = "db:reset";

applyRootEnvLocalToProcess({ required: false });

const environment = guardDestructiveOperation(OPERATION);
refuseLinkedHostedProject(OPERATION);

console.log(`[${OPERATION}] environment: ${environment}`);
console.log(
  `[${OPERATION}] resetting the local Docker database (migrations + deterministic seed). This erases local data only.`,
);

process.exit(runSupabase(["db", "reset"]));
