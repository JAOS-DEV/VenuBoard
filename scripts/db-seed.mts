#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";
import { refuseLinkedHostedProject } from "./lib/local-supabase.mts";

/**
 * Guarded seed command.
 *
 * Seed SQL is applied by `npm run db:reset` through the Supabase CLI. Running
 * the seed files a second time against an already-seeded database would
 * duplicate fixed primary keys, so this command does not re-apply them.
 */
const OPERATION = "db:seed";

const environment = guardDestructiveOperation(OPERATION);
refuseLinkedHostedProject(OPERATION);

const seedDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "seed",
);

const seedFiles = existsSync(seedDirectory)
  ? readdirSync(seedDirectory).filter((file) => file.endsWith(".sql"))
  : [];

console.log(`[${OPERATION}] environment: ${environment}`);

if (seedFiles.length === 0) {
  console.log(`[${OPERATION}] no seed files in supabase/seed. Nothing to do.`);
  process.exit(0);
}

console.log(
  `[${OPERATION}] ${String(seedFiles.length)} seed file(s) are loaded by \`npm run db:reset\`, which rebuilds the local Docker database. This command does not re-apply them (that would collide with the deterministic primary keys). Staging reset is not implemented.`,
);
process.exit(0);
