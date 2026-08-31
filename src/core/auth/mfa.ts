/**
 * MFA is represented on the actor so platform routes can later require AAL2.
 * Enrolment, recovery codes, and production enforcement dates are intentionally
 * not implemented (OQ-40 / ADR-038).
 */

export type AuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

export interface MfaState {
  enrolledAt: string | null;
  authenticatorAssuranceLevel: AuthenticatorAssuranceLevel;
  requiredForPlatformRoles: true;
  enforcement: "represented-not-enforced";
}

export const MFA_REPRESENTED_NOT_ENFORCED = {
  requiredForPlatformRoles: true,
  enforcement: "represented-not-enforced",
} as const;

export function createMfaState(input: {
  enrolledAt: string | null;
  authenticatorAssuranceLevel: AuthenticatorAssuranceLevel;
}): MfaState {
  return {
    enrolledAt: input.enrolledAt,
    authenticatorAssuranceLevel: input.authenticatorAssuranceLevel,
    ...MFA_REPRESENTED_NOT_ENFORCED,
  };
}

/**
 * Always false in this phase. Callers should still consult `actor.mfa` so the
 * enforcement point exists; flipping this later must not invent a recovery flow.
 */
export function platformMfaBlocksAccess(mfa: MfaState): boolean {
  return mfa.enforcement !== "represented-not-enforced";
}
