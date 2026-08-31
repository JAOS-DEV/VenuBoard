import { describe, expect, it } from "vitest";

import {
  normalizeAuthError,
  normalizeInvitationAcceptCode,
} from "@/core/auth/errors";
import { registerFromInvitationSchema } from "@/core/auth/passwords";

describe("normalizeAuthError", () => {
  it("never distinguishes unknown user from wrong password", () => {
    expect(normalizeAuthError({ message: "Invalid login credentials" })).toBe(
      "auth_failed",
    );
    expect(normalizeAuthError({ message: "User not found" })).toBe(
      "auth_failed",
    );
    expect(normalizeAuthError({ message: "Email not confirmed" })).toBe(
      "auth_failed",
    );
    expect(
      normalizeAuthError({
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("auth_failed");
    expect(
      normalizeAuthError({ message: 'relation "users" does not exist' }),
    ).toBe("auth_failed");
  });

  it("maps rate limits and transport failures separately", () => {
    expect(normalizeAuthError({ message: "rate limit exceeded" })).toBe(
      "rate_limited",
    );
    expect(normalizeAuthError({ message: "Failed to fetch" })).toBe(
      "unavailable",
    );
  });
});

describe("normalizeInvitationAcceptCode", () => {
  it("keeps known invitation codes and collapses the rest", () => {
    expect(normalizeInvitationAcceptCode("email_mismatch")).toBe(
      "email_mismatch",
    );
    expect(normalizeInvitationAcceptCode("user_exists")).toBe(
      "invitation_unavailable",
    );
  });
});

describe("registerFromInvitationSchema", () => {
  it("accepts the local fixture token charset", () => {
    expect(
      registerFromInvitationSchema.safeParse({
        token: "local-invite-atlas-editor-v1",
        password: "password1",
      }).success,
    ).toBe(true);
  });

  it("rejects tokens that could be used as path payloads", () => {
    expect(
      registerFromInvitationSchema.safeParse({
        token: "../evil-token-value",
        password: "password1",
      }).success,
    ).toBe(false);
    expect(
      registerFromInvitationSchema.safeParse({
        token: "local invite atlas editor v1",
        password: "password1",
      }).success,
    ).toBe(false);
  });
});
