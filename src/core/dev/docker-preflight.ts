export const DOCKER_CLI_MISSING_MESSAGE =
  "Docker CLI was not found. Install Docker Desktop, open it, wait until `docker version` shows both Client and Server, then rerun `npm run local:start`.";

export const DOCKER_ENGINE_UNAVAILABLE_MESSAGE =
  "Docker Desktop's Linux engine is not running. Open Docker Desktop, wait until `docker version` shows both Client and Server, then rerun `npm run local:start`.";

export type DockerPreflightResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cli_missing" | "engine_unavailable" | "unexpected";
      message: string;
    };

const CLI_MISSING =
  /not recognized as an internal or external command|command not found|ENOENT/i;

const ENGINE_UNAVAILABLE =
  /dockerDesktopLinuxEngine|\/\/\.\/pipe\/|npipe:\/\/|Cannot connect to the Docker daemon|Is the docker daemon running|error during connect|failed to connect to the docker API/i;

export function classifyDockerVersionResult(input: {
  errorCode?: string;
  status: number | null;
  stdout: string;
  stderr: string;
}): DockerPreflightResult {
  const combined = `${input.stdout}\n${input.stderr}`;

  if (input.errorCode === "ENOENT" || CLI_MISSING.test(combined)) {
    return {
      ok: false,
      reason: "cli_missing",
      message: DOCKER_CLI_MISSING_MESSAGE,
    };
  }

  if (input.status === 0) {
    return { ok: true };
  }

  if (ENGINE_UNAVAILABLE.test(combined)) {
    return {
      ok: false,
      reason: "engine_unavailable",
      message: DOCKER_ENGINE_UNAVAILABLE_MESSAGE,
    };
  }

  const detail = redactSecretLikeText(combined).trim().slice(0, 400);
  return {
    ok: false,
    reason: "unexpected",
    message:
      detail.length > 0
        ? `Docker could not be reached:\n${detail}`
        : "Docker could not be reached.",
  };
}

export function redactSecretLikeText(value: string): string {
  return value
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(
      /\b(sb_secret|sb_publishable|service_role|SUPABASE_SECRET_KEY)[^\s]*/gi,
      "[redacted]",
    )
    .replace(
      /\b([A-Z0-9_]*(SECRET|PASSWORD|TOKEN|KEY)[A-Z0-9_]*)\s*=\s*\S+/gi,
      "$1=[redacted]",
    );
}
