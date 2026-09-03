import type { EventLocale } from "./constants";

export interface PublicEventItem {
  id: string;
  startsAt: string; // ISO timestamptz string
  endsAt: string; // ISO timestamptz string
  timezone: string;
  isAllDay: boolean;
  title: string;
  summary: string | null;
  description: string | null;
  ctaLabel: string | null;
  locale: EventLocale;
}

export interface PublicVenueEventsPayload {
  available: boolean;
  ok: boolean;
  heading: string | null;
  locale: EventLocale;
  timezone: string | null;
  defaultDisplay: "upcoming_list" | "calendar_and_list";
  showPastArchive: boolean;
  items: PublicEventItem[];
}
