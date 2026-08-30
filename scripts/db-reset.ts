#!/usr/bin/env node
import { spawnSync } from "node:child_process";

import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";

/**
 * Guarded wrapper around `supabase db reset`.
 *
 * The guard runs *before* anything else, so a missing, misspelled or production
 * `VENUBOARD_ENV` stops the command instead of being treated as "probably
 * local" (ADR-034).
 *
 * There is no schema and no seed data yet, so this currently rebuilds an empty
 * database. It exists now so the guard is in place before there is anything
 * worth destroying.
 */
const OPERATION = "db:reset";

const environment = guardDestructiveOperation(OPERATION);

console.log(`[${OPERATION}] environment: ${environment}`);
console.log(
  `[${OPERATION}] no migrations or seed files exist yet — this rebuilds an empty local database.`,
);

const result = spawnSync("npx", ["supabase", "db", "reset"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error !== undefined) {
  console.error(
    `[${OPERATION}] failed to start the Supabase CLI. A local stack needs Docker.`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
