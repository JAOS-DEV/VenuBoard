#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { refuseLinkedHostedProject } from "./lib/local-supabase.mts";

/**
 * Generate TypeScript database types from the local schema and fail if they
 * differ from the committed file. Formats with Prettier so the comparison
 * matches `npm run format`.
 */
const OPERATION = "db:types:check";
const typesPath = join("src", "core", "db", "types.ts");

refuseLinkedHostedProject(OPERATION);

const generated = spawnSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local"],
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);

if (generated.error !== undefined || generated.status !== 0) {
  console.error(generated.stderr);
  console.error(`[${OPERATION}] type generation failed.`);
  process.exit(generated.status ?? 1);
}

const formatted = spawnSync(
  "npx",
  ["prettier", "--stdin-filepath", typesPath],
  {
    input: generated.stdout.replace(/\r\n/g, "\n"),
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);

if (formatted.error !== undefined || formatted.status !== 0) {
  console.error(formatted.stderr);
  console.error(`[${OPERATION}] Prettier failed on generated types.`);
  process.exit(formatted.status ?? 1);
}

const committed = readFileSync(typesPath, "utf8").replace(/\r\n/g, "\n");
const next = (formatted.stdout ?? "").replace(/\r\n/g, "\n");

if (committed === next) {
  console.log(`[${OPERATION}] ${typesPath} matches the local schema.`);
  process.exit(0);
}

console.error(
  `[${OPERATION}] generated types differ from ${typesPath}. Run \`npm run db:types\` then \`npm run format\` and commit the result.`,
);
process.exit(1);
