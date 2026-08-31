export const INVITATION_STATUSES = [
  "pending",
  "invalid",
  "expired",
  "revoked",
  "accepted",
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface InvitationInspection {
  status: InvitationStatus;
  email: string | null;
  role: string | null;
  scopeType: "business" | "venue" | null;
  venueId: string | null;
  businessId: string | null;
  venueName: string | null;
  businessName: string | null;
  expiresAt: string | null;
}

const EMPTY_INSPECTION: InvitationInspection = {
  status: "invalid",
  email: null,
  role: null,
  scopeType: null,
  venueId: null,
  businessId: null,
  venueName: null,
  businessName: null,
  expiresAt: null,
};

function asStatus(value: unknown): InvitationStatus {
  if (
    typeof value === "string" &&
    (INVITATION_STATUSES as readonly string[]).includes(value)
  ) {
    return value as InvitationStatus;
  }
  return "invalid";
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asScopeType(value: unknown): "business" | "venue" | null {
  return value === "business" || value === "venue" ? value : null;
}

/**
 * Maps inspect_invitation JSON into a UI-safe view. Unknown shapes become
 * invalid rather than throwing, so a malformed payload cannot leak fields.
 */
export function mapInvitationInspection(
  payload: unknown,
): InvitationInspection {
  if (
    payload === null ||
    payload === undefined ||
    typeof payload !== "object"
  ) {
    return EMPTY_INSPECTION;
  }

  const record = payload as Record<string, unknown>;
  const status = asStatus(record.status);

  if (status === "invalid") {
    return EMPTY_INSPECTION;
  }

  if (status !== "pending") {
    return { ...EMPTY_INSPECTION, status };
  }

  return {
    status,
    email: asOptionalString(record.email),
    role: asOptionalString(record.role),
    scopeType: asScopeType(record.scope_type),
    venueId: null,
    businessId: null,
    venueName: asOptionalString(record.venue_name),
    businessName: asOptionalString(record.business_name),
    expiresAt: asOptionalString(record.expires_at),
  };
}

export function invitationRequiresSignIn(
  inspection: InvitationInspection,
): boolean {
  return inspection.status === "pending";
}
