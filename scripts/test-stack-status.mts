#!/usr/bin/env node
import { TEST_PROJECT_ID } from "../src/core/test-stack/identity.ts";
import {
  printSafeStatus,
  prepareWorkspace,
} from "./lib/test-stack/commands.mts";
import { repoRootFromScript } from "./lib/test-stack/paths.mts";
import { dockerProjectIds } from "./lib/test-stack/runtime.mts";

const OPERATION = "test:stack:status";
const repoRoot = repoRootFromScript();

prepareWorkspace(OPERATION, repoRoot);
const running = dockerProjectIds().includes(TEST_PROJECT_ID);
printSafeStatus(repoRoot, running);
if (!running) {
  console.log(`[${OPERATION}] isolated test stack is stopped.`);
}
