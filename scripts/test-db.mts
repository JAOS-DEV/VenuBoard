#!/usr/bin/env node
import { join } from "node:path";

import {
  forwardedCliArgs,
  rewriteSqlTestArg,
} from "../src/core/test-stack/args.ts";
import { TEST_PROJECT_ID } from "../src/core/test-stack/identity.ts";
import {
  assertTestTarget,
  fail,
  isolatedProcessEnv,
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

const OPERATION = "test:db";
const repoRoot = repoRootFromScript();
const extra = forwardedCliArgs(process.argv);

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  if (!dockerProjectIds().includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `isolated project ${TEST_PROJECT_ID} is not running. Start it with npm run test:stack:start. This command does not reset the database.`,
    );
  }

  const env = isolatedProcessEnv(OPERATION, repoRoot);
  const rewritten = extra.map((arg) =>
    rewriteSqlTestArg(arg, (...parts) =>
      join(testWorkspacePath(repoRoot), ...parts),
    ),
  );
  console.log(
    `[${OPERATION}] running pgTAP against isolated project ${TEST_PROJECT_ID}. This does not reset fixtures.`,
  );

  const result = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["test", "db", "--local", ...rewritten],
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    printSupabaseFailure(OPERATION, result);
  }
});
