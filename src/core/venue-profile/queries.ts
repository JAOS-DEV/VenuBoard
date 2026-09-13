import "server-only";

import { cache } from "react";

import type { AuthenticatedActor } from "@/core/actors/types";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AppLocale } from "@/core/i18n/routing";
import { ISO_WEEKDAYS } from "./constants";
import type { AdminVenueProfile, PublicVenueProfile } from "./public-types";

function emptyPublic(): PublicVenueProfile {
  return {
    available: false,
    preview: false,
    publicationState: null,
    timezone: "UTC",
    hoursMode: "unknown",
    name: "",
    tagline: null,
    description: null,
    directions: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
    latitude: null,
    longitude: null,
    contentClassification: null,
    contacts: [],
    weeklyIntervals: [],
    closedWeekdays: [],
    exceptions: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

export const loadPublicVenueProfile = cache(
  async (venueSlug: string, locale: AppLocale): Promise<PublicVenueProfile> => {
    if (getSupabaseConnection() === null) {
      return emptyPublic();
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_public_venue_profile", {
      p_venue_slug: venueSlug,
      p_locale: locale,
    });
    if (error) {
      return emptyPublic();
    }
    const record = asRecord(data);
    if (record === null || record.ok !== true || record.available !== true) {
      return emptyPublic();
    }
    const contacts = Array.isArray(record.contacts) ? record.contacts : [];
    const weekly = Array.isArray(record.weekly_intervals)
      ? record.weekly_intervals
      : [];
    const closed = Array.isArray(record.closed_weekdays)
      ? record.closed_weekdays
      : [];
    const exceptions = Array.isArray(record.exceptions)
      ? record.exceptions
      : [];
    return {
      available: true,
      preview: asBool(record.preview),
      publicationState: asString(record.publication_state),
      timezone: asString(record.timezone) ?? "UTC",
      hoursMode: record.hours_mode === "scheduled" ? "scheduled" : "unknown",
      name: asString(record.name) ?? "",
      tagline: asString(record.tagline),
      description: asString(record.description),
      directions: asString(record.directions),
      addressLine1: asString(record.address_line1),
      addressLine2: asString(record.address_line2),
      city: asString(record.city),
      province: asString(record.province),
      postalCode: asString(record.postal_code),
      country: asString(record.country),
      latitude: asNumber(record.latitude),
      longitude: asNumber(record.longitude),
      contentClassification: asString(record.content_classification),
      contacts: contacts.flatMap((item) => {
        const row = asRecord(item);
        if (row === null) {
          return [];
        }
        const type = asString(row.type);
        const value = asString(row.value);
        if (
          (type !== "phone" && type !== "email" && type !== "website") ||
          value === null
        ) {
          return [];
        }
        return [{ type, value }];
      }),
      weeklyIntervals: weekly.flatMap((item) => {
        const row = asRecord(item);
        if (row === null) {
          return [];
        }
        const day = asNumber(row.day);
        const opens = asString(row.opens);
        const closes = asString(row.closes);
        if (day === null || opens === null || closes === null) {
          return [];
        }
        return [
          {
            day,
            opens,
            closes,
            closesNextDay: asBool(row.closes_next_day),
          },
        ];
      }),
      closedWeekdays: closed.flatMap((item) => {
        const day = asNumber(item);
        return day === null ? [] : [day];
      }),
      exceptions: exceptions.flatMap((item) => {
        const row = asRecord(item);
        if (row === null) {
          return [];
        }
        const date = asString(row.date);
        if (date === null) {
          return [];
        }
        const intervals = Array.isArray(row.intervals) ? row.intervals : [];
        return [
          {
            date,
            closed: asBool(row.closed),
            intervals: intervals.flatMap((interval) => {
              const part = asRecord(interval);
              if (part === null) {
                return [];
              }
              const opens = asString(part.opens);
              const closes = asString(part.closes);
              if (opens === null || closes === null) {
                return [];
              }
              return [
                {
                  opens,
                  closes,
                  closesNextDay: asBool(part.closes_next_day),
                },
              ];
            }),
          },
        ];
      }),
    };
  },
);

function hm(value: string | null): string {
  return value === null ? "09:00" : value.slice(0, 5);
}

export async function loadAdminVenueProfile(
  _actor: AuthenticatedActor,
  venueId: string,
): Promise<AdminVenueProfile | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data: venue, error } = await supabase
    .from("venues")
    .select(
      "id, business_id, slug, name, timezone, updated_at, publication_state, opening_hours_mode, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, venue_translations ( locale, name, tagline, description, directions ), venue_branding ( theme_key, font_key, primary_color, secondary_color, accent_color, background_color, text_color )",
    )
    .eq("id", venueId)
    .maybeSingle();
  if (error || venue === null) {
    return null;
  }

  const { data: contacts } = await supabase
    .from("venue_contacts")
    .select("contact_type, value")
    .eq("venue_id", venueId);
  const { data: hours } = await supabase
    .from("venue_opening_hours")
    .select(
      "day_of_week, sort_order, opens_local, closes_local, closes_next_day",
    )
    .eq("venue_id", venueId)
    .order("day_of_week")
    .order("sort_order");
  const { data: closed } = await supabase
    .from("venue_closed_weekdays")
    .select("day_of_week")
    .eq("venue_id", venueId);
  const { data: exceptions } = await supabase
    .from("venue_hours_exceptions")
    .select(
      "exception_date, is_closed, internal_note, venue_hours_exception_intervals ( sort_order, opens_local, closes_local, closes_next_day )",
    )
    .eq("venue_id", venueId)
    .order("exception_date");

  const translations = Array.isArray(venue.venue_translations)
    ? venue.venue_translations
    : [];
  const en = translations.find((row) => row.locale === "en");
  const th = translations.find((row) => row.locale === "th");
  const branding = Array.isArray(venue.venue_branding)
    ? venue.venue_branding[0]
    : venue.venue_branding;
  const contactRows = contacts ?? [];
  const closedDays = new Set((closed ?? []).map((row) => row.day_of_week));
  const hourRows = hours ?? [];

  const week = ISO_WEEKDAYS.map((day) => {
    const intervals = hourRows
      .filter((row) => row.day_of_week === day)
      .map((row) => ({
        opens: hm(row.opens_local),
        closes: hm(row.closes_local),
        closesNextDay: row.closes_next_day,
      }));
    return {
      day,
      closed: closedDays.has(day) || intervals.length === 0,
      intervals: closedDays.has(day) ? [] : intervals,
    };
  });

  return {
    venueId: venue.id,
    businessId: venue.business_id,
    slug: venue.slug,
    timezone: venue.timezone,
    updatedAt: venue.updated_at,
    publicationState: venue.publication_state,
    openingHoursMode:
      venue.opening_hours_mode === "scheduled" ? "scheduled" : "unknown",
    name: venue.name,
    nameEn: en?.name ?? "",
    taglineEn: en?.tagline ?? "",
    descriptionEn: en?.description ?? "",
    directionsEn: en?.directions ?? "",
    nameTh: th?.name ?? "",
    taglineTh: th?.tagline ?? "",
    descriptionTh: th?.description ?? "",
    directionsTh: th?.directions ?? "",
    addressLine1: venue.address_line1 ?? "",
    addressLine2: venue.address_line2 ?? "",
    city: venue.city ?? "",
    province: venue.province ?? "",
    postalCode: venue.postal_code ?? "",
    country: venue.country ?? "TH",
    latitude: venue.latitude === null ? "" : String(venue.latitude),
    longitude: venue.longitude === null ? "" : String(venue.longitude),
    email: contactRows.find((row) => row.contact_type === "email")?.value ?? "",
    phone: contactRows.find((row) => row.contact_type === "phone")?.value ?? "",
    website:
      contactRows.find((row) => row.contact_type === "website")?.value ?? "",
    branding:
      branding === null || branding === undefined
        ? null
        : {
            themeKey: branding.theme_key,
            fontKey: branding.font_key,
            primaryColor: branding.primary_color,
            secondaryColor: branding.secondary_color,
            accentColor: branding.accent_color,
            backgroundColor: branding.background_color,
            textColor: branding.text_color,
          },
    week,
    exceptions: (exceptions ?? []).map((row) => {
      const intervals = Array.isArray(row.venue_hours_exception_intervals)
        ? row.venue_hours_exception_intervals
        : [];
      return {
        date: row.exception_date,
        closed: row.is_closed,
        internalNote: row.internal_note ?? "",
        intervals: intervals
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((interval) => ({
            opens: hm(interval.opens_local),
            closes: hm(interval.closes_local),
            closesNextDay: interval.closes_next_day,
          })),
      };
    }),
  };
}
