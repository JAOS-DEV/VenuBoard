import {
  TEST_AUTH_REDIRECT_URLS,
  TEST_AUTH_SITE_URL,
  TEST_PROJECT_ID,
  TEST_STACK_PORTS,
} from "./identity.ts";

const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const PROJECT_ID_RE = /^(\s*project_id\s*=\s*")([^"]*)("\s*)$/;
const ASSIGN_RE = /^(\s*)([A-Za-z0-9_]+)(\s*=\s*)(.*)$/;

export interface GeneratedTestConfig {
  readonly contents: string;
  readonly projectId: string;
  readonly ports: typeof TEST_STACK_PORTS;
  readonly siteUrl: string;
  readonly redirectUrls: readonly string[];
}

/**
 * Build the isolated-stack config from the repository `supabase/config.toml`.
 * Only a narrow allowlist of identity, port and Auth-callback values change.
 */
export function generateTestStackConfig(
  sourceToml: string,
): GeneratedTestConfig {
  const lines = sourceToml.split(/\r?\n/);
  const output: string[] = [];
  let section = "";
  let skippingRedirectArray = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (skippingRedirectArray) {
      if (line.includes("]")) {
        skippingRedirectArray = false;
      }
      continue;
    }

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      section = sectionMatch[1] ?? "";
      output.push(line);
      continue;
    }

    if (section === "" && PROJECT_ID_RE.test(line)) {
      output.push(line.replace(PROJECT_ID_RE, `$1${TEST_PROJECT_ID}$3`));
      continue;
    }

    if (/^\s*additional_redirect_urls\s*=/.test(line) && section === "auth") {
      output.push("additional_redirect_urls = [");
      for (const [redirectIndex, url] of TEST_AUTH_REDIRECT_URLS.entries()) {
        const suffix =
          redirectIndex === TEST_AUTH_REDIRECT_URLS.length - 1 ? "" : ",";
        output.push(`  "${url}"${suffix}`);
      }
      output.push("]");
      if (!line.includes("]")) {
        skippingRedirectArray = true;
      }
      continue;
    }

    const assigned = line.match(ASSIGN_RE);
    if (assigned && !line.trim().startsWith("#")) {
      const key = assigned[2] ?? "";
      const replacement = replacementFor(section, key);
      if (replacement !== null) {
        output.push(`${assigned[1]}${key}${assigned[3]}${replacement}`);
        continue;
      }
    }

    output.push(line);
  }

  return {
    contents: output.join("\n"),
    projectId: TEST_PROJECT_ID,
    ports: TEST_STACK_PORTS,
    siteUrl: TEST_AUTH_SITE_URL,
    redirectUrls: TEST_AUTH_REDIRECT_URLS,
  };
}

function replacementFor(section: string, key: string): string | null {
  if (section === "api" && key === "port") {
    return String(TEST_STACK_PORTS.api);
  }
  if (section === "db" && key === "port") {
    return String(TEST_STACK_PORTS.db);
  }
  if (section === "db" && key === "shadow_port") {
    return String(TEST_STACK_PORTS.shadow);
  }
  if (section === "db.pooler" && key === "port") {
    return String(TEST_STACK_PORTS.pooler);
  }
  if (section === "studio" && key === "port") {
    return String(TEST_STACK_PORTS.studio);
  }
  if (section === "studio" && key === "api_url") {
    return `"http://127.0.0.1"`;
  }
  if (section === "local_smtp" && key === "port") {
    return String(TEST_STACK_PORTS.inbucket);
  }
  if (section === "edge_runtime" && key === "inspector_port") {
    return String(TEST_STACK_PORTS.inspector);
  }
  if (section === "analytics" && key === "port") {
    return String(TEST_STACK_PORTS.analytics);
  }
  if (section === "auth" && key === "site_url") {
    return `"${TEST_AUTH_SITE_URL}"`;
  }
  return null;
}

export function readTomlProjectId(contents: string): string | null {
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) {
      continue;
    }
    const match = line.match(PROJECT_ID_RE);
    if (match) {
      return match[2] ?? null;
    }
  }
  return null;
}

export function readTomlSectionPort(
  contents: string,
  sectionName: string,
  key: string,
): number | null {
  let section = "";
  for (const line of contents.split(/\r?\n/)) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      section = sectionMatch[1] ?? "";
      continue;
    }
    if (section !== sectionName || line.trim().startsWith("#")) {
      continue;
    }
    const assigned = line.match(ASSIGN_RE);
    if (assigned && assigned[2] === key) {
      const raw = (assigned[4] ?? "").trim();
      const value = Number.parseInt(raw.replace(/["']/g, ""), 10);
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

export function assertGeneratedConfigMatchesTestIdentity(
  contents: string,
): string[] {
  const issues: string[] = [];
  const projectId = readTomlProjectId(contents);
  if (projectId !== TEST_PROJECT_ID) {
    issues.push(
      `generated config project_id is ${projectId ?? "(missing)"}, expected ${TEST_PROJECT_ID}`,
    );
  }

  const expected: Array<[string, string, number]> = [
    ["api", "port", TEST_STACK_PORTS.api],
    ["db", "port", TEST_STACK_PORTS.db],
    ["db", "shadow_port", TEST_STACK_PORTS.shadow],
    ["db.pooler", "port", TEST_STACK_PORTS.pooler],
    ["studio", "port", TEST_STACK_PORTS.studio],
    ["local_smtp", "port", TEST_STACK_PORTS.inbucket],
    ["edge_runtime", "inspector_port", TEST_STACK_PORTS.inspector],
    ["analytics", "port", TEST_STACK_PORTS.analytics],
  ];

  for (const [section, key, port] of expected) {
    const actual = readTomlSectionPort(contents, section, key);
    if (actual !== port) {
      issues.push(
        `${section}.${key} is ${String(actual)}, expected ${String(port)}`,
      );
    }
  }

  if (!contents.includes(`site_url = "${TEST_AUTH_SITE_URL}"`)) {
    issues.push(`auth.site_url must be ${TEST_AUTH_SITE_URL}`);
  }

  for (const url of TEST_AUTH_REDIRECT_URLS) {
    if (!contents.includes(`"${url}"`)) {
      issues.push(`missing Auth redirect ${url}`);
    }
  }

  const redirectBlock = contents.match(
    /additional_redirect_urls\s*=\s*\[[^\]]*\]/s,
  );
  if (redirectBlock && redirectBlock[0].includes("*")) {
    issues.push("generated Auth redirects must not use wildcards");
  }

  return issues;
}
