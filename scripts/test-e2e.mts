#!/usr/bin/env node
import { forwardedCliArgs } from "../src/core/test-stack/args.ts";
import {
  DEVELOPMENT_STACK_PORTS,
  TEST_PROJECT_ID,
  TEST_STACK_READY_ENV,
} from "../src/core/test-stack/identity.ts";
import {
  assertTestTarget,
  fail,
  isolatedProcessEnv,
  prepareWorkspace,
  requireDocker,
} from "./lib/test-stack/commands.mts";
import { playwrightCliPath, runNodeBin } from "./lib/run-bin.mts";
import { repoRootFromScript } from "./lib/test-stack/paths.mts";
import {
  dockerProjectIds,
  withTestStackLock,
} from "./lib/test-stack/runtime.mts";

const OPERATION = "test:e2e";
const repoRoot = repoRootFromScript();
const extra = forwardedCliArgs(process.argv);

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  if (!dockerProjectIds().includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `isolated project ${TEST_PROJECT_ID} is not running. Start it with npm run test:stack:start. This command does not reset the database or reuse http://localhost:3000.`,
    );
  }

  const env = isolatedProcessEnv(OPERATION, repoRoot);
  env[TEST_STACK_READY_ENV] = "1";
  env.VENUBOARD_ENV = "test";

  if (
    (env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(
      `:${String(DEVELOPMENT_STACK_PORTS.api)}`,
    )
  ) {
    fail(
      OPERATION,
      "refusing to start Playwright: credentials still point at the development API.",
    );
  }

  console.log(
    `[${OPERATION}] running Playwright against isolated project ${TEST_PROJECT_ID} with test-owned servers on ports 3100 and 3101. Ordinary development on port 3000 is left running. This does not reset fixtures.`,
  );

  const result = runNodeBin(playwrightCliPath(repoRoot), ["test", ...extra], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(OPERATION, "Playwright failed.", result.status);
  }
});
