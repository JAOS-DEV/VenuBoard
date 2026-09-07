import {
  DEVELOPMENT_PROJECT_ID,
  TEST_PROJECT_ID,
  TEST_STACK_PORT_NAMES,
  TEST_STACK_PORTS,
  type TestStackPortName,
} from "./identity.ts";

export interface DockerPortOwner {
  readonly containerName: string;
  readonly projectId: string | null;
  readonly hostPorts: readonly number[];
}

export interface ListeningPort {
  readonly port: number;
  readonly pids: readonly number[];
}

export type PortClassification =
  | {
      readonly status: "free";
      readonly port: number;
      readonly name: TestStackPortName;
    }
  | {
      readonly status: "ours";
      readonly port: number;
      readonly name: TestStackPortName;
      readonly containerName: string;
    }
  | {
      readonly status: "conflict";
      readonly port: number;
      readonly name: TestStackPortName;
      readonly message: string;
    };

export function projectIdFromContainerName(
  containerName: string,
): string | null {
  const match = containerName.match(/^supabase_[a-z0-9]+_(.+)$/i);
  if (!match) {
    return null;
  }
  return match[1] ?? null;
}

export function classifyTestStackPorts(input: {
  readonly listening: readonly ListeningPort[];
  readonly dockerOwners: readonly DockerPortOwner[];
}): PortClassification[] {
  return TEST_STACK_PORT_NAMES.map((name) => {
    const port = TEST_STACK_PORTS[name];
    const listeners = input.listening.filter((entry) => entry.port === port);
    const owners = input.dockerOwners.filter((owner) =>
      owner.hostPorts.includes(port),
    );
    if (listeners.length === 0 && owners.length === 0) {
      return { status: "free", port, name };
    }

    const ours = owners.find((owner) => owner.projectId === TEST_PROJECT_ID);
    const foreign = owners.find((owner) => owner.projectId !== TEST_PROJECT_ID);

    if (ours && !foreign) {
      return {
        status: "ours",
        port,
        name,
        containerName: ours.containerName,
      };
    }

    if (foreign) {
      const foreignProject = foreign.projectId ?? "unknown";
      if (foreignProject === DEVELOPMENT_PROJECT_ID) {
        return {
          status: "conflict",
          port,
          name,
          message: occupiedMessage(
            port,
            name,
            `ordinary development container ${foreign.containerName}`,
          ),
        };
      }
      return {
        status: "conflict",
        port,
        name,
        message: occupiedMessage(
          port,
          name,
          `Docker container ${foreign.containerName} (project ${foreignProject})`,
        ),
      };
    }

    const pids = listeners.flatMap((entry) => entry.pids);
    const pidLabel =
      pids.length > 0
        ? `process ${pids.map(String).join(", ")}`
        : "an unrelated process";
    return {
      status: "conflict",
      port,
      name,
      message: occupiedMessage(port, name, pidLabel),
    };
  });
}

export function occupiedMessage(
  port: number,
  name: TestStackPortName,
  owner: string,
): string {
  return (
    `Isolated test port ${String(port)} (${name}) is already in use by ${owner}. ` +
    `The test stack needs exclusive use of its documented ports. Stop that process yourself if it is safe, then retry. ` +
    `This command will not kill it, adopt it, or fall back to development ports 54321–54324.`
  );
}

export function conflictMessages(
  classifications: readonly PortClassification[],
): string[] {
  return classifications
    .filter((entry) => entry.status === "conflict")
    .map((entry) => entry.message);
}

export function parseNetstatListening(output: string): ListeningPort[] {
  const byPort = new Map<number, Set<number>>();
  for (const line of output.split(/\r?\n/)) {
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
