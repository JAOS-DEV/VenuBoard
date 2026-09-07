#!/usr/bin/env node
import {
  DEVELOPMENT_PROJECT_ID,
  TEST_PROJECT_ID,
} from "../src/core/test-stack/identity.ts";
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

const OPERATION = "test:stack:stop";
const repoRoot = repoRootFromScript();

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  const before = dockerProjectIds();
  if (!before.includes(TEST_PROJECT_ID)) {
    console.log(
      `[${OPERATION}] isolated project ${TEST_PROJECT_ID} is already stopped.`,
    );
    return;
  }

  console.log(
    `[${OPERATION}] stopping isolated project ${TEST_PROJECT_ID} only. Volumes are kept. Ordinary development project ${DEVELOPMENT_PROJECT_ID} is left running.`,
  );

  const result = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["stop", "--project-id", TEST_PROJECT_ID],
  });
  if (result.status !== 0) {
    printSupabaseFailure(OPERATION, result);
  }

  const after = dockerProjectIds();
  if (after.includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `stop finished but ${TEST_PROJECT_ID} containers are still running.`,
    );
  }
  if (
    before.includes(DEVELOPMENT_PROJECT_ID) &&
    !after.includes(DEVELOPMENT_PROJECT_ID)
  ) {
    fail(
      OPERATION,
      `stop affected ordinary development project ${DEVELOPMENT_PROJECT_ID}. That must never happen.`,
    );
  }
  console.log(`[${OPERATION}] isolated test stack stopped.`);
});
