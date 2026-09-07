import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyIsolatedTestCredentials,
  assertIsolatedTestClients,
  credentialsFromStatusEnv,
  findInheritedConnectionConflicts,
  parseSupabaseStatusEnv,
  type IsolatedTestCredentials,
} from "../../../src/core/test-stack/env.ts";
import { assertSafeTestStackMutation } from "../../../src/core/test-stack/guard.ts";
import {
  DEVELOPMENT_PROJECT_ID,
  TEST_API_ORIGIN,
  TEST_APP_PORTS,
  TEST_AUTH_HEALTH_URL,
  TEST_MAILBOX_ORIGIN,
  TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN,
  TEST_PLAYWRIGHT_ORIGIN,
  TEST_PROJECT_ID,
  TEST_STACK_PORTS,
  TEST_STACK_READY_ENV,
  TEST_STUDIO_ORIGIN,
} from "../../../src/core/test-stack/identity.ts";
import {
  classifyTestStackPorts,
  conflictMessages,
} from "../../../src/core/test-stack/ports.ts";
import { runSupabaseCli, type RunBinResult } from "../run-bin.mts";
import { hostedRefPaths, testWorkspacePath } from "./paths.mts";
import {
  dockerPortOwners,
  dockerPreflightForTestStack,
  dockerProjectIds,
  dockerVolumeNames,
  listeningPorts,
  redactSpawnOutput,
} from "./runtime.mts";
import {
  generatedWorkspaceIdentity,
  readWorkspaceMarker,
  syncTestWorkspace,
  workspaceFreshnessIssues,
} from "./workspace.mts";

export function fail(operation: string, message: string, code = 1): never {
  console.error(`[${operation}] ${message}`);
  process.exit(code);
}

export function requireDocker(operation: string): void {
  const docker = dockerPreflightForTestStack();
  if (!docker.ok) {
    fail(operation, docker.message);
  }
}

export function prepareWorkspace(operation: string, repoRoot: string): void {
  try {
    syncTestWorkspace(repoRoot);
  } catch (error) {
    fail(
      operation,
      error instanceof Error
        ? error.message
        : "failed to generate the isolated test workspace",
    );
  }
  const issues = workspaceFreshnessIssues(repoRoot);
  if (issues.length > 0) {
    fail(
      operation,
      `generated workspace is not synchronized:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }
}

export function assertTestTarget(operation: string, repoRoot: string): void {
  const identity = generatedWorkspaceIdentity(repoRoot);
  const result = assertSafeTestStackMutation({
    operation,
    repoRoot,
    workspacePath: testWorkspacePath(repoRoot),
    marker: readWorkspaceMarker(repoRoot),
    generatedProjectId: identity.projectId,
    generatedApiPort: identity.apiPort,
    generatedDbPort: identity.dbPort,
    hostedRefPaths: hostedRefPaths(repoRoot),
    runningProjectIds: dockerProjectIds().filter(
      (id) => id === TEST_PROJECT_ID,
    ),
    volumeNames: dockerVolumeNames(TEST_PROJECT_ID),
    requestedProjectId: TEST_PROJECT_ID,
  });
  if (!result.ok) {
    fail(operation, result.message.replace(`[${operation}] `, ""));
  }
}

export function assertPortsAvailableOrOurs(operation: string): "free" | "ours" {
  const classifications = classifyTestStackPorts({
    listening: listeningPorts(),
    dockerOwners: dockerPortOwners(),
  });
  const conflicts = conflictMessages(classifications);
  if (conflicts.length > 0) {
    fail(operation, conflicts.join("\n"));
  }
  return classifications.some((entry) => entry.status === "ours")
    ? "ours"
    : "free";
}

export function printSupabaseFailure(
  operation: string,
  result: RunBinResult,
): never {
  const combined = redactSpawnOutput(result);
  if (combined.trim().length > 0) {
    console.error(combined.trim());
  }
  fail(operation, "Supabase CLI command failed for the isolated test project.");
}

export function readTestStatusEnv(repoRoot: string): Record<string, string> {
  const result = runSupabaseCli({
    repoRoot,
    workdir: testWorkspacePath(repoRoot),
    args: ["status", "-o", "env"],
  });
  if (result.status !== 0) {
    printSupabaseFailure("test:stack:status", result);
  }
  return parseSupabaseStatusEnv(result.stdout);
}

export function loadIsolatedCredentials(
  operation: string,
  repoRoot: string,
): IsolatedTestCredentials {
  const parsed = credentialsFromStatusEnv(readTestStatusEnv(repoRoot));
  if ("error" in parsed) {
    fail(operation, parsed.error);
  }
  const conflicts = findInheritedConnectionConflicts({}, parsed);
  if (conflicts.length > 0) {
    fail(
      operation,
      `isolated credentials are not the test stack:\n${conflicts
        .map((conflict) => `  - ${conflict.key}: ${conflict.reason}`)
        .join("\n")}`,
    );
  }
  return parsed;
}

export function isolatedProcessEnv(
  operation: string,
  repoRoot: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const credentials = loadIsolatedCredentials(operation, repoRoot);
  const next = applyIsolatedTestCredentials(
    { ...base },
    credentials,
  ) as NodeJS.ProcessEnv;
  next[TEST_STACK_READY_ENV] = "1";
  next.VENUBOARD_ENV = next.VENUBOARD_ENV ?? "test";
  const issues = assertIsolatedTestClients(next);
  if (issues.length > 0) {
    fail(
      operation,
      `test clients are not isolated:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }
  return next;
}

export function printSafeStatus(repoRoot: string, running: boolean): void {
  console.log(`Project:           ${TEST_PROJECT_ID}`);
  console.log(`Workspace:         ${TEST_WORKSPACE_RELATIVE_DISPLAY}`);
  console.log(`Running:           ${running ? "yes" : "no"}`);
  console.log(`API:               ${TEST_API_ORIGIN}`);
  console.log(`Auth health:       ${TEST_AUTH_HEALTH_URL}`);
  console.log(`Studio:            ${TEST_STUDIO_ORIGIN}`);
  console.log(`Mailbox:           ${TEST_MAILBOX_ORIGIN}`);
  console.log(`Postgres port:     ${String(TEST_STACK_PORTS.db)}`);
  console.log(`Shadow DB port:    ${String(TEST_STACK_PORTS.shadow)}`);
  console.log(`Analytics port:    ${String(TEST_STACK_PORTS.analytics)}`);
  console.log(`Edge inspector:    ${String(TEST_STACK_PORTS.inspector)}`);
  console.log(
    `Pooler port:       ${String(TEST_STACK_PORTS.pooler)} (service disabled, reserved)`,
  );
  console.log(
    `Playwright app:    ${TEST_PLAYWRIGHT_ORIGIN} (port ${String(TEST_APP_PORTS.playwright)})`,
  );
  console.log(
    `Playwright hub:    ${TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN} (port ${String(TEST_APP_PORTS.playwrightLocalDev)})`,
  );
  console.log(
    `Ordinary app:      http://localhost:3000 (project ${DEVELOPMENT_PROJECT_ID}, unchanged)`,
  );
  if (running) {
    loadIsolatedCredentials("test:stack:status", repoRoot);
  }
}

const TEST_WORKSPACE_RELATIVE_DISPLAY = ".tmp/venuboard-test";

export function developmentConfigProjectId(repoRoot: string): string | null {
  const path = join(repoRoot, "supabase", "config.toml");
  if (!existsSync(path)) {
    return null;
  }
  const match = readFileSync(path, "utf8").match(
    /^\s*project_id\s*=\s*"([^"]+)"/m,
  );
  return match?.[1] ?? null;
}

export function assertOrdinaryDevelopmentResetTarget(
  operation: string,
  repoRoot: string,
): void {
  const projectId = developmentConfigProjectId(repoRoot);
  if (projectId === TEST_PROJECT_ID) {
    fail(
      operation,
      `refusing to run: repository supabase/config.toml is ${TEST_PROJECT_ID}. Ordinary development reset targets ${DEVELOPMENT_PROJECT_ID} only.`,
    );
  }
  if (projectId !== DEVELOPMENT_PROJECT_ID) {
    fail(
      operation,
      `refusing to run: unexpected development project_id ${projectId ?? "(missing)"}.`,
    );
  }
  if (hostedRefPaths(repoRoot).length > 0) {
    fail(
      operation,
      "refusing to run: a hosted Supabase project appears to be linked (.supabase/project-ref).",
    );
  }
}
