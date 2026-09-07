#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
import { prettierCliPath, runNodeBin, runSupabaseCli } from "./lib/run-bin.mts";

const OPERATION = "test:types:check";
const repoRoot = repoRootFromScript();
const typesPath = join("src", "core", "db", "types.ts");

withTestStackLock(repoRoot, OPERATION, () => {
  requireDocker(OPERATION);
  prepareWorkspace(OPERATION, repoRoot);
  assertTestTarget(OPERATION, repoRoot);

  if (!dockerProjectIds().includes(TEST_PROJECT_ID)) {
    fail(
      OPERATION,
      `isolated project ${TEST_PROJECT_ID} is not running. Start it with npm run test:stack:start.`,
    );
  }

  const generated = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["gen", "types", "typescript", "--local"],
  });
  if (generated.status !== 0) {
    printSupabaseFailure(OPERATION, generated);
  }

  const formatted = runNodeBin(
    prettierCliPath(repoRoot),
    ["--stdin-filepath", typesPath],
    {
      cwd: repoRoot,
      input: generated.stdout.replace(/\r\n/g, "\n"),
    },
  );
  if (formatted.status !== 0) {
    console.error(formatted.stderr);
    fail(OPERATION, "Prettier failed on generated types.");
  }

  const committed = readFileSync(join(repoRoot, typesPath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const next = (formatted.stdout ?? "").replace(/\r\n/g, "\n");
  if (committed === next) {
    console.log(
      `[${OPERATION}] ${typesPath} matches the isolated test schema.`,
    );
    return;
  }
  fail(
    OPERATION,
    `generated types differ from ${typesPath}. Run \`npm run db:types\` then \`npm run format\` and commit the result.`,
  );
});
