import { DEVELOPMENT_PROJECT_ID, TEST_PROJECT_ID } from "./identity.ts";
import type { PortClassification } from "./ports.ts";

export type TestStackStartPlan =
  | { readonly action: "reuse" }
  | { readonly action: "start" }
  | { readonly action: "refuse"; readonly message: string };

export function decideTestStackStart(input: {
  readonly dockerOk: boolean;
  readonly dockerMessage?: string;
  readonly portClassifications: readonly PortClassification[];
  readonly runningProjectIds: readonly string[];
}): TestStackStartPlan {
  if (!input.dockerOk) {
    return {
      action: "refuse",
      message:
        input.dockerMessage ??
        "Docker is not available. Open Docker Desktop, then rerun `npm run test:stack:start`.",
    };
  }

  const conflict = input.portClassifications.find(
    (entry) => entry.status === "conflict",
  );
  if (conflict) {
    return { action: "refuse", message: conflict.message };
  }

  const ours = input.portClassifications.some(
    (entry) => entry.status === "ours",
  );
  const running = input.runningProjectIds.includes(TEST_PROJECT_ID);
  if (ours && running) {
    return { action: "reuse" };
  }

  if (
    input.runningProjectIds.includes(DEVELOPMENT_PROJECT_ID) &&
    !running &&
    !ours
  ) {
    return { action: "start" };
  }

  return { action: "start" };
}

export type TestStackStopPlan =
  | { readonly action: "already-stopped" }
  | { readonly action: "stop" }
  | { readonly action: "refuse"; readonly message: string };

export function decideTestStackStop(input: {
  readonly runningProjectIds: readonly string[];
}): TestStackStopPlan {
  if (!input.runningProjectIds.includes(TEST_PROJECT_ID)) {
    return { action: "already-stopped" };
  }
  return { action: "stop" };
}

export function stopAffectedDevelopment(
  before: readonly string[],
  after: readonly string[],
): boolean {
  return (
    before.includes(DEVELOPMENT_PROJECT_ID) &&
    !after.includes(DEVELOPMENT_PROJECT_ID)
  );
}
