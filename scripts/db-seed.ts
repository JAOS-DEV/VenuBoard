#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { guardDestructiveOperation } from "../src/core/env/production-guard.ts";

/**
 * Guarded seed command.
 *
 * The deterministic seed dataset (ADR-035) does not exist yet, so this command
 * deliberately does nothing except prove the guard works and report honestly.
 * It is not a stub pretending to seed.
 */
const OPERATION = "db:seed";

const environment = guardDestructiveOperation(OPERATION);
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
  console.log(
    `[${OPERATION}] no seed files in supabase/seed. Nothing to do — the deterministic dataset is written after the first migrations.`,
  );
  process.exit(0);
}

console.error(
  `[${OPERATION}] found ${String(seedFiles.length)} seed file(s), but seeding is not implemented yet. Use \`npm run db:reset\`, which applies them through the Supabase CLI.`,
);
process.exit(1);
