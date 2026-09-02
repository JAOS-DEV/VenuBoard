#!/usr/bin/env node
import { spawnSync } from "node:child_process";

import { decideLocalStart } from "../src/core/dev/local-start-plan.ts";
import { runSupabase } from "./lib/local-supabase.mts";
import {
  applyRootEnvLocalToProcess,
  isHostedProjectLinked,
  readRootEnvLocal,
  runDockerPreflight,
} from "./lib/local-runtime.mts";

/**
 * Start local Supabase, then the Next.js development server.
 *
 * Loads `.env.local` automatically. Does not reset the database, print keys,
 * or link a hosted project.
 */
const OPERATION = "local:start";

const envDecision = decideLocalStart({
  env: process.env,
  envFile: readRootEnvLocal(),
  hostedProjectLinked: isHostedProjectLinked(),
  docker: { ok: true },
});

if (envDecision.action === "refuse") {
  console.error(`[${OPERATION}] refusing to start: ${envDecision.message}`);
  process.exit(1);
}

const docker = runDockerPreflight();
if (!docker.ok) {
  console.error(`[${OPERATION}] refusing to start: ${docker.message}`);
  process.exit(1);
}

applyRootEnvLocalToProcess({ required: true });

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
