export interface StaffPresenceOwnershipRow {
  linkedUserId: string | null;
  consentState: string;
  staffStatus: string;
  assignmentStatus: string;
}

export interface StaffAdminCapabilities {
  userId: string;
  canManageProfiles: boolean;
  canToggleAnyPresence: boolean;
  canConfigureModule: boolean;
  canEditOwnProfile: boolean;
  canManageOwnConsent: boolean;
}

export function actorOwnsConsentedProfile(
  userId: string,
  row: StaffPresenceOwnershipRow,
): boolean {
  return (
    row.linkedUserId === userId &&
    row.consentState === "granted" &&
    row.staffStatus === "active" &&
    row.assignmentStatus === "active"
  );
}

export function actorOwnsStaffProfile(
  userId: string,
  linkedUserId: string | null,
): boolean {
  return linkedUserId === userId;
}
