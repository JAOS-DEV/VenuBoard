#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  classifyDockerVersionResult,
  type DockerPreflightResult,
} from "../../src/core/dev/docker-preflight.ts";
import {
  applyParsedEnvFile,
  LOCAL_ENV_FILE_NAME,
} from "../../src/core/dev/local-env-file.ts";

export function readRootEnvLocal(cwd: string = process.cwd()): {
  exists: boolean;
  contents?: string;
} {
  const filePath = join(cwd, LOCAL_ENV_FILE_NAME);
  if (!existsSync(filePath)) {
    return { exists: false };
  }
  return { exists: true, contents: readFileSync(filePath, "utf8") };
}

export function applyRootEnvLocal(
  env: Record<string, string | undefined>,
  options: { required: boolean; cwd?: string },
): Record<string, string | undefined> {
  return applyParsedEnvFile(
    {
      ...readRootEnvLocal(options.cwd ?? process.cwd()),
      required: options.required,
    },
    env,
  );
}

export function applyRootEnvLocalToProcess(options: {
  required: boolean;
  cwd?: string;
}): void {
  const merged = applyRootEnvLocal(process.env, options);
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

export function isHostedProjectLinked(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, ".supabase", "project-ref"));
}

export function runDockerPreflight(): DockerPreflightResult {
  const result = spawnSync("docker", ["version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const errorCode =
    result.error !== undefined && "code" in result.error
      ? String(result.error.code)
      : undefined;

  return classifyDockerVersionResult({
    errorCode,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });
}
