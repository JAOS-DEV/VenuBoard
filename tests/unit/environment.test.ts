import { describe, expect, it } from "vitest";

import {
  isLocalClass,
  isProduction,
  shouldShowEnvironmentBadge,
  venuboardEnvironmentSchema,
} from "@/core/env/environment";
import {
  EnvValidationError,
  assertNoSecretsExposedToBrowser,
  parseServerEnv,
} from "@/core/env/schema";

const HOSTED_SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
};

describe("environment identifier", () => {
  it("accepts the four known environments", () => {
    for (const environment of ["local", "staging", "production", "test"]) {
      expect(venuboardEnvironmentSchema.parse(environment)).toBe(environment);
    }
  });

  it.each(["", "Local", "prod", "dev", "PRODUCTION", "staging "])(
    "rejects %o as an environment identifier",
    (value) => {
      expect(venuboardEnvironmentSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects a missing identifier rather than defaulting to local", () => {
    expect(() => parseServerEnv({})).toThrow(EnvValidationError);
  });

  it("classifies local and test as local-class, hosted environments as not", () => {
    expect(isLocalClass("local")).toBe(true);
    expect(isLocalClass("test")).toBe(true);
    expect(isLocalClass("staging")).toBe(false);
    expect(isLocalClass("production")).toBe(false);
    expect(isProduction("production")).toBe(true);
    expect(isProduction("staging")).toBe(false);
  });

  it("shows the badge in local and staging only", () => {
    expect(shouldShowEnvironmentBadge("local")).toBe(true);
    expect(shouldShowEnvironmentBadge("staging")).toBe(true);
    expect(shouldShowEnvironmentBadge("production")).toBe(false);
    expect(shouldShowEnvironmentBadge("test")).toBe(false);
  });
});

describe("server environment validation", () => {
  it("allows local without any Supabase connection", () => {
    const env = parseServerEnv({ VENUBOARD_ENV: "local" });

    expect(env.VENUBOARD_ENV).toBe("local");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("treats empty placeholder strings as unset in local", () => {
    const env = parseServerEnv({
      VENUBOARD_ENV: "local",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "   ",
      SUPABASE_SECRET_KEY: "",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it.each(["staging", "production"])(
    "requires a Supabase connection in %s",
    (environment) => {
      expect(() => parseServerEnv({ VENUBOARD_ENV: environment })).toThrow(
        /NEXT_PUBLIC_SUPABASE_URL is required/,
      );
    },
  );

  it("accepts a fully configured production environment", () => {
    const env = parseServerEnv({
      VENUBOARD_ENV: "production",
      ...HOSTED_SUPABASE,
      SUPABASE_SECRET_KEY: "sb_secret_xyz789",
    });

    expect(env.VENUBOARD_ENV).toBe("production");
  });

  it("refuses to let production point at a local Supabase instance", () => {
    expect(() =>
      parseServerEnv({
        VENUBOARD_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
      }),
    ).toThrow(/may not point at a local Supabase instance/);
  });

  it("refuses placeholder values in production", () => {
    expect(() =>
      parseServerEnv({
        VENUBOARD_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://replace-me.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "REPLACE_ME",
      }),
    ).toThrow(/placeholder value/);
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      parseServerEnv({
        VENUBOARD_ENV: "local",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow(EnvValidationError);
  });
});

describe("browser exposure guard", () => {
  it("rejects a secret smuggled behind a NEXT_PUBLIC_ prefix", () => {
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_DB_PASSWORD",
      "NEXT_PUBLIC_ACCESS_TOKEN",
    ]) {
      expect(() => assertNoSecretsExposedToBrowser({ [key]: "value" })).toThrow(
        EnvValidationError,
      );
    }
  });

  it("allows the server-only secret key under its correct name", () => {
    expect(() =>
      assertNoSecretsExposedToBrowser({ SUPABASE_SECRET_KEY: "value" }),
    ).not.toThrow();
  });

  it("allows legitimate browser-exposed values", () => {
    expect(() =>
      assertNoSecretsExposedToBrowser(HOSTED_SUPABASE),
    ).not.toThrow();
  });

  it("blocks the whole server parse, not just the guard in isolation", () => {
    expect(() =>
      parseServerEnv({
        VENUBOARD_ENV: "local",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "leaked",
      }),
    ).toThrow(/implies a secret/);
  });
});
