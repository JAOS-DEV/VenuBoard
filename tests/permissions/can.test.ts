import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ACTOR,
  inactiveMfa,
  isActiveAuthenticatedActor,
  type AuthenticatedActor,
} from "@/core/actors/types";
import { PERMISSION_ACTIONS, isPermissionAction } from "@/core/authz/actions";
import { can, canAccessPlatform, canAccessVenueAdmin } from "@/core/authz/can";
import type { RoleActionGrant } from "@/core/authz/grants";

const NIGHT_ORCHID = "00000000-0000-4000-8000-000000000201";
const ATLAS_BIZ = "00000000-0000-4000-8000-000000000200";
const HARBOR = "00000000-0000-4000-8000-000000000101";
const HARBOR_BIZ = "00000000-0000-4000-8000-000000000100";

const GRANTS: RoleActionGrant[] = [
  { roleKey: "business_owner", actionKey: "manage_venue", grantKind: "allow" },
  { roleKey: "business_owner", actionKey: "invite_users", grantKind: "allow" },
  {
    roleKey: "content_editor",
    actionKey: "create_content",
    grantKind: "allow",
  },
  {
    roleKey: "content_editor",
    actionKey: "publish_content",
    grantKind: "conditional",
  },
  {
    roleKey: "staff",
    actionKey: "create_content",
    grantKind: "conditional",
  },
  {
    roleKey: "venue_manager",
    actionKey: "assign_roles",
    grantKind: "conditional",
  },
  {
    roleKey: "venue_manager",
    actionKey: "invite_users",
    grantKind: "conditional",
  },
  {
    roleKey: "platform_admin",
    actionKey: "manage_platform_tenants",
    grantKind: "allow",
  },
  {
    roleKey: "platform_admin",
    actionKey: "moderate_content",
    grantKind: "allow",
  },
  {
    roleKey: "platform_admin",
    actionKey: "manage_venue",
    grantKind: "conditional",
  },
  {
    roleKey: "platform_support",
    actionKey: "start_support_session",
    grantKind: "allow",
  },
  {
    roleKey: "platform_support",
    actionKey: "moderate_content",
    grantKind: "deny",
  },
];

function actor(
  overrides: Partial<AuthenticatedActor> = {},
): AuthenticatedActor {
  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-000000000010",
    email: "harbor.owner@example.com",
    displayName: "Harbor Owner",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: null,
    businessMemberships: [
      { businessId: HARBOR_BIZ, role: "business_owner", status: "active" },
    ],
    venueMemberships: [],
    currentBusinessId: HARBOR_BIZ,
    currentVenueId: HARBOR,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants: GRANTS,
    ...overrides,
  };
}

describe("permission catalogue", () => {
  it("represents all 33 actions exactly once", () => {
    expect(PERMISSION_ACTIONS).toHaveLength(33);
    expect(new Set(PERMISSION_ACTIONS).size).toBe(33);
    expect(PERMISSION_ACTIONS.every(isPermissionAction)).toBe(true);
  });

  it("rejects unknown action names", () => {
    expect(isPermissionAction("not_a_real_action")).toBe(false);
  });
});

describe("can()", () => {
  it("denies anonymous actors", () => {
    expect(
      can(ANONYMOUS_ACTOR, "manage_venue", {
        type: "venue",
        venueId: HARBOR,
        businessId: HARBOR_BIZ,
      }),
    ).toBe(false);
  });

  it("denies unknown actions and missing scopes", () => {
    const harbor = actor();
    expect(
      can(harbor, "not_a_real_action", {
        type: "venue",
        venueId: HARBOR,
        businessId: HARBOR_BIZ,
      }),
    ).toBe(false);
    expect(can(harbor, "manage_venue", null)).toBe(false);
    expect(can(harbor, "manage_venue", { type: "venue", venueId: "" })).toBe(
      false,
    );
  });

  it("allows a business owner on their venue and denies a foreign venue", () => {
    const harbor = actor();
    expect(
      can(harbor, "manage_venue", {
        type: "venue",
        venueId: HARBOR,
        businessId: HARBOR_BIZ,
      }),
    ).toBe(true);
    expect(
      can(harbor, "manage_venue", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
  });

  it("default-denies conditional grants unless the condition is modelled or proven", () => {
    const editor: AuthenticatedActor = actor({
      userId: "00000000-0000-4000-8000-000000000022",
      businessMemberships: [],
      venueMemberships: [
        {
          venueId: NIGHT_ORCHID,
          businessId: ATLAS_BIZ,
          role: "content_editor",
          status: "active",
        },
      ],
    });

    expect(
      can(editor, "publish_content", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
    expect(
      can(
        editor,
        "publish_content",
        { type: "venue", venueId: NIGHT_ORCHID, businessId: ATLAS_BIZ },
        { provenConditions: ["content_editor:publish_content"] },
      ),
    ).toBe(true);

    const staff: AuthenticatedActor = actor({
      businessMemberships: [],
      venueMemberships: [
        {
          venueId: NIGHT_ORCHID,
          businessId: ATLAS_BIZ,
          role: "staff",
          status: "active",
        },
      ],
    });
    expect(
      can(staff, "create_content", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
  });

  it("treats C2 venue_manager assign_roles as effective except self-assign", () => {
    const manager: AuthenticatedActor = actor({
      userId: "00000000-0000-4000-8000-000000000021",
      businessMemberships: [],
      venueMemberships: [
        {
          venueId: NIGHT_ORCHID,
          businessId: ATLAS_BIZ,
          role: "venue_manager",
          status: "active",
        },
      ],
    });

    expect(
      can(manager, "assign_roles", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(true);
    expect(
      can(
        manager,
        "assign_roles",
        { type: "venue", venueId: NIGHT_ORCHID, businessId: ATLAS_BIZ },
        { targetUserId: manager.userId },
      ),
    ).toBe(false);
    expect(
      can(manager, "invite_users", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
  });

  it("does not treat a platform role as a tenant shortcut", () => {
    const admin: AuthenticatedActor = actor({
      platformRole: "platform_admin",
      businessMemberships: [],
      venueMemberships: [],
    });

    expect(can(admin, "manage_platform_tenants", { type: "platform" })).toBe(
      true,
    );
    expect(can(admin, "moderate_content", { type: "platform" })).toBe(true);
    expect(
      can(admin, "manage_venue", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
  });

  it("requires a write support session for platform tenant writes", () => {
    const admin: AuthenticatedActor = actor({
      platformRole: "platform_admin",
      businessMemberships: [],
      venueMemberships: [],
      supportSessions: [
        {
          id: "session-write",
          targetBusinessId: ATLAS_BIZ,
          targetVenueId: NIGHT_ORCHID,
          mode: "write",
          writeActive: true,
        },
      ],
    });

    expect(
      can(admin, "manage_venue", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(true);

    const support: AuthenticatedActor = actor({
      platformRole: "platform_support",
      businessMemberships: [],
      venueMemberships: [],
      supportSessions: [
        {
          id: "session-ro",
          targetBusinessId: ATLAS_BIZ,
          targetVenueId: NIGHT_ORCHID,
          mode: "read_only",
          writeActive: false,
        },
      ],
    });
    expect(can(support, "moderate_content", { type: "platform" })).toBe(false);
    expect(
      can(support, "manage_venue", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(false);
  });

  it("denies deactivated sessions even when memberships remain", () => {
    const deactivated = actor({
      accountStatus: "deactivated",
      deactivatedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(isActiveAuthenticatedActor(deactivated)).toBe(false);
    expect(
      can(deactivated, "manage_venue", {
        type: "venue",
        venueId: HARBOR,
        businessId: HARBOR_BIZ,
      }),
    ).toBe(false);
    expect(canAccessVenueAdmin(deactivated)).toBe(false);
    expect(
      canAccessPlatform(
        actor({
          accountStatus: "deactivated",
          deactivatedAt: "2026-08-01T00:00:00.000Z",
          platformRole: "platform_admin",
        }),
      ),
    ).toBe(false);
  });

  it("requires an active membership for /admin and a platform role for /platform", () => {
    expect(canAccessVenueAdmin(ANONYMOUS_ACTOR)).toBe(false);
    expect(canAccessVenueAdmin(actor())).toBe(true);
    expect(
      canAccessVenueAdmin(
        actor({ businessMemberships: [], venueMemberships: [] }),
      ),
    ).toBe(false);
    expect(canAccessPlatform(actor())).toBe(false);
    expect(canAccessPlatform(actor({ platformRole: "platform_support" }))).toBe(
      true,
    );
  });
});
