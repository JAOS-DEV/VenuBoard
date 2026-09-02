import { parseSafeApplicationPath } from "@/core/auth/redirects";

export const DEVELOPER_PERSONA_IDS = [
  "platform-admin",
  "platform-support",
  "harbor-owner",
  "atlas-owner",
  "atlas-manager",
  "atlas-editor",
  "atlas-bookings",
  "atlas-staff",
  "deactivated-user",
  "dual-staff",
] as const;

export type DeveloperPersonaId = (typeof DEVELOPER_PERSONA_IDS)[number];

export type DeveloperPersonaGroup = "platform" | "venue" | "denied";

export type DeveloperPersonaDestination = "/platform" | "/admin";

/**
 * Fictional seeded identities for local manual testing.
 *
 * No password, key, token or UUID fields. Emails must exist in
 * `supabase/seed/01_foundation.sql`.
 */
export interface DeveloperPersona {
  id: DeveloperPersonaId;
  email: `${string}@example.com`;
  group: DeveloperPersonaGroup;
  destination: DeveloperPersonaDestination;
  seedRole: string;
}

export interface DeveloperPersonaView {
  id: DeveloperPersonaId;
  email: DeveloperPersona["email"];
  group: DeveloperPersonaGroup;
  destination: DeveloperPersonaDestination;
}

export const DEVELOPER_PERSONAS: readonly DeveloperPersona[] = [
  {
    id: "platform-admin",
    email: "platform.admin@example.com",
    group: "platform",
    destination: "/platform",
    seedRole: "platform_admin",
  },
  {
    id: "platform-support",
    email: "platform.support@example.com",
    group: "platform",
    destination: "/platform",
    seedRole: "platform_support",
  },
  {
    id: "harbor-owner",
    email: "harbor.owner@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "business_owner",
  },
  {
    id: "atlas-owner",
    email: "atlas.owner@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "business_owner",
  },
  {
    id: "atlas-manager",
    email: "atlas.manager@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "venue_manager",
  },
  {
    id: "atlas-editor",
    email: "atlas.editor@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "content_editor",
  },
  {
    id: "atlas-bookings",
    email: "atlas.bookings@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "booking_manager",
  },
  {
    id: "atlas-staff",
    email: "atlas.staff@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "staff",
  },
  {
    id: "deactivated-user",
    email: "deactivated.user@example.com",
    group: "denied",
    destination: "/admin",
    seedRole: "deactivated",
  },
  {
    id: "dual-staff",
    email: "dual.staff@example.com",
    group: "venue",
    destination: "/admin",
    seedRole: "staff",
  },
];

const PERSONAS_BY_ID = new Map(
  DEVELOPER_PERSONAS.map((persona) => [persona.id, persona]),
);

export function isDeveloperPersonaId(
  value: string | undefined,
): value is DeveloperPersonaId {
  return (
    value !== undefined &&
    (DEVELOPER_PERSONA_IDS as readonly string[]).includes(value)
  );
}

export function resolveDeveloperPersona(
  id: string | undefined | null,
): DeveloperPersona | null {
  if (id === undefined || id === null) {
    return null;
  }

  return PERSONAS_BY_ID.get(id as DeveloperPersonaId) ?? null;
}

export function toDeveloperPersonaView(
  persona: DeveloperPersona,
): DeveloperPersonaView {
  return {
    id: persona.id,
    email: persona.email,
    group: persona.group,
    destination: persona.destination,
  };
}

export function developerHubSignInHref(persona: DeveloperPersonaView): {
  pathname: "/sign-in";
  query: { persona: string; next: string };
} {
  const next = parseSafeApplicationPath(persona.destination) ?? "/admin";

  return {
    pathname: "/sign-in",
    query: { persona: persona.id, next },
  };
}
