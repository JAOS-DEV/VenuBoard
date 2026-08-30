import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@/core/env/schema";
import {
  DestructiveOperationBlockedError,
  assertDestructiveOperationAllowed,
  guardDestructiveOperation,
} from "@/core/env/production-guard";

describe("production guard for destructive operations", () => {
  it("blocks production", () => {
    expect(() => assertDestructiveOperationAllowed("db:reset", "production")) //
      .toThrow(DestructiveOperationBlockedError);
  });

  it("names the operation and environment in the error", () => {
    try {
      assertDestructiveOperationAllowed("db:reset", "production");
      expect.unreachable("the guard should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DestructiveOperationBlockedError);
      const blocked = error as DestructiveOperationBlockedError;
      expect(blocked.operation).toBe("db:reset");
      expect(blocked.environment).toBe("production");
      expect(blocked.message).toContain("db:reset");
      expect(blocked.message).toContain("production");
    }
  });

  it.each(["local", "test", "staging"] as const)(
    "allows %s, where the seed dataset is the only data",
    (environment) => {
      expect(() =>
        assertDestructiveOperationAllowed("db:reset", environment),
      ).not.toThrow();
    },
  );

  it("blocks when VENUBOARD_ENV is production in the passed environment", () => {
    expect(() =>
      guardDestructiveOperation("db:reset", {
        VENUBOARD_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
      }),
    ).toThrow(DestructiveOperationBlockedError);
  });

  it("fails closed when the environment cannot be determined", () => {
    // An unset identifier must not be optimistically treated as local.
    expect(() => guardDestructiveOperation("db:reset", {})).toThrow(
      EnvValidationError,
    );
    expect(() =>
      guardDestructiveOperation("db:reset", { VENUBOARD_ENV: "prod" }),
    ).toThrow(EnvValidationError);
  });

  it("returns the environment when the operation is permitted", () => {
    expect(
      guardDestructiveOperation("db:seed", { VENUBOARD_ENV: "local" }),
    ).toBe("local");
  });
});
