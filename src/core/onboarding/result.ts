export interface OnboardingActionResult {
  ok: boolean;
  code?: string;
  businessId?: string;
  venueId?: string;
  invitationId?: string;
  invitationToken?: string;
  idempotent?: boolean;
  slug?: string;
  publicationState?: string;
  classification?: string;
  trialEndsAt?: string;
  quotaBytes?: number;
}

export function parseOnboardingRpcResult(
  payload: unknown,
): OnboardingActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return {
      ok: false,
      code: typeof record.code === "string" ? record.code : "unavailable",
    };
  }

  return {
    ok: true,
    businessId:
      typeof record.business_id === "string" ? record.business_id : undefined,
    venueId: typeof record.venue_id === "string" ? record.venue_id : undefined,
    invitationId:
      typeof record.invitation_id === "string"
        ? record.invitation_id
        : undefined,
    invitationToken:
      typeof record.invitation_token === "string"
        ? record.invitation_token
        : undefined,
    idempotent: record.idempotent === true,
    slug: typeof record.slug === "string" ? record.slug : undefined,
    publicationState:
      typeof record.publication_state === "string"
        ? record.publication_state
        : undefined,
    classification:
      typeof record.content_classification === "string"
        ? record.content_classification
        : undefined,
    trialEndsAt:
      typeof record.trial_ends_at === "string"
        ? record.trial_ends_at
        : undefined,
    quotaBytes:
      typeof record.quota_bytes === "number" ? record.quota_bytes : undefined,
  };
}
