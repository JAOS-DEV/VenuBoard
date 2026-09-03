import type { EventsModuleAvailability } from "./module-state";

export interface AdminEventRow {
  id: string;
  state: string;
  approvalStatus: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  titleEn: string | null;
  titleTh: string | null;
  publishAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
}

export interface AdminEventsData {
  moduleState: EventsModuleAvailability;
  approvalRequired: boolean;
  venueTimezone: string;
  rows: AdminEventRow[];
  copyDestinations: Array<{ id: string; name: string; businessId: string }>;
}
