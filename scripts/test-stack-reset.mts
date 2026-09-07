#!/usr/bin/env node
import { TEST_PROJECT_ID } from "../src/core/test-stack/identity.ts";
import {
  assertTestTarget,
  fail,
  prepareWorkspace,
  printSupabaseFailure,
  requireDocker,
} from "./lib/test-stack/commands.mts";
import {
  repoRootFromScript,
  testWorkspacePath,
} from "./lib/test-stack/paths.mts";
import {
  dockerProjectIds,
  withTestStackLock,
} from "./lib/test-stack/runtime.mts";
import { runSupabaseCli } from "./lib/run-bin.mts";

const OPERATION = "test:stack:reset";
const repoRoot = repoRootFromScript();

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  if (!dockerProjectIds().includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `isolated project ${TEST_PROJECT_ID} is not running. Start it with npm run test:stack:start. This command will not start or reset ordinary development.`,
    );
  }

  console.log(
    `[${OPERATION}] resetting ONLY isolated automated-test project ${TEST_PROJECT_ID}. This erases isolated test data (migrations + deterministic seed). It does not reset ordinary development project venuboard or .env.local.`,
  );

  const result = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["--yes", "db", "reset", "--local"],
  });
  if (result.status !== 0) {
    printSupabaseFailure(OPERATION, result);
  }
  console.log(`[${OPERATION}] isolated test database reset complete.`);
});
