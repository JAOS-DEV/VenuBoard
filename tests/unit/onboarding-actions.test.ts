import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANONYMOUS_ACTOR,
  inactiveMfa,
  type AuthenticatedActor,
} from "@/core/actors/types";
import type { RoleActionGrant } from "@/core/authz/grants";
import { createOnboardingDraft } from "@/core/onboarding/wizard-state";

vi.mock("@/core/actors/resolve", () => ({
  resolveRequestActor: vi.fn(),
}));

vi.mock("@/core/db/connection", () => ({
  getSupabaseConnection: vi.fn(() => ({
    url: "http://127.0.0.1:54321",
    publishableKey: "test-publishable",
  })),
}));

vi.mock("@/core/db/server-client", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const grants: RoleActionGrant[] = [
  {
    roleKey: "platform_admin",
    actionKey: "manage_platform_tenants",
    grantKind: "allow",
  },
];

function platformActor(
  role: "platform_admin" | "platform_support",
): AuthenticatedActor {
  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "platform.admin@example.com",
    displayName: "Platform Admin",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: role,
    businessMemberships: [],
    venueMemberships: [],
    currentBusinessId: null,
    currentVenueId: null,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants:
      role === "platform_admin"
        ? grants
        : [
            {
              roleKey: "platform_support",
              actionKey: "view_audit_log",
              grantKind: "allow",
            },
          ],
  };
}

describe("submitPlatformOnboarding authorisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies anonymous and platform support before calling the RPC", async () => {
    const { resolveRequestActor } = await import("@/core/actors/resolve");
    const { createSupabaseServerClient } =
      await import("@/core/db/server-client");
    const rpc = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc,
    } as never);

    vi.mocked(resolveRequestActor).mockResolvedValue(ANONYMOUS_ACTOR);
    const { submitPlatformOnboarding } =
      await import("@/core/onboarding/actions");
    expect(await submitPlatformOnboarding({})).toEqual({
      ok: false,
      code: "forbidden",
    });

    vi.mocked(resolveRequestActor).mockResolvedValue(
      platformActor("platform_support"),
    );
    expect(await submitPlatformOnboarding({})).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not forward database error text from the RPC", async () => {
    const { resolveRequestActor } = await import("@/core/actors/resolve");
    const { createSupabaseServerClient } =
      await import("@/core/db/server-client");
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'relation "venues" does not exist',
        code: "42P01",
        details: "Failed query: SELECT * FROM venues",
        hint: "check search_path",
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc,
    } as never);
    vi.mocked(resolveRequestActor).mockResolvedValue(
      platformActor("platform_admin"),
    );

    const draft = createOnboardingDraft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
    draft.business.name = "Lotus Pier Holdings";
    draft.business.legalName = "Lotus Pier Holdings Co., Ltd.";
    draft.venue.nameEn = "Lotus Pier";
    draft.venue.slug = "lotus-pier";
    draft.venue.contentClassification = "general";
    draft.owner.email = "new.owner@example.com";

    const { submitPlatformOnboarding } =
      await import("@/core/onboarding/actions");
    const result = await submitPlatformOnboarding(draft);
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("relation");
    expect(JSON.stringify(result)).not.toContain("venues");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
