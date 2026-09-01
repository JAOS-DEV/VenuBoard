import { describe, expect, it } from "vitest";

import {
  invitationTokenLeaked,
  redactOnboardingSecrets,
} from "@/core/onboarding/redact";
import { parseOnboardingRpcResult } from "@/core/onboarding/result";

describe("redactOnboardingSecrets", () => {
  it("removes invitation tokens from objects and strings", () => {
    const token = "abc_secret_token_value";
    const redacted = redactOnboardingSecrets({
      invitation_token: token,
      nested: { invitationToken: token },
      message: `invitation_token=${token}`,
    }) as Record<string, unknown>;

    expect(redacted.invitation_token).toBe("[redacted]");
    expect(invitationTokenLeaked(redacted, token)).toBe(false);
  });
});

describe("parseOnboardingRpcResult", () => {
  it("keeps a one-time token only on first success", () => {
    expect(
      parseOnboardingRpcResult({
        ok: true,
        venue_id: "00000000-0000-4000-8000-000000000201",
        invitation_token: "once-only-token-value-xx",
        idempotent: false,
        publication_state: "draft",
      }),
    ).toMatchObject({
      ok: true,
      invitationToken: "once-only-token-value-xx",
      idempotent: false,
      publicationState: "draft",
    });

    expect(
      parseOnboardingRpcResult({
        ok: true,
        venue_id: "00000000-0000-4000-8000-000000000201",
        invitation_token: null,
        idempotent: true,
      }),
    ).toMatchObject({
      ok: true,
      invitationToken: undefined,
      idempotent: true,
    });
  });

  it("maps failures without copying unknown fields", () => {
    expect(
      parseOnboardingRpcResult({
        ok: false,
        code: "forbidden",
        invitation_token: "must-not-surface",
      }),
    ).toEqual({ ok: false, code: "forbidden" });

    expect(
      parseOnboardingRpcResult({
        ok: false,
        code: "unavailable",
        message: 'relation "venues" does not exist',
        details: "SQLERRM leak",
      }),
    ).toEqual({ ok: false, code: "unavailable" });
  });
});
