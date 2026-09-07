import { redactSecretLikeText } from "../dev/docker-preflight.ts";
import {
  DEVELOPMENT_STACK_PORTS,
  INHERITED_CONNECTION_ENV_KEYS,
  TEST_API_ORIGIN,
  TEST_STACK_PORTS,
} from "./identity.ts";

export interface IsolatedTestCredentials {
  readonly apiUrl: string;
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly dbHost: string;
  readonly dbPort: number;
  readonly studioUrl: string;
  readonly mailboxUrl: string;
}

export interface EnvConflict {
  readonly key: string;
  readonly reason: string;
}

const LOCAL_DEMO_KEY_RE =
  /^(eyJ|sb_publishable_|sb_secret_|super-secret-jwt-token)/;

export function parseSupabaseStatusEnv(output: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const equals = line.indexOf("=");
    if (equals <= 0) {
      continue;
    }
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function credentialsFromStatusEnv(
  statusEnv: Record<string, string>,
): IsolatedTestCredentials | { error: string } {
  const apiUrl = statusEnv.API_URL?.trim();
  const publishable =
    statusEnv.PUBLISHABLE_KEY?.trim() || statusEnv.ANON_KEY?.trim();
  const secret =
    statusEnv.SECRET_KEY?.trim() || statusEnv.SERVICE_ROLE_KEY?.trim();
  const dbUrl = statusEnv.DB_URL?.trim();
  const studioUrl = statusEnv.STUDIO_URL?.trim();
  const mailboxUrl =
    statusEnv.MAILPIT_URL?.trim() || statusEnv.INBUCKET_URL?.trim();

  if (apiUrl === undefined || apiUrl.length === 0) {
    return { error: "supabase status did not include API_URL" };
  }
  if (publishable === undefined || publishable.length === 0) {
    return {
      error: "supabase status did not include a publishable or anon key",
    };
  }
  if (secret === undefined || secret.length === 0) {
    return {
      error: "supabase status did not include a secret or service-role key",
    };
  }

  const db = parsePostgresUrl(dbUrl ?? "");
  if (db === null) {
    return {
      error: "supabase status did not include a usable DB_URL host/port",
    };
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    publishableKey: publishable,
    secretKey: secret,
    dbHost: db.host,
    dbPort: db.port,
    studioUrl: (studioUrl ?? "").replace(/\/$/, ""),
    mailboxUrl: (mailboxUrl ?? "").replace(/\/$/, ""),
  };
}

export function parsePostgresUrl(
  value: string,
): { host: string; port: number } | null {
  if (value.length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    const port = Number.parseInt(url.port, 10);
    if (url.hostname.length === 0 || !Number.isFinite(port)) {
      return null;
    }
    return { host: url.hostname, port };
  } catch {
    return null;
  }
}

export function findInheritedConnectionConflicts(
  env: Record<string, string | undefined>,
  credentials: IsolatedTestCredentials,
): EnvConflict[] {
  const conflicts: EnvConflict[] = [];
  for (const key of INHERITED_CONNECTION_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value === undefined || value.length === 0) {
      continue;
    }
    if (pointsAtDevelopmentStack(value)) {
      conflicts.push({
        key,
        reason: `points at the ordinary development stack (port ${String(DEVELOPMENT_STACK_PORTS.api)} or ${String(DEVELOPMENT_STACK_PORTS.db)})`,
      });
    }
  }

  if (credentials.apiUrl !== TEST_API_ORIGIN) {
    conflicts.push({
      key: "API_URL",
      reason: `isolated credentials must use ${TEST_API_ORIGIN}`,
    });
  }
  if (credentials.dbPort !== TEST_STACK_PORTS.db) {
    conflicts.push({
      key: "DB_URL",
      reason: `isolated database port must be ${String(TEST_STACK_PORTS.db)}`,
    });
  }

  return conflicts;
}

export function pointsAtDevelopmentStack(value: string): boolean {
  const ports = [
    DEVELOPMENT_STACK_PORTS.api,
    DEVELOPMENT_STACK_PORTS.db,
    DEVELOPMENT_STACK_PORTS.studio,
    DEVELOPMENT_STACK_PORTS.inbucket,
    DEVELOPMENT_STACK_PORTS.shadow,
    DEVELOPMENT_STACK_PORTS.analytics,
    DEVELOPMENT_STACK_PORTS.inspector,
  ];
  return ports.some((port) =>
    new RegExp(`(?:^|[\\s/:])${String(port)}(?:\\b|$)`).test(value),
  );
}

export function pointsAtTestStackApi(value: string): boolean {
  return (
    value.replace(/\/$/, "") === TEST_API_ORIGIN ||
    value.includes(`:${String(TEST_STACK_PORTS.api)}`)
  );
}

export function stripInheritedConnectionEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const next = { ...env };
  for (const key of INHERITED_CONNECTION_ENV_KEYS) {
    delete next[key];
  }
  return next;
}

export function applyIsolatedTestCredentials(
  env: Record<string, string | undefined>,
  credentials: IsolatedTestCredentials,
): Record<string, string | undefined> {
  const next = stripInheritedConnectionEnv(env);
  next.NEXT_PUBLIC_SUPABASE_URL = credentials.apiUrl;
  next.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = credentials.publishableKey;
  next.SUPABASE_SECRET_KEY = credentials.secretKey;
  return next;
}

export function assertIsolatedTestClients(
  env: Record<string, string | undefined>,
): string[] {
  const issues: string[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url !== TEST_API_ORIGIN) {
    issues.push(
      `NEXT_PUBLIC_SUPABASE_URL must be ${TEST_API_ORIGIN}, got ${url ?? "(unset)"}`,
    );
  }
  if (pointsAtDevelopmentStack(url ?? "")) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_URL still points at the development stack",
    );
  }
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  if (secret === undefined || secret.length === 0) {
    issues.push(
      "SUPABASE_SECRET_KEY is required for isolated server-side tests",
    );
  }
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable === undefined || publishable.length === 0) {
    issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
  }
  if (env.NEXT_PUBLIC_SUPABASE_SECRET_KEY !== undefined) {
    issues.push(
      "service-role secrets must never be exposed as NEXT_PUBLIC_ variables",
    );
  }
  return issues;
}

export function redactCredentialText(value: string): string {
  return redactSecretLikeText(value)
    .replace(
      /postgresql:\/\/([^:@/]+):([^@/]+)@/gi,
      "postgresql://$1:[redacted]@",
    )
    .replace(/postgres:\/\/([^:@/]+):([^@/]+)@/gi, "postgres://$1:[redacted]@")
    .replace(
      /\b(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|SECRET_KEY|PUBLISHABLE_KEY|S3_PROTOCOL_ACCESS_KEY_SECRET|S3_PROTOCOL_ACCESS_KEY_ID)\s*=\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(LOCAL_DEMO_KEY_RE, "[redacted]");
}

export function publicStatusLines(
  credentials: IsolatedTestCredentials,
): string[] {
  return [
    `API: ${credentials.apiUrl}`,
    `Studio: ${credentials.studioUrl || TEST_API_ORIGIN.replace(String(TEST_STACK_PORTS.api), String(TEST_STACK_PORTS.studio))}`,
    `Mailbox: ${credentials.mailboxUrl}`,
    `Postgres port: ${String(credentials.dbPort)}`,
  ];
}
