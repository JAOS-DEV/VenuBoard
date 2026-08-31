import { z } from "zod";

import { venuboardEnvironmentSchema } from "./environment.ts";

/**
 * Environment validation for VenuBoard.
 *
 * Two schemas, deliberately separate:
 *
 * - `serverEnvSchema` may reference secrets and is only ever parsed on the
 *   server (see `./server.ts`, which is poisoned against client bundles).
 * - `clientEnvSchema` covers the `NEXT_PUBLIC_*` values that Next.js inlines
 *   into browser bundles. It cannot contain a secret, and
 *   `assertNoSecretsExposedToBrowser` enforces that mechanically.
 *
 * Everything here is a pure function over a plain record so it can be unit
 * tested without mutating `process.env`.
 */

type RawEnv = Record<string, string | undefined>;

/**
 * Names that must never appear on a browser-exposed variable. The Supabase
 * secret key (formerly the service-role key) bypasses Row Level Security
 * entirely, so leaking it into a client bundle would defeat tenant isolation.
 */
const FORBIDDEN_PUBLIC_NAME_PATTERN =
  /(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|TOKEN|TEST_IDENTITY)/i;

/** Blank env values are treated as unset so `.env.example` copies can stay empty. */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalNonEmpty = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

/** Values that exist only so the scaffold runs; never valid in a real deployment. */
const PLACEHOLDER_PATTERN = /(replace[-_]?me|your[-_]|example\.com|changeme)/i;

const baseServerEnvShape = {
  VENUBOARD_ENV: venuboardEnvironmentSchema,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmpty,
  /** Public application origin for Auth callback and invitation links. */
  NEXT_PUBLIC_APP_ORIGIN: optionalUrl,
  /** Server-only. Bypasses RLS. Never referenced by browser code. */
  SUPABASE_SECRET_KEY: optionalNonEmpty,
  /**
   * Server-only Playwright seam. Must never be NEXT_PUBLIC_. Ignored unless
   * VENUBOARD_ENV is test and NODE_ENV is not production.
   */
  VENUBOARD_ENABLE_TEST_IDENTITY: optionalNonEmpty,
};

export const serverEnvSchema = z
  .object(baseServerEnvShape)
  .superRefine((env, ctx) => {
    if (
      env.VENUBOARD_ENABLE_TEST_IDENTITY !== undefined &&
      env.VENUBOARD_ENV !== "test"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["VENUBOARD_ENABLE_TEST_IDENTITY"],
        message:
          "VENUBOARD_ENABLE_TEST_IDENTITY is only valid when VENUBOARD_ENV is test",
      });
    }

    const isHosted =
      env.VENUBOARD_ENV === "staging" || env.VENUBOARD_ENV === "production";

    if (isHosted) {
      // A hosted environment with no Supabase connection would silently render
      // an empty application, so require the connection rather than defaulting.
      if (env.NEXT_PUBLIC_SUPABASE_URL === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SUPABASE_URL"],
          message: `NEXT_PUBLIC_SUPABASE_URL is required when VENUBOARD_ENV is "${env.VENUBOARD_ENV}"`,
        });
      }

      if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
          message: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required when VENUBOARD_ENV is "${env.VENUBOARD_ENV}"`,
        });
      }
    }

    if (env.VENUBOARD_ENV !== "production") {
      return;
    }

    // Production must not silently inherit a local or staging target.
    const url = env.NEXT_PUBLIC_SUPABASE_URL;

    if (url !== undefined && /(localhost|127\.0\.0\.1|\[::1\])/.test(url)) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message:
          "production may not point at a local Supabase instance — this looks like a local environment file leaking into production",
      });
    }

    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && PLACEHOLDER_PATTERN.test(value)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} still holds a placeholder value, which is never valid in production`,
        });
      }
    }
  });

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmpty,
  NEXT_PUBLIC_APP_ORIGIN: optionalUrl,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(scope: string, issues: readonly string[]) {
    super(
      [
        `Invalid ${scope} environment configuration:`,
        ...issues.map((issue) => `  - ${issue}`),
        "",
        "Copy .env.example to .env.local and set the values it describes.",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Rejects any browser-exposed variable whose *name* implies it carries a
 * secret. This is a structural guarantee rather than a code-review habit: a
 * `NEXT_PUBLIC_SUPABASE_SECRET_KEY` typo fails the boot instead of shipping.
 */
export function assertNoSecretsExposedToBrowser(raw: RawEnv): void {
  const offenders = Object.keys(raw)
    .filter((key) => key.startsWith("NEXT_PUBLIC_"))
    .filter((key) => FORBIDDEN_PUBLIC_NAME_PATTERN.test(key));

  if (offenders.length > 0) {
    throw new EnvValidationError(
      "browser",
      offenders.map(
        (key) =>
          `${key} is exposed to the browser but its name implies a secret — rename it without the NEXT_PUBLIC_ prefix`,
      ),
    );
  }
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  assertNoSecretsExposedToBrowser(raw);

  const result = serverEnvSchema.safeParse(raw);

  if (!result.success) {
    throw new EnvValidationError("server", formatIssues(result.error));
  }

  return result.data;
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  const result = clientEnvSchema.safeParse(raw);

  if (!result.success) {
    throw new EnvValidationError("browser", formatIssues(result.error));
  }

  return result.data;
}
