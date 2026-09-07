#!/usr/bin/env node
import { decideTestStackStart } from "../src/core/test-stack/start-plan.ts";
import {
  DEVELOPMENT_PROJECT_ID,
  TEST_PROJECT_ID,
} from "../src/core/test-stack/identity.ts";
import {
  assertPortsAvailableOrOurs,
  assertTestTarget,
  fail,
  prepareWorkspace,
  printSafeStatus,
  printSupabaseFailure,
} from "./lib/test-stack/commands.mts";
import { classifyTestStackPorts } from "../src/core/test-stack/ports.ts";
import {
  repoRootFromScript,
  testWorkspacePath,
} from "./lib/test-stack/paths.mts";
import {
  dockerPortOwners,
  dockerPreflightForTestStack,
  dockerProjectIds,
  listeningPorts,
  withTestStackLock,
} from "./lib/test-stack/runtime.mts";
import { runSupabaseCli } from "./lib/run-bin.mts";

const OPERATION = "test:stack:start";
const repoRoot = repoRootFromScript();

withTestStackLock(repoRoot, OPERATION, () => {
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);
  const docker = dockerPreflightForTestStack();
  const portClassifications = classifyTestStackPorts({
    listening: listeningPorts(),
    dockerOwners: dockerPortOwners(),
  });
  const plan = decideTestStackStart({
    dockerOk: docker.ok,
    dockerMessage: docker.ok ? undefined : docker.message,
    portClassifications,
    runningProjectIds: dockerProjectIds(),
  });
  if (plan.action === "refuse") {
    fail(OPERATION, plan.message);
  }

  if (plan.action === "reuse") {
    console.log(
      `[${OPERATION}] reusing verified isolated project ${TEST_PROJECT_ID}. This does not reset the database.`,
    );
    printSafeStatus(repoRoot, true);
    return;
  }

  assertPortsAvailableOrOurs(OPERATION);

  console.log(
    `[${OPERATION}] starting isolated project ${TEST_PROJECT_ID}. This does not reset data and does not touch ${DEVELOPMENT_PROJECT_ID}.`,
  );
  const result = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["start"],
  });
  if (result.status !== 0) {
    printSupabaseFailure(OPERATION, result);
  }

  if (!dockerProjectIds().includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `started command finished but project ${TEST_PROJECT_ID} is not running.`,
    );
  }
  assertPortsAvailableOrOurs(OPERATION);
  printSafeStatus(repoRoot, true);
});
