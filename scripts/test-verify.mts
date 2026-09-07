#!/usr/bin/env node
/**
 * Isolated database + browser verification.
 *
 * Starts or reuses `venuboard-test`, resets fixtures, runs pgTAP, checks
 * generated types against that schema, resets again so concurrency-test rows
 * cannot leak into Playwright, then runs Playwright.
 *
 * This is not the completion gate for format, lint, typecheck, Vitest or
 * production build. Those remain `npm run verify`.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { TEST_PROJECT_ID } from "../src/core/test-stack/identity.ts";
import { TEST_STACK_LOCK_PID_ENV } from "../src/core/test-stack/lock.ts";
import {
  assertTestTarget,
  fail,
  prepareWorkspace,
  requireDocker,
} from "./lib/test-stack/commands.mts";
import { repoRootFromScript } from "./lib/test-stack/paths.mts";
import { withTestStackLock } from "./lib/test-stack/runtime.mts";

const OPERATION = "test:verify";
const repoRoot = repoRootFromScript();

function runStep(label: string, script: string, args: string[] = []): void {
  console.log(`[${OPERATION}] ${label}`);
  const result = spawnSync(
    process.execPath,
    [join(repoRoot, script), ...args],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        [TEST_STACK_LOCK_PID_ENV]: String(process.pid),
      },
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    },
  );
  if (result.status !== 0) {
    fail(OPERATION, `${label} failed.`, result.status ?? 1);
  }
}

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  console.log(
    `[${OPERATION}] preparing a fresh isolated fixture on ${TEST_PROJECT_ID}, then running database tests, generated-types check, and Playwright. This does not run format, lint, typecheck, Vitest, or production build (\`npm run verify\`). Ordinary development is not reset.`,
  );

  runStep("start isolated test stack", "scripts/test-stack-start.mts");
  runStep("reset isolated test database", "scripts/test-stack-reset.mts");
  runStep("run pgTAP against isolated stack", "scripts/test-db.mts");
  console.log(
    `[${OPERATION}] resetting isolated fixtures again so pgTAP concurrency rows cannot leak into browser tests.`,
  );
  runStep(
    "reset isolated test database after pgTAP",
    "scripts/test-stack-reset.mts",
  );
  runStep(
    "check generated types against isolated schema",
    "scripts/test-types-check.mts",
  );
  runStep("run Playwright against isolated stack", "scripts/test-e2e.mts");

  console.log(`[${OPERATION}] isolated verification passed.`);
});
