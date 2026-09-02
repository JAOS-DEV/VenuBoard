import { parseServerEnv } from "../env/schema.ts";

import type { DockerPreflightResult } from "./docker-preflight.ts";
import {
  MISSING_LOCAL_ENV_FILE_MESSAGE,
  applyParsedEnvFile,
} from "./local-env-file.ts";

export type LocalStartDecision =
  { action: "start" } | { action: "refuse"; code: string; message: string };

export function decideLocalStart(input: {
  env: Record<string, string | undefined>;
  envFile: { exists: boolean; contents?: string };
  hostedProjectLinked: boolean;
  docker: DockerPreflightResult;
}): LocalStartDecision {
  let merged: Record<string, string | undefined>;
  try {
    merged = applyParsedEnvFile(
      { ...input.envFile, required: true },
      input.env,
    );
  } catch (error) {
    return {
      action: "refuse",
      code: "missing_env_file",
      message:
        error instanceof Error ? error.message : MISSING_LOCAL_ENV_FILE_MESSAGE,
    };
  }

  if (input.hostedProjectLinked) {
    return {
      action: "refuse",
      code: "hosted_project",
      message:
        "a hosted Supabase project appears to be linked (.supabase/project-ref). Unlink and use the local Docker stack only.",
    };
  }

  const identifier = merged.VENUBOARD_ENV?.trim();
  if (identifier !== "local") {
    return {
      action: "refuse",
      code:
        identifier === undefined || identifier.length === 0
          ? "unset_env"
          : "not_local",
      message: 'VENUBOARD_ENV must be "local".',
    };
  }

  if (merged.NODE_ENV === "production") {
    return {
      action: "refuse",
      code: "production_node",
      message: "NODE_ENV is production.",
    };
  }

  try {
    parseServerEnv(merged);
  } catch (error) {
    return {
      action: "refuse",
      code: "invalid_env",
      message:
        error instanceof Error
          ? error.message
          : "the environment configuration is invalid.",
    };
  }

  if (!input.docker.ok) {
    return {
      action: "refuse",
      code: `docker_${input.docker.reason}`,
      message: input.docker.message,
    };
  }

  return { action: "start" };
}

export function decideLocalResetEnv(input: {
  env: Record<string, string | undefined>;
  envFile: { exists: boolean; contents?: string };
}): Record<string, string | undefined> {
  return applyParsedEnvFile({ ...input.envFile, required: false }, input.env);
}
