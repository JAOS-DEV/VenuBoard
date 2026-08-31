#!/usr/bin/env node
import { join } from "node:path";

import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";
import {
  refuseLinkedHostedProject,
  runSupabase,
} from "./lib/local-supabase.mts";

/**
 * Loads the large local-only RLS performance fixture.
 * Not part of ordinary reset. Refuses production and linked hosted projects.
 */
const OPERATION = "db:perf:seed";

const environment = guardDestructiveOperation(OPERATION);
refuseLinkedHostedProject(OPERATION);

if (environment === "staging") {
  console.error(
    `[${OPERATION}] refusing to run: the performance fixture is local-only and must not load into staging.`,
  );
  process.exit(1);
}

console.log(`[${OPERATION}] environment: ${environment}`);
console.log(
  `[${OPERATION}] loading supabase/perf/01_volume.sql into the local Docker database.`,
);

process.exit(
  runSupabase(["db", "query", "-f", join("supabase", "perf", "01_volume.sql")]),
);
