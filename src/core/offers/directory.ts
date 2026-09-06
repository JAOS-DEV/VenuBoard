import type { OffersModuleAvailability } from "./module-state";
import type { OfferState } from "./constants";

export type OfferValidityLabel = "upcoming" | "active" | "expired";

export interface AdminOfferHistoryRow {
  action: string;
  fromState: string | null;
  toState: string | null;
  createdAt: string;
}

export interface AdminOfferRow {
  id: string;
  state: OfferState;
  titleEn: string | null;
  titleTh: string | null;
  validFrom: string;
  validUntil: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  approvedAt: string | null;
  quarantined: boolean;
}

export interface AdminOfferDetail {
  id: string;
  venueId: string;
  state: OfferState;
  scheduledFor: string | null;
  publishedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  archivedAt: string | null;
  quarantined: boolean;
  validFrom: string;
  validUntil: string;
  titleEn: string | null;
  descriptionEn: string | null;
  termsEn: string | null;
  titleTh: string | null;
  descriptionTh: string | null;
  termsTh: string | null;
  history: AdminOfferHistoryRow[];
}

export interface AdminOffersData {
  moduleState: OffersModuleAvailability;
  approvalRequired: boolean;
  homepagePreviewEnabled: boolean;
  homepagePreviewCount: number;
  headingEn: string | null;
  headingTh: string | null;
  isEnabled: boolean;
  isPubliclyVisible: boolean;
  timezone: string;
  rows: AdminOfferRow[];
}
