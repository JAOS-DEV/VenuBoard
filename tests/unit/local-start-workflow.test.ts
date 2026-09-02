import { describe, expect, it } from "vitest";

import {
  classifyDockerVersionResult,
  DOCKER_CLI_MISSING_MESSAGE,
  DOCKER_ENGINE_UNAVAILABLE_MESSAGE,
  redactSecretLikeText,
} from "@/core/dev/docker-preflight";
import {
  applyParsedEnvFile,
  MISSING_LOCAL_ENV_FILE_MESSAGE,
  parseDotEnvContents,
} from "@/core/dev/local-env-file";
import {
  decideLocalResetEnv,
  decideLocalStart,
} from "@/core/dev/local-start-plan";
import { guardDestructiveOperation } from "@/core/env/production-guard";
import { EnvValidationError } from "@/core/env/schema";

const SECRET_VALUE = "super-secret-value-do-not-print";
const PUBLISHABLE_VALUE = "sb_publishable_should_not_print";

const LOCAL_FILE = {
  exists: true as const,
  required: true as const,
  contents: [
    "VENUBOARD_ENV=local",
    `SUPABASE_SECRET_KEY=${SECRET_VALUE}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_VALUE}`,
  ].join("\n"),
};

function expectNoSecrets(message: string): void {
  expect(message).not.toContain(SECRET_VALUE);
  expect(message).not.toContain(PUBLISHABLE_VALUE);
  expect(message).not.toContain("eyJhbGciOi");
}

describe("parseDotEnvContents", () => {
  it("reads assignments, comments and quoted values without expanding commands", () => {
    const parsed = parseDotEnvContents(`
# comment
VENUBOARD_ENV=local
export QUOTED="value with spaces"
COMMAND=$(whoami)
UNQUOTED=plain # trailing comment
`);

    expect(parsed.VENUBOARD_ENV).toBe("local");
    expect(parsed.QUOTED).toBe("value with spaces");
    expect(parsed.COMMAND).toBe("$(whoami)");
    expect(parsed.UNQUOTED).toBe("plain");
  });
});

describe("applyParsedEnvFile", () => {
  it("loads .env.local values when the process environment is unset", () => {
    const merged = applyParsedEnvFile(LOCAL_FILE, {});
    expect(merged.VENUBOARD_ENV).toBe("local");
  });

  it("does not require a PowerShell export when the file supplies VENUBOARD_ENV", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: LOCAL_FILE,
      hostedProjectLinked: false,
      docker: { ok: true },
    });
    expect(decision).toEqual({ action: "start" });
  });

  it("keeps process-level overrides", () => {
    const merged = applyParsedEnvFile(LOCAL_FILE, {
      VENUBOARD_ENV: "staging",
    });
    expect(merged.VENUBOARD_ENV).toBe("staging");
  });

  it("throws an actionable error when the required file is missing", () => {
    expect(() =>
      applyParsedEnvFile({ exists: false, required: true }, {}),
    ).toThrow(MISSING_LOCAL_ENV_FILE_MESSAGE);
  });

  it("leaves the environment unchanged when an optional file is missing", () => {
    expect(
      applyParsedEnvFile(
        { exists: false, required: false },
        { VENUBOARD_ENV: "local" },
      ),
    ).toEqual({ VENUBOARD_ENV: "local" });
  });
});

describe("decideLocalStart", () => {
  it("refuses a missing environment file", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: { exists: false },
      hostedProjectLinked: false,
      docker: { ok: true },
    });
    expect(decision.action).toBe("refuse");
    if (decision.action === "refuse") {
      expect(decision.code).toBe("missing_env_file");
      expect(decision.message).toContain(".env.example");
      expectNoSecrets(decision.message);
    }
  });

  it.each(["", "   ", "nope", "LOCAL"])(
    "fails closed for empty or invalid VENUBOARD_ENV %o",
    (value) => {
      const decision = decideLocalStart({
        env: { VENUBOARD_ENV: value },
        envFile: LOCAL_FILE,
        hostedProjectLinked: false,
        docker: { ok: true },
      });
      expect(decision.action).toBe("refuse");
      if (decision.action === "refuse") {
        expect(decision.message).toContain("VENUBOARD_ENV must be");
        expectNoSecrets(decision.message);
      }
    },
  );

  it("fails closed when .env.local has an empty VENUBOARD_ENV", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: { exists: true, contents: "VENUBOARD_ENV=\n" },
      hostedProjectLinked: false,
      docker: { ok: true },
    });
    expect(decision.action).toBe("refuse");
    if (decision.action === "refuse") {
      expect(decision.code).toBe("unset_env");
      expect(decision.message).toContain("VENUBOARD_ENV must be");
      expectNoSecrets(decision.message);
    }
  });

  it.each(["staging", "production", "test"])(
    "refuses to start the local stack when VENUBOARD_ENV is %s",
    (environment) => {
      const decision = decideLocalStart({
        env: { VENUBOARD_ENV: environment },
        envFile: LOCAL_FILE,
        hostedProjectLinked: false,
        docker: { ok: true },
      });
      expect(decision).toMatchObject({
        action: "refuse",
        code: "not_local",
      });
    },
  );

  it("refuses NODE_ENV=production", () => {
    const decision = decideLocalStart({
      env: { NODE_ENV: "production" },
      envFile: LOCAL_FILE,
      hostedProjectLinked: false,
      docker: { ok: true },
    });
    expect(decision).toEqual({
      action: "refuse",
      code: "production_node",
      message: "NODE_ENV is production.",
    });
  });

  it("keeps the hosted-project guard active", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: LOCAL_FILE,
      hostedProjectLinked: true,
      docker: { ok: true },
    });
    expect(decision.action).toBe("refuse");
    if (decision.action === "refuse") {
      expect(decision.code).toBe("hosted_project");
      expect(decision.message).toContain("project-ref");
    }
  });

  it("does not start Supabase when Docker CLI is missing", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: LOCAL_FILE,
      hostedProjectLinked: false,
      docker: {
        ok: false,
        reason: "cli_missing",
        message: DOCKER_CLI_MISSING_MESSAGE,
      },
    });
    expect(decision).toEqual({
      action: "refuse",
      code: "docker_cli_missing",
      message: DOCKER_CLI_MISSING_MESSAGE,
    });
  });

  it("does not start Supabase when the Docker engine is unavailable", () => {
    const decision = decideLocalStart({
      env: {},
      envFile: LOCAL_FILE,
      hostedProjectLinked: false,
      docker: {
        ok: false,
        reason: "engine_unavailable",
        message: DOCKER_ENGINE_UNAVAILABLE_MESSAGE,
      },
    });
    expect(decision).toEqual({
      action: "refuse",
      code: "docker_engine_unavailable",
      message: DOCKER_ENGINE_UNAVAILABLE_MESSAGE,
    });
  });
});

describe("classifyDockerVersionResult", () => {
  it("reports a missing Docker CLI", () => {
    expect(
      classifyDockerVersionResult({
        errorCode: "ENOENT",
        status: null,
        stdout: "",
        stderr: "",
      }),
    ).toEqual({
      ok: false,
      reason: "cli_missing",
      message: DOCKER_CLI_MISSING_MESSAGE,
    });

    expect(
      classifyDockerVersionResult({
        status: 1,
        stdout: "",
        stderr: "'docker' is not recognized as an internal or external command",
      }),
    ).toEqual({
      ok: false,
      reason: "cli_missing",
      message: DOCKER_CLI_MISSING_MESSAGE,
    });
  });

  it("reports an unreachable Linux engine, including the Windows named-pipe error", () => {
    const result = classifyDockerVersionResult({
      status: 1,
      stdout: "",
      stderr:
        'error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.',
    });
    expect(result).toEqual({
      ok: false,
      reason: "engine_unavailable",
      message: DOCKER_ENGINE_UNAVAILABLE_MESSAGE,
    });
  });

  it("does not hide an unexpected Docker error, and redacts secret-like text", () => {
    const result = classifyDockerVersionResult({
      status: 1,
      stdout: "",
      stderr: `unexpected docker failure SUPABASE_SECRET_KEY=${SECRET_VALUE}`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unexpected");
      expect(result.message).toContain("unexpected docker failure");
      expectNoSecrets(result.message);
    }
  });
});

describe("redactSecretLikeText", () => {
  it("removes keys and tokens from text that might be logged", () => {
    expectNoSecrets(
      redactSecretLikeText(
        `SUPABASE_SECRET_KEY=${SECRET_VALUE} ${PUBLISHABLE_VALUE} eyJhbGciOiJIUzI1NiJ9.abc`,
      ),
    );
  });
});

describe("local:reset environment loading", () => {
  it("loads .env.local when present and still blocks production", () => {
    const env = decideLocalResetEnv({
      env: {},
      envFile: LOCAL_FILE,
    });
    expect(env.VENUBOARD_ENV).toBe("local");
    expect(guardDestructiveOperation("db:reset", env)).toBe("local");

    const productionEnv = decideLocalResetEnv({
      env: {
        VENUBOARD_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
      },
      envFile: LOCAL_FILE,
    });
    expect(() => guardDestructiveOperation("db:reset", productionEnv)).toThrow(
      /production/,
    );
  });

  it("works with an explicit CI environment and no .env.local", () => {
    const env = decideLocalResetEnv({
      env: { VENUBOARD_ENV: "local" },
      envFile: { exists: false },
    });
    expect(guardDestructiveOperation("db:reset", env)).toBe("local");
  });

  it("fails closed when CI omits VENUBOARD_ENV and there is no .env.local", () => {
    const env = decideLocalResetEnv({
      env: {},
      envFile: { exists: false },
    });
    expect(() => guardDestructiveOperation("db:reset", env)).toThrow(
      EnvValidationError,
    );
  });
});
