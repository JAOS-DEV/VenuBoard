import { TEST_PROJECT_ID } from "./identity.ts";

export interface TestStackLock {
  readonly pid: number;
  readonly command: string;
  readonly createdAt: string;
  readonly repoRoot: string;
  readonly projectId: typeof TEST_PROJECT_ID;
}

export type LockDecision =
  | { readonly action: "acquire" }
  | { readonly action: "reenter"; readonly lock: TestStackLock }
  | { readonly action: "replace-stale"; readonly lock: TestStackLock }
  | { readonly action: "reject"; readonly message: string };

export function parseTestStackLock(raw: unknown): TestStackLock | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (
    typeof value.pid !== "number" ||
    !Number.isInteger(value.pid) ||
    value.pid <= 0
  ) {
    return null;
  }
  if (typeof value.command !== "string" || value.command.length === 0) {
    return null;
  }
  if (typeof value.createdAt !== "string" || value.createdAt.length === 0) {
    return null;
  }
  if (typeof value.repoRoot !== "string" || value.repoRoot.length === 0) {
    return null;
  }
  if (value.projectId !== TEST_PROJECT_ID) {
    return null;
  }
  return {
    pid: value.pid,
    command: value.command,
    createdAt: value.createdAt,
    repoRoot: value.repoRoot,
    projectId: TEST_PROJECT_ID,
  };
}

export const TEST_STACK_LOCK_PID_ENV = "VENUBOARD_TEST_STACK_LOCK_PID";

export function decideLockAction(input: {
  readonly existing: TestStackLock | null;
  readonly currentPid: number;
  readonly inheritedHolderPid?: number;
  readonly isPidAlive: (pid: number) => boolean;
}): LockDecision {
  if (input.existing === null) {
    return { action: "acquire" };
  }

  if (input.existing.pid === input.currentPid) {
    return { action: "reenter", lock: input.existing };
  }

  if (
    input.inheritedHolderPid !== undefined &&
    input.inheritedHolderPid === input.existing.pid &&
    input.isPidAlive(input.existing.pid)
  ) {
    return { action: "reenter", lock: input.existing };
  }

  if (input.isPidAlive(input.existing.pid)) {
    return {
      action: "reject",
      message:
        `Isolated test stack is locked by pid ${String(input.existing.pid)} (${input.existing.command}). ` +
        `Wait for that command to finish. This command will not steal an active lock.`,
    };
  }

  return { action: "replace-stale", lock: input.existing };
}

export function createLock(input: {
  readonly pid: number;
  readonly command: string;
  readonly repoRoot: string;
  readonly createdAt?: string;
}): TestStackLock {
  return {
    pid: input.pid,
    command: input.command,
    createdAt: input.createdAt ?? new Date().toISOString(),
    repoRoot: input.repoRoot,
    projectId: TEST_PROJECT_ID,
  };
}
