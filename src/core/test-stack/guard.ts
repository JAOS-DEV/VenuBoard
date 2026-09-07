import {
  DEVELOPMENT_PROJECT_ID,
  HOSTED_PROJECT_REF_RELATIVE_PATH,
  TEST_PROJECT_ID,
  TEST_STACK_PORTS,
  TEST_WORKSPACE_KIND,
  TEST_WORKSPACE_RELATIVE_DIR,
  TEST_WORKSPACE_VERSION,
} from "./identity.ts";

export interface TestWorkspaceMarker {
  readonly kind: typeof TEST_WORKSPACE_KIND;
  readonly version: typeof TEST_WORKSPACE_VERSION;
  readonly repoRoot: string;
  readonly projectId: typeof TEST_PROJECT_ID;
  readonly sourceFingerprint: string;
  readonly generatedAt: string;
}

export interface DestructiveGuardInput {
  readonly operation: string;
  readonly repoRoot: string;
  readonly workspacePath: string;
  readonly marker: TestWorkspaceMarker | null;
  readonly generatedProjectId: string | null;
  readonly generatedDbPort: number | null;
  readonly generatedApiPort: number | null;
  readonly hostedRefPaths: readonly string[];
  readonly runningProjectIds: readonly string[];
  readonly volumeNames: readonly string[];
  readonly requestedProjectId?: string;
}

export type DestructiveGuardResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export function parseWorkspaceMarker(raw: unknown): TestWorkspaceMarker | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (value.kind !== TEST_WORKSPACE_KIND) {
    return null;
  }
  if (value.version !== TEST_WORKSPACE_VERSION) {
    return null;
  }
  if (typeof value.repoRoot !== "string" || value.repoRoot.length === 0) {
    return null;
  }
  if (value.projectId !== TEST_PROJECT_ID) {
    return null;
  }
  if (
    typeof value.sourceFingerprint !== "string" ||
    value.sourceFingerprint.length === 0
  ) {
    return null;
  }
  if (typeof value.generatedAt !== "string" || value.generatedAt.length === 0) {
    return null;
  }
  return {
    kind: TEST_WORKSPACE_KIND,
    version: TEST_WORKSPACE_VERSION,
    repoRoot: value.repoRoot,
    projectId: TEST_PROJECT_ID,
    sourceFingerprint: value.sourceFingerprint,
    generatedAt: value.generatedAt,
  };
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function isWorkspaceInsideRepo(
  repoRoot: string,
  workspacePath: string,
): boolean {
  const root = normalizePath(repoRoot);
  const workspace = normalizePath(workspacePath);
  const expected = `${root}/${TEST_WORKSPACE_RELATIVE_DIR}`;
  return workspace === expected;
}

export function assertSafeTestStackMutation(
  input: DestructiveGuardInput,
): DestructiveGuardResult {
  const prefix = `[${input.operation}]`;

  if (
    input.requestedProjectId !== undefined &&
    input.requestedProjectId !== TEST_PROJECT_ID
  ) {
    return {
      ok: false,
      message: `${prefix} refusing to run: requested project "${input.requestedProjectId}" is not the isolated test project ${TEST_PROJECT_ID}.`,
    };
  }

  if (input.generatedProjectId === DEVELOPMENT_PROJECT_ID) {
    return {
      ok: false,
      message: `${prefix} refusing to run: target project is ordinary development (${DEVELOPMENT_PROJECT_ID}). Use npm run test:stack:reset only against ${TEST_PROJECT_ID}.`,
    };
  }

  if (input.generatedProjectId !== TEST_PROJECT_ID) {
    return {
      ok: false,
      message: `${prefix} refusing to run: generated workspace project_id is ${input.generatedProjectId ?? "(missing)"}, expected ${TEST_PROJECT_ID}.`,
    };
  }

  if (input.marker === null) {
    return {
      ok: false,
      message: `${prefix} refusing to run: generated workspace marker is missing or invalid. Rebuild it with npm run test:stack:start.`,
    };
  }

  if (normalizePath(input.marker.repoRoot) !== normalizePath(input.repoRoot)) {
    return {
      ok: false,
      message: `${prefix} refusing to run: workspace marker belongs to a different repository.`,
    };
  }

  if (!isWorkspaceInsideRepo(input.repoRoot, input.workspacePath)) {
    return {
      ok: false,
      message: `${prefix} refusing to run: workspace path is not this repository's ${TEST_WORKSPACE_RELATIVE_DIR}.`,
    };
  }

  if (input.generatedApiPort !== TEST_STACK_PORTS.api) {
    return {
      ok: false,
      message: `${prefix} refusing to run: generated API port is ${String(input.generatedApiPort)}, expected ${String(TEST_STACK_PORTS.api)}.`,
    };
  }

  if (input.generatedDbPort !== TEST_STACK_PORTS.db) {
    return {
      ok: false,
      message: `${prefix} refusing to run: generated database port is ${String(input.generatedDbPort)}, expected ${String(TEST_STACK_PORTS.db)}.`,
    };
  }

  const hosted = input.hostedRefPaths.filter((path) => path.length > 0);
  if (hosted.length > 0) {
    return {
      ok: false,
      message: `${prefix} refusing to run: a hosted Supabase project-ref is present (${hosted.join(", ")}). Unlink it. Isolated tests never use a hosted project.`,
    };
  }

  const unexpectedRunning = input.runningProjectIds.filter(
    (projectId) =>
      projectId !== TEST_PROJECT_ID && projectId !== DEVELOPMENT_PROJECT_ID,
  );
  if (unexpectedRunning.length > 0) {
    return {
      ok: false,
      message: `${prefix} refusing to run: unexpected running Supabase project(s) ${unexpectedRunning.join(", ")} while targeting ${TEST_PROJECT_ID}.`,
    };
  }

  const testVolumes = input.volumeNames.filter((name) =>
    name.includes(TEST_PROJECT_ID),
  );
  const developmentVolumesTargeted = input.volumeNames.filter(
    (name) =>
      name.includes(`_${DEVELOPMENT_PROJECT_ID}`) &&
      !name.includes(TEST_PROJECT_ID),
  );
  if (developmentVolumesTargeted.length > 0 && testVolumes.length === 0) {
    return {
      ok: false,
      message: `${prefix} refusing to run: Docker volumes look like ordinary development (${DEVELOPMENT_PROJECT_ID}), not ${TEST_PROJECT_ID}.`,
    };
  }

  return { ok: true };
}

export function hostedRefPath(root: string): string {
  return `${root.replace(/[\\/]+$/, "")}/${HOSTED_PROJECT_REF_RELATIVE_PATH}`;
}

export function developmentResetRejection(
  projectId: string,
  operation: string,
): string {
  return (
    `[${operation}] refusing to run: this isolated-test command cannot target ordinary development project "${projectId}". ` +
    `Use npm run local:reset only with explicit permission for shared development data.`
  );
}
