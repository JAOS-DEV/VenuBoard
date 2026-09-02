import type { StaffConsentState, StaffPresenceState } from "./constants";
import type { StaffModuleAvailability } from "./module-state";
import { parseStaffModuleSettings } from "./public-map";

export interface AdminVenueOption {
  id: string;
  businessId: string;
  name: string;
  slug: string;
}

export interface AdminStaffRow {
  profileId: string;
  staffMemberId: string;
  internalDisplayName: string | null;
  publicDisplayName: string;
  publicTitle: string | null;
  bioEn: string | null;
  bioTh: string | null;
  assignmentStatus: string;
  publicationState: string;
  consentState: StaffConsentState;
  staffStatus: string;
  linkedUserId: string | null;
  displayOrder: number;
  presenceState: StaffPresenceState;
  presenceExpiresAt: string | null;
}

export interface StaffDirectoryData {
  moduleState: StaffModuleAvailability;
  entitled: boolean;
  enabled: boolean;
  publiclyVisible: boolean;
  settings: ReturnType<typeof parseStaffModuleSettings>;
  headingEn: string | null;
  headingTh: string | null;
  rows: AdminStaffRow[];
  assignableMembers: Array<{
    id: string;
    internalDisplayName: string;
    alreadyAssigned: boolean;
  }>;
}
