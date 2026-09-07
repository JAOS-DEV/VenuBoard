import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { classifyDockerVersionResult } from "../../../src/core/dev/docker-preflight.ts";
import { redactCredentialText } from "../../../src/core/test-stack/env.ts";
import {
  TEST_STACK_LOCK_PID_ENV,
  createLock,
  decideLockAction,
  parseTestStackLock,
  type TestStackLock,
} from "../../../src/core/test-stack/lock.ts";
import { TEST_PROJECT_ID } from "../../../src/core/test-stack/identity.ts";
import { testLockPath } from "./paths.mts";
import { mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readLock(repoRoot: string): TestStackLock | null {
  try {
    return parseTestStackLock(
      JSON.parse(readFileSync(testLockPath(repoRoot), "utf8")),
    );
  } catch {
    return null;
  }
}

export function acquireTestStackLock(
  repoRoot: string,
  command: string,
):
  | { acquired: true; reentered: boolean }
  | { acquired: false; message: string } {
  const path = testLockPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  const existing = readLock(repoRoot);
  const inherited = Number.parseInt(
    process.env[TEST_STACK_LOCK_PID_ENV] ?? "",
    10,
  );
  const decision = decideLockAction({
    existing,
    currentPid: process.pid,
    inheritedHolderPid:
      Number.isInteger(inherited) && inherited > 0 ? inherited : undefined,
    isPidAlive,
  });

  if (decision.action === "reject") {
    return { acquired: false, message: decision.message };
  }

  if (decision.action === "reenter") {
    return { acquired: true, reentered: true };
  }

  const lock = createLock({
    pid: process.pid,
    command,
    repoRoot,
  });

  try {
    writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`, {
      flag: decision.action === "acquire" ? "wx" : "w",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      const raced = readLock(repoRoot);
      if (raced && raced.pid !== process.pid && isPidAlive(raced.pid)) {
        return {
          acquired: false,
          message:
            `Isolated test stack is locked by pid ${String(raced.pid)} (${raced.command}). ` +
            `Wait for that command to finish. This command will not steal an active lock.`,
        };
      }
      writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`);
    } else {
      throw error;
    }
  }

  return { acquired: true, reentered: false };
}

export function releaseTestStackLock(repoRoot: string): void {
  const existing = readLock(repoRoot);
  if (existing === null || existing.pid !== process.pid) {
    return;
  }
  try {
    unlinkSync(testLockPath(repoRoot));
  } catch {
    // Interrupted cleanup must not hide the original command result.
  }
}

export function withTestStackLock<T>(
  repoRoot: string,
  command: string,
  fn: () => T,
): T {
  const lock = acquireTestStackLock(repoRoot, command);
  if (!lock.acquired) {
    console.error(`[${command}] ${lock.message}`);
    process.exit(1);
  }
  const previousHolder = process.env[TEST_STACK_LOCK_PID_ENV];
  if (!lock.reentered) {
    process.env[TEST_STACK_LOCK_PID_ENV] = String(process.pid);
  }
  try {
    return fn();
  } finally {
    if (!lock.reentered) {
      if (previousHolder === undefined) {
        delete process.env[TEST_STACK_LOCK_PID_ENV];
      } else {
        process.env[TEST_STACK_LOCK_PID_ENV] = previousHolder;
      }
      releaseTestStackLock(repoRoot);
    }
  }
}

export function dockerPreflightForTestStack():
  { ok: true } | { ok: false; message: string } {
  const result = spawnSync("docker", ["version"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  const errorCode =
    result.error !== undefined && "code" in result.error
      ? String(result.error.code)
      : undefined;
  const classified = classifyDockerVersionResult({
    errorCode,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });
  if (classified.ok) {
    return classified;
  }
  const retry = "then rerun `npm run test:stack:start`.";
  if (classified.reason === "cli_missing") {
    return {
      ok: false,
      message: `Docker CLI was not found. Install Docker Desktop, open it, wait until \`docker version\` shows both Client and Server, ${retry}`,
    };
  }
  if (classified.reason === "engine_unavailable") {
    return {
      ok: false,
      message: `Docker Desktop's Linux engine is not running. Open Docker Desktop, wait until \`docker version\` shows both Client and Server, ${retry}`,
    };
  }
  return {
    ok: false,
    message: classified.message.replace(
      "npm run local:start",
      "npm run test:stack:start",
    ),
  };
}

export function dockerProjectIds(): string[] {
  const result = spawnSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  if (result.status !== 0) {
    return [];
  }
  const ids = new Set<string>();
  for (const name of (result.stdout ?? "").split(/\r?\n/)) {
    const trimmed = name.trim();
    const match = trimmed.match(/^supabase_[a-z0-9]+_(.+)$/i);
    if (match && match[1]) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

export function dockerVolumeNames(
  projectId: string = TEST_PROJECT_ID,
): string[] {
  const result = spawnSync(
    "docker",
    ["volume", "ls", "--format", "{{.Name}}"],
    { encoding: "utf8", windowsHide: true, shell: false },
  );
  if (result.status !== 0) {
    return [];
  }
  return (result.stdout ?? "")
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => name.includes(projectId));
}

export function dockerPortOwners(): {
  containerName: string;
  projectId: string | null;
  hostPorts: number[];
}[] {
  const result = spawnSync(
    "docker",
    ["ps", "--format", "{{.Names}}\t{{.Ports}}"],
    { encoding: "utf8", windowsHide: true, shell: false },
  );
  if (result.status !== 0) {
    return [];
  }
  const owners = [];
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!line.includes("\t")) {
      continue;
    }
    const [containerName, ports] = line.split("\t");
    if (!containerName) {
      continue;
    }
    const hostPorts = [...(ports ?? "").matchAll(/:(\d+)->/g)].map((match) =>
      Number.parseInt(match[1] ?? "", 10),
    );
    const match = containerName.match(/^supabase_[a-z0-9]+_(.+)$/i);
    owners.push({
      containerName,
      projectId: match?.[1] ?? null,
      hostPorts: hostPorts.filter((port) => Number.isFinite(port)),
    });
  }
  return owners;
}

export function listeningPorts(): { port: number; pids: number[] }[] {
  const args =
    process.platform === "win32" ? ["netstat", ["-ano"]] : ["ss", ["-lptn"]];
  const result = spawnSync(args[0] as string, args[1] as string[], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  if (result.status !== 0) {
    return [];
  }
  const byPort = new Map<number, Set<number>>();
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!/LISTEN/i.test(line)) {
      continue;
    }
    const portMatch = line.match(/:(\d+)\s/);
    const pidMatch = line.match(/(\d+)\s*$/);
    if (!portMatch) {
      continue;
    }
    const port = Number.parseInt(portMatch[1] ?? "", 10);
    if (!Number.isFinite(port)) {
      continue;
    }
    const pids = byPort.get(port) ?? new Set<number>();
    if (pidMatch) {
      const pid = Number.parseInt(pidMatch[1] ?? "", 10);
      if (Number.isFinite(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    byPort.set(port, pids);
  }
  return [...byPort.entries()].map(([port, pids]) => ({
    port,
    pids: [...pids],
  }));
}

export function redactSpawnOutput(result: {
  stdout: string;
  stderr: string;
}): string {
  return redactCredentialText(`${result.stdout}\n${result.stderr}`);
}
