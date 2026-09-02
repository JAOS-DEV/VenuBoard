import type { StaffConsentState, StaffPresenceState } from "./constants";

export interface PublicStaffEligibilityInput {
  venuePublished: boolean;
  moduleEntitled: boolean;
  moduleEnabled: boolean;
  modulePubliclyVisible: boolean;
  staffActive: boolean;
  assignmentActive: boolean;
  publicationPublished: boolean;
  consentState: StaffConsentState;
  quarantined: boolean;
  venuePubliclyVisible: boolean;
}

export function isPublicStaffProfileEligible(
  input: PublicStaffEligibilityInput,
): boolean {
  return (
    input.venuePubliclyVisible &&
    input.venuePublished &&
    input.moduleEntitled &&
    input.moduleEnabled &&
    input.modulePubliclyVisible &&
    input.staffActive &&
    input.assignmentActive &&
    input.publicationPublished &&
    input.consentState === "granted" &&
    !input.quarantined
  );
}

export function shouldIncludeInPresentOnlyMode(
  eligible: boolean,
  presenceState: StaffPresenceState,
): boolean {
  return eligible && presenceState === "present";
}

export function consentHidesPublicProfile(
  consentState: StaffConsentState,
): boolean {
  return consentState !== "granted";
}
