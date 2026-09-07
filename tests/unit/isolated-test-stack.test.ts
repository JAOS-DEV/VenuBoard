import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { forwardedCliArgs, rewriteSqlTestArg } from "@/core/test-stack/args";
import {
  assertGeneratedConfigMatchesTestIdentity,
  generateTestStackConfig,
  readTomlProjectId,
  readTomlSectionPort,
} from "@/core/test-stack/config";
import {
  applyIsolatedTestCredentials,
  assertIsolatedTestClients,
  credentialsFromStatusEnv,
  findInheritedConnectionConflicts,
  parseSupabaseStatusEnv,
  redactCredentialText,
  stripInheritedConnectionEnv,
} from "@/core/test-stack/env";
import {
  copiedSqlFilesMatch,
  fingerprintSources,
} from "@/core/test-stack/fingerprint";
import {
  assertSafeTestStackMutation,
  parseWorkspaceMarker,
  type TestWorkspaceMarker,
} from "@/core/test-stack/guard";
import {
  DEVELOPMENT_PROJECT_ID,
  TEST_API_ORIGIN,
  TEST_AUTH_REDIRECT_URLS,
  TEST_PROJECT_ID,
  TEST_STACK_PORTS,
  TEST_WORKSPACE_KIND,
} from "@/core/test-stack/identity";
import { createLock, decideLockAction } from "@/core/test-stack/lock";
import { classifyTestStackPorts } from "@/core/test-stack/ports";
import {
  decideTestStackStart,
  decideTestStackStop,
  stopAffectedDevelopment,
} from "@/core/test-stack/start-plan";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_CONFIG = readFileSync(
  join(REPO_ROOT, "supabase", "config.toml"),
  "utf8",
);

const SECRET_STATUS = `
API_URL="http://127.0.0.1:55321"
PUBLISHABLE_KEY="sb_publishable_test_value_not_real"
SECRET_KEY="sb_secret_test_value_not_real"
DB_URL="postgresql://postgres:super-secret-db-password@127.0.0.1:55322/postgres"
STUDIO_URL="http://127.0.0.1:55323"
MAILPIT_URL="http://127.0.0.1:55324"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
`;

const VALID_MARKER: TestWorkspaceMarker = {
  kind: TEST_WORKSPACE_KIND,
  version: 1,
  repoRoot: REPO_ROOT,
  projectId: TEST_PROJECT_ID,
  sourceFingerprint: "abc",
  generatedAt: "2026-09-06T00:00:00.000Z",
};

describe("isolated test config generation", () => {
  it("overrides only identity, ports and test Auth callbacks from the repository config", () => {
    const generated = generateTestStackConfig(SOURCE_CONFIG);
    expect(generated.projectId).toBe(TEST_PROJECT_ID);
    expect(readTomlProjectId(generated.contents)).toBe(TEST_PROJECT_ID);
    expect(readTomlSectionPort(generated.contents, "api", "port")).toBe(
      TEST_STACK_PORTS.api,
    );
    expect(readTomlSectionPort(generated.contents, "db", "port")).toBe(
      TEST_STACK_PORTS.db,
    );
    expect(readTomlSectionPort(generated.contents, "db", "shadow_port")).toBe(
      TEST_STACK_PORTS.shadow,
    );
    expect(readTomlSectionPort(generated.contents, "studio", "port")).toBe(
      TEST_STACK_PORTS.studio,
    );
    expect(readTomlSectionPort(generated.contents, "local_smtp", "port")).toBe(
      TEST_STACK_PORTS.inbucket,
    );
    expect(readTomlSectionPort(generated.contents, "analytics", "port")).toBe(
      TEST_STACK_PORTS.analytics,
    );
    expect(
      readTomlSectionPort(generated.contents, "edge_runtime", "inspector_port"),
    ).toBe(TEST_STACK_PORTS.inspector);
    expect(readTomlSectionPort(generated.contents, "db.pooler", "port")).toBe(
      TEST_STACK_PORTS.pooler,
    );
    expect(generated.contents).toContain(`site_url = "http://127.0.0.1:3100"`);
    for (const url of TEST_AUTH_REDIRECT_URLS) {
      expect(generated.contents).toContain(`"${url}"`);
    }
    expect(generated.contents).toContain("auto_expose_new_tables = false");
    expect(generated.contents).toContain("./seed/07_offers.sql");
    expect(
      assertGeneratedConfigMatchesTestIdentity(generated.contents),
    ).toEqual([]);
  });

  it("does not fall back to development ports", () => {
    const generated = generateTestStackConfig(SOURCE_CONFIG);
    expect(readTomlSectionPort(generated.contents, "api", "port")).not.toBe(
      54321,
    );
    expect(readTomlSectionPort(generated.contents, "db", "port")).not.toBe(
      54322,
    );
  });
});

describe("migration and seed fingerprinting", () => {
  it("changes when a source SQL file changes and detects copy drift", () => {
    const left = fingerprintSources([
      { relativePath: "migrations/a.sql", contents: "select 1;\n" },
      { relativePath: "seed/01.sql", contents: "select 2;\n" },
    ]);
    const right = fingerprintSources([
      { relativePath: "migrations/a.sql", contents: "select 1;\n" },
      { relativePath: "seed/01.sql", contents: "select 3;\n" },
    ]);
    expect(left).not.toBe(right);
    expect(
      copiedSqlFilesMatch(
        [{ relativePath: "seed/01.sql", contents: "select 2;\n" }],
        [{ relativePath: "seed/01.sql", contents: "select 2;\r\n" }],
      ),
    ).toEqual([]);
    expect(
      copiedSqlFilesMatch(
        [{ relativePath: "seed/01.sql", contents: "select 2;\n" }],
        [{ relativePath: "seed/01.sql", contents: "select 9;\n" }],
      ),
    ).toEqual(["copied seed/01.sql does not match the repository source"]);
  });
});

describe("Windows path argument forwarding", () => {
  it("keeps repo paths with spaces as argv tokens and rewrites SQL test paths", () => {
    const workdir = String.raw`C:\Users\James PC\Desktop\My Repos\VenuBoard\.tmp\venuboard-test`;
    const forwarded = forwardedCliArgs([
      "node",
      String.raw`C:\Users\James PC\Desktop\My Repos\VenuBoard\scripts\test-e2e.mts`,
      "--",
      "tests/e2e/offers.spec.ts",
      "--project=chromium",
    ]);
    expect(forwarded).toEqual([
      "tests/e2e/offers.spec.ts",
      "--project=chromium",
    ]);
    expect(
      rewriteSqlTestArg("supabase/tests/13_offers.sql", (...parts) =>
        [workdir, ...parts].join("\\"),
      ),
    ).toBe(
      String.raw`C:\Users\James PC\Desktop\My Repos\VenuBoard\.tmp\venuboard-test\supabase\tests\13_offers.sql`,
    );
  });
});

describe("port occupancy", () => {
  it("fails clearly when a test port belongs to an unrelated process", () => {
    const classifications = classifyTestStackPorts({
      listening: [{ port: TEST_STACK_PORTS.api, pids: [4242] }],
      dockerOwners: [],
    });
    const conflict = classifications.find(
      (entry) => entry.status === "conflict",
    );
    expect(conflict?.status).toBe("conflict");
    expect(conflict && "message" in conflict ? conflict.message : "").toContain(
      "will not kill it",
    );
  });

  it("treats verified venuboard-test containers as reusable", () => {
    const classifications = classifyTestStackPorts({
      listening: [{ port: TEST_STACK_PORTS.api, pids: [9] }],
      dockerOwners: [
        {
          containerName: "supabase_kong_venuboard-test",
          projectId: TEST_PROJECT_ID,
          hostPorts: [TEST_STACK_PORTS.api],
        },
      ],
    });
    expect(
      classifications.find((entry) => entry.port === TEST_STACK_PORTS.api),
    ).toEqual(expect.objectContaining({ status: "ours" }));
  });
});

describe("start and stop plans", () => {
  it("reuses an existing verified test stack and can start beside development", () => {
    const ours = classifyTestStackPorts({
      listening: [{ port: TEST_STACK_PORTS.api, pids: [1] }],
      dockerOwners: [
        {
          containerName: "supabase_kong_venuboard-test",
          projectId: TEST_PROJECT_ID,
          hostPorts: [TEST_STACK_PORTS.api],
        },
      ],
    });
    expect(
      decideTestStackStart({
        dockerOk: true,
        portClassifications: ours,
        runningProjectIds: [DEVELOPMENT_PROJECT_ID, TEST_PROJECT_ID],
      }),
    ).toEqual({ action: "reuse" });
    expect(
      decideTestStackStart({
        dockerOk: true,
        portClassifications: classifyTestStackPorts({
          listening: [],
          dockerOwners: [],
        }),
        runningProjectIds: [DEVELOPMENT_PROJECT_ID],
      }),
    ).toEqual({ action: "start" });
  });

  it("refuses when Docker is missing or the engine is stopped", () => {
    expect(
      decideTestStackStart({
        dockerOk: false,
        dockerMessage: "Docker CLI was not found. Install Docker Desktop.",
        portClassifications: [],
        runningProjectIds: [],
      }).action,
    ).toBe("refuse");
    expect(
      decideTestStackStart({
        dockerOk: false,
        dockerMessage: "Docker Desktop's Linux engine is not running.",
        portClassifications: [],
        runningProjectIds: [],
      }),
    ).toMatchObject({ action: "refuse" });
  });

  it("stops only the test project identity", () => {
    expect(
      decideTestStackStop({
        runningProjectIds: [DEVELOPMENT_PROJECT_ID, TEST_PROJECT_ID],
      }),
    ).toEqual({ action: "stop" });
    expect(
      stopAffectedDevelopment(
        [DEVELOPMENT_PROJECT_ID, TEST_PROJECT_ID],
        [DEVELOPMENT_PROJECT_ID],
      ),
    ).toBe(false);
    expect(
      stopAffectedDevelopment(
        [DEVELOPMENT_PROJECT_ID, TEST_PROJECT_ID],
        [TEST_PROJECT_ID],
      ),
    ).toBe(true);
  });
});

describe("destructive guards", () => {
  it("rejects hosted refs, the development project, and the wrong workspace", () => {
    expect(
      assertSafeTestStackMutation({
        operation: "test:stack:reset",
        repoRoot: REPO_ROOT,
        workspacePath: join(REPO_ROOT, ".tmp", "venuboard-test"),
        marker: VALID_MARKER,
        generatedProjectId: DEVELOPMENT_PROJECT_ID,
        generatedApiPort: TEST_STACK_PORTS.api,
        generatedDbPort: TEST_STACK_PORTS.db,
        hostedRefPaths: [],
        runningProjectIds: [],
        volumeNames: [],
      }).ok,
    ).toBe(false);

    expect(
      assertSafeTestStackMutation({
        operation: "test:stack:reset",
        repoRoot: REPO_ROOT,
        workspacePath: join(REPO_ROOT, ".tmp", "venuboard-test"),
        marker: VALID_MARKER,
        generatedProjectId: TEST_PROJECT_ID,
        generatedApiPort: TEST_STACK_PORTS.api,
        generatedDbPort: TEST_STACK_PORTS.db,
        hostedRefPaths: [join(REPO_ROOT, ".supabase", "project-ref")],
        runningProjectIds: [TEST_PROJECT_ID],
        volumeNames: ["supabase_db_venuboard-test"],
      }),
    ).toMatchObject({ ok: false });

    expect(
      assertSafeTestStackMutation({
        operation: "test:stack:reset",
        repoRoot: REPO_ROOT,
        workspacePath: join(REPO_ROOT, "somewhere-else"),
        marker: VALID_MARKER,
        generatedProjectId: TEST_PROJECT_ID,
        generatedApiPort: TEST_STACK_PORTS.api,
        generatedDbPort: TEST_STACK_PORTS.db,
        hostedRefPaths: [],
        runningProjectIds: [TEST_PROJECT_ID],
        volumeNames: ["supabase_db_venuboard-test"],
      }).ok,
    ).toBe(false);

    expect(
      assertSafeTestStackMutation({
        operation: "test:stack:reset",
        repoRoot: REPO_ROOT,
        workspacePath: join(REPO_ROOT, ".tmp", "venuboard-test"),
        marker: VALID_MARKER,
        generatedProjectId: TEST_PROJECT_ID,
        generatedApiPort: TEST_STACK_PORTS.api,
        generatedDbPort: TEST_STACK_PORTS.db,
        hostedRefPaths: [],
        runningProjectIds: [TEST_PROJECT_ID],
        volumeNames: ["supabase_db_venuboard-test"],
        requestedProjectId: DEVELOPMENT_PROJECT_ID,
      }).ok,
    ).toBe(false);
  });

  it("accepts a verified isolated workspace", () => {
    expect(
      assertSafeTestStackMutation({
        operation: "test:stack:reset",
        repoRoot: REPO_ROOT,
        workspacePath: join(REPO_ROOT, ".tmp", "venuboard-test"),
        marker: parseWorkspaceMarker(VALID_MARKER),
        generatedProjectId: TEST_PROJECT_ID,
        generatedApiPort: TEST_STACK_PORTS.api,
        generatedDbPort: TEST_STACK_PORTS.db,
        hostedRefPaths: [],
        runningProjectIds: [TEST_PROJECT_ID],
        volumeNames: ["supabase_db_venuboard-test"],
      }),
    ).toEqual({ ok: true });
  });
});

describe("credential isolation", () => {
  it("maps CLI status env and rejects development leftovers", () => {
    const credentials = credentialsFromStatusEnv(
      parseSupabaseStatusEnv(SECRET_STATUS),
    );
    expect("error" in credentials).toBe(false);
    if ("error" in credentials) {
      return;
    }
    expect(credentials.apiUrl).toBe(TEST_API_ORIGIN);
    expect(credentials.dbPort).toBe(TEST_STACK_PORTS.db);
    const inherited = {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SECRET_KEY: "from-env-local",
    };
    expect(
      findInheritedConnectionConflicts(inherited, credentials).length,
    ).toBeGreaterThan(0);
    const isolated = applyIsolatedTestCredentials(inherited, credentials);
    expect(isolated.NEXT_PUBLIC_SUPABASE_URL).toBe(TEST_API_ORIGIN);
    expect(isolated.SUPABASE_SECRET_KEY).toBe(credentials.secretKey);
    expect(assertIsolatedTestClients(isolated)).toEqual([]);
    expect(
      stripInheritedConnectionEnv(inherited).NEXT_PUBLIC_SUPABASE_URL,
    ).toBeUndefined();
  });

  it("redacts keys, tokens and password-bearing URLs", () => {
    const redacted = redactCredentialText(SECRET_STATUS);
    expect(redacted).not.toContain("super-secret-db-password");
    expect(redacted).not.toContain("sb_secret_test_value_not_real");
    expect(redacted).not.toContain("sb_publishable_test_value_not_real");
    expect(redacted).toContain("[redacted]");
  });
});

describe("locks", () => {
  it("does not steal an active lock and replaces a stale one", () => {
    const lock = createLock({
      pid: 111,
      command: "test:verify",
      repoRoot: REPO_ROOT,
    });
    expect(
      decideLockAction({
        existing: lock,
        currentPid: 222,
        isPidAlive: () => true,
      }).action,
    ).toBe("reject");
    expect(
      decideLockAction({
        existing: lock,
        currentPid: 222,
        isPidAlive: () => false,
      }).action,
    ).toBe("replace-stale");
    expect(
      decideLockAction({
        existing: lock,
        currentPid: 333,
        inheritedHolderPid: 111,
        isPidAlive: () => true,
      }).action,
    ).toBe("reenter");
  });
});

describe("test:verify documentation", () => {
  it("states that the command is not the format/lint/typecheck/unit/build gate", () => {
    const script = readFileSync(
      join(REPO_ROOT, "scripts", "test-verify.mts"),
      "utf8",
    );
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const packageJson = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(script).toContain(
      "This does not run format, lint, typecheck, Vitest",
    );
    expect(script).toContain("Those remain `npm run verify`");
    expect(readme).toContain("Not lint/Vitest/build");
    expect(packageJson.scripts["test:verify"]).toBe(
      "node scripts/test-verify.mts",
    );
    expect(packageJson.scripts.verify).toContain("lint");
    expect(packageJson.scripts.verify).toContain("test:ci");
    expect(packageJson.scripts.verify).not.toContain("test:verify");
  });
});
