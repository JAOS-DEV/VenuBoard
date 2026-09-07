/**
 * Isolated automated-test stack identity.
 *
 * Ordinary local development remains project `venuboard` on ports 54320–54327
 * and the app at http://localhost:3000. Automated database and browser tests
 * use a separate Docker/Supabase project and a generated workspace.
 */

export const DEVELOPMENT_PROJECT_ID = "venuboard";
export const TEST_PROJECT_ID = "venuboard-test";

export const TEST_WORKSPACE_KIND = "venuboard-isolated-test-workspace";
export const TEST_WORKSPACE_VERSION = 1;
export const TEST_WORKSPACE_RELATIVE_DIR = ".tmp/venuboard-test";
export const TEST_LOCK_RELATIVE_PATH = ".tmp/venuboard-test.lock";
export const TEST_WORKSPACE_MARKER_NAME = ".venuboard-test-workspace.json";
export const TEST_STACK_READY_ENV = "VENUBOARD_TEST_STACK_READY";

export const DEVELOPMENT_STACK_PORTS = {
  api: 54321,
  db: 54322,
  shadow: 54320,
  studio: 54323,
  inbucket: 54324,
  analytics: 54327,
  inspector: 8083,
  pooler: 54329,
} as const;

/** Fixed ports for the isolated test stack. Never fall back to development ports. */
export const TEST_STACK_PORTS = {
  api: 55321,
  db: 55322,
  shadow: 55320,
  studio: 55323,
  inbucket: 55324,
  analytics: 55327,
  inspector: 8183,
  pooler: 55329,
} as const;

export const TEST_APP_PORTS = {
  playwright: 3100,
  playwrightLocalDev: 3101,
} as const;

export type TestStackPortName = keyof typeof TEST_STACK_PORTS;

export const TEST_STACK_PORT_NAMES = Object.keys(
  TEST_STACK_PORTS,
) as TestStackPortName[];

export const TEST_API_ORIGIN = `http://127.0.0.1:${String(TEST_STACK_PORTS.api)}`;
export const TEST_STUDIO_ORIGIN = `http://127.0.0.1:${String(TEST_STACK_PORTS.studio)}`;
export const TEST_MAILBOX_ORIGIN = `http://127.0.0.1:${String(TEST_STACK_PORTS.inbucket)}`;
export const TEST_AUTH_HEALTH_URL = `${TEST_API_ORIGIN}/auth/v1/health`;
export const TEST_PLAYWRIGHT_ORIGIN = `http://127.0.0.1:${String(TEST_APP_PORTS.playwright)}`;
export const TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN = `http://127.0.0.1:${String(TEST_APP_PORTS.playwrightLocalDev)}`;

export const TEST_AUTH_SITE_URL = TEST_PLAYWRIGHT_ORIGIN;

export const TEST_AUTH_REDIRECT_URLS = [
  `${TEST_PLAYWRIGHT_ORIGIN}/en/auth/callback`,
  `${TEST_PLAYWRIGHT_ORIGIN}/th/auth/callback`,
  `${TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN}/en/auth/callback`,
  `${TEST_PLAYWRIGHT_LOCAL_DEV_ORIGIN}/th/auth/callback`,
] as const;

/** Connection-related names that must not leak in from `.env.local` or the shell. */
export const INHERITED_CONNECTION_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
] as const;

export const HOSTED_PROJECT_REF_RELATIVE_PATH = ".supabase/project-ref";

export function testStackDockerNameSuffix(
  projectId: string = TEST_PROJECT_ID,
): string {
  return `_${projectId}`;
}

export function isDevelopmentProjectId(projectId: string): boolean {
  return projectId === DEVELOPMENT_PROJECT_ID;
}

export function isTestProjectId(projectId: string): boolean {
  return projectId === TEST_PROJECT_ID;
}
