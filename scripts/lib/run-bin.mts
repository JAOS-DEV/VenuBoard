import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface RunBinResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: NodeJS.ErrnoException;
}

function asResult(result: SpawnSyncReturns<string>): RunBinResult {
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error !== undefined
      ? { error: result.error as NodeJS.ErrnoException }
      : {}),
  };
}

/**
 * Run a Node bin with argv tokens. Never interpolates a command string, so
 * Windows paths like `C:\Users\James PC\...` stay intact.
 */
export function runNodeBin(
  binPath: string,
  args: readonly string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    stdio?: "pipe" | "inherit";
    input?: string;
  },
): RunBinResult {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    input: options.input,
    stdio: options.stdio === "inherit" ? "inherit" : "pipe",
  });
  return asResult(result);
}

export function supabaseCliPath(repoRoot: string): string {
  const path = join(
    repoRoot,
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  if (!existsSync(path)) {
    throw new Error(`Pinned Supabase CLI is missing at ${path}. Run npm ci.`);
  }
  return path;
}

export function playwrightCliPath(repoRoot: string): string {
  const path = join(repoRoot, "node_modules", "@playwright", "test", "cli.js");
  if (!existsSync(path)) {
    throw new Error(`Playwright CLI is missing at ${path}. Run npm ci.`);
  }
  return path;
}

export function prettierCliPath(repoRoot: string): string {
  const path = join(
    repoRoot,
    "node_modules",
    "prettier",
    "bin",
    "prettier.cjs",
  );
  if (!existsSync(path)) {
    throw new Error(`Prettier CLI is missing at ${path}. Run npm ci.`);
  }
  return path;
}

export function runSupabaseCli(input: {
  repoRoot: string;
  workdir: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
  stdio?: "pipe" | "inherit";
}): RunBinResult {
  return runNodeBin(
    supabaseCliPath(input.repoRoot),
    ["--workdir", input.workdir, ...input.args],
    {
      cwd: input.repoRoot,
      env: input.env,
      stdio: input.stdio,
    },
  );
}
