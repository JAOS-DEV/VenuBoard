#!/usr/bin/env node
import { spawnSync } from "node:child_process";

import { parseServerEnv } from "../src/core/env/schema.ts";
import {
  refuseLinkedHostedProject,
  runSupabase,
} from "./lib/local-supabase.mts";

/**
 * Start local Supabase, then the Next.js development server.
 *
 * Does not reset the database, print keys, or link a hosted project.
 */
const OPERATION = "local:start";

refuseLinkedHostedProject(OPERATION);

let environment: string;
try {
  environment = parseServerEnv(process.env).VENUBOARD_ENV;
} catch (error) {
  console.error(
    `[${OPERATION}] refusing to start: the environment configuration is invalid.`,
  );
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

if (environment !== "local") {
  console.error(
    `[${OPERATION}] refusing to start: VENUBOARD_ENV must be "local".`,
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error(`[${OPERATION}] refusing to start: NODE_ENV is production.`);
  process.exit(1);
}

console.log(
  `[${OPERATION}] starting local Supabase. This does not reset the database.`,
);
const startStatus = runSupabase(["start"]);
if (startStatus !== 0) {
  process.exit(startStatus);
}

console.log(
  `[${OPERATION}] starting Next.js. Developer hub: http://localhost:3000/en/dev`,
);
const next = spawnSync("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (next.error !== undefined) {
  console.error(`[${OPERATION}] failed to start Next.js.`);
  process.exit(1);
}

process.exit(next.status ?? 1);
