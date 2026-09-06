import type { BookingClosureOutcome, BookingEnquiryState } from "./constants";
import type { BookingModuleAvailability } from "./module-state";

export interface AdminBookingRow {
  id: string;
  state: BookingEnquiryState;
  partySize: number;
  requestedFor: string;
  locale: "en" | "th";
  createdAt: string;
  rowVersion: number;
  closureOutcome: BookingClosureOutcome | null;
}

export interface AdminBookingContact {
  displayName: string;
  email: string;
  message: string | null;
}

export interface AdminBookingEvent {
  occurredAt: string;
  action: string;
  fromState: string | null;
  toState: string | null;
}

export interface AdminBookingDetail {
  id: string;
  venueId: string;
  state: BookingEnquiryState;
  partySize: number;
  requestedFor: string;
  locale: "en" | "th";
  createdAt: string;
  rowVersion: number;
  closureOutcome: BookingClosureOutcome | null;
  contact: AdminBookingContact | null;
  events: AdminBookingEvent[];
}

export interface AdminBookingData {
  moduleState: BookingModuleAvailability;
  isEnabled: boolean;
  isPubliclyVisible: boolean;
  acceptingEnquiries: boolean;
  minPartySize: number;
  maxPartySize: number;
  horizonDays: number;
  leadTimeMinutes: number;
  headingEn: string | null;
  headingTh: string | null;
  instructionsEn: string;
  instructionsTh: string;
  timezone: string;
  venueSlug: string;
  rows: AdminBookingRow[];
}
