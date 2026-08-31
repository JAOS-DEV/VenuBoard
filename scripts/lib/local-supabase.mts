#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/**
 * Shared local-stack checks for database scripts.
 * Never logs into or links a hosted Supabase project.
 */
export function refuseLinkedHostedProject(operation: string): void {
  if (existsSync(join(process.cwd(), ".supabase", "project-ref"))) {
    console.error(
      `[${operation}] refusing to run: a hosted Supabase project appears to be linked (.supabase/project-ref). Unlink and use the local Docker stack only.`,
    );
    process.exit(1);
  }
}

export function runSupabase(args: string[]): number {
  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error !== undefined) {
    console.error(
      `[supabase] failed to start the Supabase CLI. A local stack needs Docker.`,
    );
    process.exit(1);
  }

  return result.status ?? 1;
}
