import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  assertGeneratedConfigMatchesTestIdentity,
  generateTestStackConfig,
  readTomlProjectId,
  readTomlSectionPort,
} from "../../../src/core/test-stack/config.ts";
import {
  fingerprintSources,
  copiedSqlFilesMatch,
} from "../../../src/core/test-stack/fingerprint.ts";
import {
  parseWorkspaceMarker,
  type TestWorkspaceMarker,
} from "../../../src/core/test-stack/guard.ts";
import {
  TEST_PROJECT_ID,
  TEST_WORKSPACE_KIND,
  TEST_WORKSPACE_VERSION,
} from "../../../src/core/test-stack/identity.ts";
import {
  testWorkspaceMarkerPath,
  testWorkspacePath,
  testWorkspaceSupabasePath,
} from "./paths.mts";

const SOURCE_SQL_DIRS = ["migrations", "seed", "tests"] as const;

export interface WorkspaceSyncResult {
  readonly workspacePath: string;
  readonly fingerprint: string;
  readonly rebuilt: boolean;
  readonly projectId: string;
}

function sourceSqlFiles(
  repoRoot: string,
): { relativePath: string; contents: string }[] {
  const files: { relativePath: string; contents: string }[] = [];
  for (const dir of SOURCE_SQL_DIRS) {
    const absolute = join(repoRoot, "supabase", dir);
    const names = readdirSync(absolute)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of names) {
      files.push({
        relativePath: `${dir}/${name}`,
        contents: readFileSync(join(absolute, name), "utf8"),
      });
    }
  }
  return files;
}

export function sourceFingerprint(repoRoot: string): string {
  const config = readFileSync(
    join(repoRoot, "supabase", "config.toml"),
    "utf8",
  );
  return fingerprintSources([
    { relativePath: "config.toml", contents: config },
    { relativePath: "test-identity.json", contents: TEST_PROJECT_ID },
    ...sourceSqlFiles(repoRoot),
  ]);
}

export function readWorkspaceMarker(
  repoRoot: string,
): TestWorkspaceMarker | null {
  try {
    const raw = JSON.parse(
      readFileSync(testWorkspaceMarkerPath(repoRoot), "utf8"),
    );
    return parseWorkspaceMarker(raw);
  } catch {
    return null;
  }
}

function copiedSqlFiles(
  repoRoot: string,
): { relativePath: string; contents: string }[] {
  const files: { relativePath: string; contents: string }[] = [];
  const supabaseDir = testWorkspaceSupabasePath(repoRoot);
  for (const dir of SOURCE_SQL_DIRS) {
    const absolute = join(supabaseDir, dir);
    let names: string[] = [];
    try {
      names = readdirSync(absolute).filter((name) => name.endsWith(".sql"));
    } catch {
      names = [];
    }
    for (const name of names) {
      files.push({
        relativePath: `${dir}/${name}`,
        contents: readFileSync(join(absolute, name), "utf8"),
      });
    }
  }
  return files;
}

export function workspaceFreshnessIssues(repoRoot: string): string[] {
  const marker = readWorkspaceMarker(repoRoot);
  if (marker === null) {
    return ["generated workspace marker is missing"];
  }
  const expected = sourceFingerprint(repoRoot);
  if (marker.sourceFingerprint !== expected) {
    return [
      "generated workspace is stale relative to repository migrations, seed or config",
    ];
  }

  const generatedConfig = readFileSync(
    join(testWorkspaceSupabasePath(repoRoot), "config.toml"),
    "utf8",
  );
  const configIssues =
    assertGeneratedConfigMatchesTestIdentity(generatedConfig);
  const copyIssues = copiedSqlFilesMatch(
    sourceSqlFiles(repoRoot),
    copiedSqlFiles(repoRoot),
  );
  return [...configIssues, ...copyIssues];
}

export function syncTestWorkspace(repoRoot: string): WorkspaceSyncResult {
  const fingerprint = sourceFingerprint(repoRoot);
  const workspacePath = testWorkspacePath(repoRoot);
  const existing = readWorkspaceMarker(repoRoot);
  const issues = existing ? workspaceFreshnessIssues(repoRoot) : ["missing"];
  if (existing && issues.length === 0) {
    return {
      workspacePath,
      fingerprint,
      rebuilt: false,
      projectId: TEST_PROJECT_ID,
    };
  }

  const sourceConfig = readFileSync(
    join(repoRoot, "supabase", "config.toml"),
    "utf8",
  );
  const generated = generateTestStackConfig(sourceConfig);
  const configIssues = assertGeneratedConfigMatchesTestIdentity(
    generated.contents,
  );
  if (configIssues.length > 0) {
    throw new Error(
      `failed to generate isolated test config:\n${configIssues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }

  mkdirSync(workspacePath, { recursive: true });
  const supabaseDir = testWorkspaceSupabasePath(repoRoot);
  mkdirSync(supabaseDir, { recursive: true });

  for (const dir of SOURCE_SQL_DIRS) {
    const targetDir = join(supabaseDir, dir);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    for (const file of sourceSqlFiles(repoRoot).filter((entry) =>
      entry.relativePath.startsWith(`${dir}/`),
    )) {
      const name = file.relativePath.slice(dir.length + 1);
      writeFileSync(join(targetDir, name), file.contents);
    }
  }

  writeFileSync(join(supabaseDir, "config.toml"), generated.contents);
  writeFileSync(
    testWorkspaceMarkerPath(repoRoot),
    `${JSON.stringify(
      {
        kind: TEST_WORKSPACE_KIND,
        version: TEST_WORKSPACE_VERSION,
        repoRoot,
        projectId: TEST_PROJECT_ID,
        sourceFingerprint: fingerprint,
        generatedAt: new Date().toISOString(),
      } satisfies TestWorkspaceMarker,
      null,
      2,
    )}\n`,
  );

  const copyIssues = copiedSqlFilesMatch(
    sourceSqlFiles(repoRoot),
    copiedSqlFiles(repoRoot),
  );
  if (copyIssues.length > 0) {
    throw new Error(
      `isolated test workspace copy check failed:\n${copyIssues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }

  return {
    workspacePath,
    fingerprint,
    rebuilt: true,
    projectId: TEST_PROJECT_ID,
  };
}

export function generatedWorkspaceIdentity(repoRoot: string): {
  projectId: string | null;
  apiPort: number | null;
  dbPort: number | null;
} {
  try {
    const contents = readFileSync(
      join(testWorkspaceSupabasePath(repoRoot), "config.toml"),
      "utf8",
    );
    return {
      projectId: readTomlProjectId(contents),
      apiPort: readTomlSectionPort(contents, "api", "port"),
      dbPort: readTomlSectionPort(contents, "db", "port"),
    };
  } catch {
    return { projectId: null, apiPort: null, dbPort: null };
  }
}
