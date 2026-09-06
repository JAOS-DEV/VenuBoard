import type { BookingModuleAvailability } from "./module-state";

export interface PublicBookingIntakePayload {
  available: boolean;
  accepting: boolean;
  heading: string | null;
  instructions: string | null;
  timezone: string;
  venueName: string;
  venueSlug: string;
  minPartySize: number;
  maxPartySize: number;
  horizonDays: number;
  leadTimeMinutes: number;
  minLocal: string;
  maxLocal: string;
  defaultLocal: string;
  contentClassification: string | null;
  availability: BookingModuleAvailability | "hidden";
}
