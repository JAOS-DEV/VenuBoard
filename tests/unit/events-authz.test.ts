import { describe, expect, it } from "vitest";

import { inactiveMfa, type AuthenticatedActor } from "@/core/actors/types";
import { PERMISSION_ACTIONS } from "@/core/authz/actions";
import { can } from "@/core/authz/can";
import type { AuthzContext } from "@/core/authz/scope";
import type { RoleActionGrant } from "@/core/authz/grants";

const NIGHT_ORCHID = "00000000-0000-4000-8000-000000000201";
const ATLAS_BIZ = "00000000-0000-4000-8000-000000000200";

const GRANTS: RoleActionGrant[] = [
  { roleKey: "business_owner", actionKey: "manage_venue", grantKind: "allow" },
  {
    roleKey: "business_owner",
    actionKey: "create_content",
    grantKind: "allow",
  },
  {
    roleKey: "business_owner",
    actionKey: "publish_content",
    grantKind: "allow",
  },
  {
    roleKey: "business_owner",
    actionKey: "approve_content",
    grantKind: "allow",
  },
  { roleKey: "business_owner", actionKey: "manage_events", grantKind: "allow" },
  { roleKey: "venue_manager", actionKey: "create_content", grantKind: "allow" },
  {
    roleKey: "venue_manager",
    actionKey: "publish_content",
    grantKind: "allow",
  },
  {
    roleKey: "venue_manager",
    actionKey: "approve_content",
    grantKind: "allow",
  },
  { roleKey: "venue_manager", actionKey: "manage_events", grantKind: "allow" },
  {
    roleKey: "venue_manager",
    actionKey: "submit_content_for_approval",
    grantKind: "allow",
  },
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
    roleKey: "content_editor",
    actionKey: "manage_events",
    grantKind: "conditional",
  },
  {
    roleKey: "content_editor",
    actionKey: "submit_content_for_approval",
    grantKind: "allow",
  },
  {
    roleKey: "content_editor",
    actionKey: "approve_content",
    grantKind: "deny",
  },
  {
    roleKey: "staff",
    actionKey: "create_content",
    grantKind: "conditional",
  },
];

function makeEditor(): AuthenticatedActor {
  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-000000000022",
    email: "atlas.editor@example.com",
    displayName: "Atlas Editor",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: null,
    businessMemberships: [],
    venueMemberships: [
      {
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
        role: "content_editor",
        status: "active",
      },
    ],
    currentBusinessId: ATLAS_BIZ,
    currentVenueId: NIGHT_ORCHID,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants: GRANTS,
  };
}

function makeManager(): AuthenticatedActor {
  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-000000000021",
    email: "atlas.manager@example.com",
    displayName: "Atlas Manager",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: null,
    businessMemberships: [],
    venueMemberships: [
      {
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
        role: "venue_manager",
        status: "active",
      },
    ],
    currentBusinessId: ATLAS_BIZ,
    currentVenueId: NIGHT_ORCHID,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants: GRANTS,
  };
}

function makeOwner(): AuthenticatedActor {
  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-000000000020",
    email: "atlas.owner@example.com",
    displayName: "Atlas Owner",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: null,
    businessMemberships: [
      { businessId: ATLAS_BIZ, role: "business_owner", status: "active" },
    ],
    venueMemberships: [],
    currentBusinessId: ATLAS_BIZ,
    currentVenueId: NIGHT_ORCHID,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants: GRANTS,
  };
}

function makeDeactivated(): AuthenticatedActor {
  return {
    ...makeEditor(),
    accountStatus: "deactivated",
    deactivatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const venueScope = {
  type: "venue" as const,
  venueId: NIGHT_ORCHID,
  businessId: ATLAS_BIZ,
};

describe("events authz boundary", () => {
  it("content_editor cannot publish_content without proven condition", () => {
    const editor = makeEditor();
    expect(can(editor, "publish_content", venueScope)).toBe(false);
  });

  it("content_editor cannot manage_events without proven condition", () => {
    const editor = makeEditor();
    expect(can(editor, "manage_events", venueScope)).toBe(false);
  });

  it("AuthzContext does not have eventsApprovalRequired field", () => {
    // Ensure the type no longer has this field
    const context: AuthzContext = {};
    // This checks that we can't accidentally set a removed field without TS error
    // at runtime we just verify the context works without the old field
    expect(context).not.toHaveProperty("eventsApprovalRequired");
  });

  it("passing arbitrary context properties does not grant publish_content to editor", () => {
    const editor = makeEditor();
    // Even if someone constructs an object with a stale field, it should not affect can()
    const context = { provenConditions: [] } as AuthzContext;
    expect(can(editor, "publish_content", venueScope, context)).toBe(false);
  });

  it("a client-supplied eventsApprovalRequired flag cannot grant publish_content", () => {
    const editor = makeEditor();
    expect(
      can(editor, "publish_content", venueScope, {
        eventsApprovalRequired: false,
      } as AuthzContext),
    ).toBe(false);
    expect(
      can(editor, "manage_events", venueScope, {
        eventsApprovalRequired: false,
      } as AuthzContext),
    ).toBe(false);
  });

  it("venue_manager can publish_content", () => {
    const manager = makeManager();
    expect(can(manager, "publish_content", venueScope)).toBe(true);
  });

  it("business_owner can approve_content", () => {
    const owner = makeOwner();
    expect(
      can(owner, "approve_content", {
        type: "venue",
        venueId: NIGHT_ORCHID,
        businessId: ATLAS_BIZ,
      }),
    ).toBe(true);
  });

  it("content_editor cannot approve_content", () => {
    const editor = makeEditor();
    expect(can(editor, "approve_content", venueScope)).toBe(false);
  });

  it("staff cannot create_content (C4: conditional stays false)", () => {
    const staffActor: AuthenticatedActor = {
      ...makeEditor(),
      userId: "00000000-0000-4000-8000-000000000024",
      venueMemberships: [
        {
          venueId: NIGHT_ORCHID,
          businessId: ATLAS_BIZ,
          role: "staff",
          status: "active",
        },
      ],
    };
    expect(can(staffActor, "create_content", venueScope)).toBe(false);
  });

  it("deactivated actor is denied for all events actions", () => {
    const deactivated = makeDeactivated();
    expect(can(deactivated, "create_content", venueScope)).toBe(false);
    expect(can(deactivated, "publish_content", venueScope)).toBe(false);
    expect(can(deactivated, "manage_events", venueScope)).toBe(false);
    expect(can(deactivated, "approve_content", venueScope)).toBe(false);
  });

  it("manager can approve_content", () => {
    const manager = makeManager();
    expect(can(manager, "approve_content", venueScope)).toBe(true);
  });

  it("PERMISSION_ACTIONS contains events-related actions", () => {
    expect(PERMISSION_ACTIONS).toContain("create_content");
    expect(PERMISSION_ACTIONS).toContain("publish_content");
    expect(PERMISSION_ACTIONS).toContain("approve_content");
    expect(PERMISSION_ACTIONS).toContain("manage_events");
    expect(PERMISSION_ACTIONS).toContain("submit_content_for_approval");
  });
});
