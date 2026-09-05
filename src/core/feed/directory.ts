import type { FeedModuleAvailability } from "./module-state";
import type { FeedPostState, FeedPostType } from "./constants";

export interface AdminFeedRow {
  id: string;
  state: FeedPostState;
  postType: FeedPostType;
  titleEn: string | null;
  titleTh: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  isPinned: boolean;
  approvedAt: string | null;
}

export interface AdminFeedDetail {
  id: string;
  venueId: string;
  state: FeedPostState;
  postType: FeedPostType;
  scheduledFor: string | null;
  publishedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  isPinned: boolean;
  archivedAt: string | null;
  titleEn: string | null;
  bodyEn: string | null;
  titleTh: string | null;
  bodyTh: string | null;
}

export interface AdminFeedData {
  moduleState: FeedModuleAvailability;
  approvalRequired: boolean;
  homepagePreviewEnabled: boolean;
  homepagePreviewCount: number;
  horizonDays: number;
  displayDensity: "compact" | "comfortable";
  headingEn: string | null;
  headingTh: string | null;
  isEnabled: boolean;
  isPubliclyVisible: boolean;
  rows: AdminFeedRow[];
  copyDestinations: Array<{ id: string; name: string; businessId: string }>;
}
