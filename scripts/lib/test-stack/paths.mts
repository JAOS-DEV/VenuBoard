import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HOSTED_PROJECT_REF_RELATIVE_PATH,
  TEST_LOCK_RELATIVE_PATH,
  TEST_WORKSPACE_MARKER_NAME,
  TEST_WORKSPACE_RELATIVE_DIR,
} from "../../../src/core/test-stack/identity.ts";

export function repoRootFromScript(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function testWorkspacePath(repoRoot: string): string {
  return join(repoRoot, ...TEST_WORKSPACE_RELATIVE_DIR.split("/"));
}

export function testWorkspaceSupabasePath(repoRoot: string): string {
  return join(testWorkspacePath(repoRoot), "supabase");
}

export function testWorkspaceMarkerPath(repoRoot: string): string {
  return join(testWorkspacePath(repoRoot), TEST_WORKSPACE_MARKER_NAME);
}

export function testLockPath(repoRoot: string): string {
  return join(repoRoot, ...TEST_LOCK_RELATIVE_PATH.split("/"));
}

export function hostedRefExists(root: string): boolean {
  return existsSync(join(root, ...HOSTED_PROJECT_REF_RELATIVE_PATH.split("/")));
}

export function hostedRefPaths(repoRoot: string): string[] {
  const roots = [repoRoot, testWorkspacePath(repoRoot)];
  return roots
    .filter((root) => hostedRefExists(root))
    .map((root) => join(root, ...HOSTED_PROJECT_REF_RELATIVE_PATH.split("/")));
}
