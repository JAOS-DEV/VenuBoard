import "server-only";

import { cache } from "react";

import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AppLocale } from "@/core/i18n/routing";

import {
  BOOKING_MODULE_KEY,
  BOOKING_OUTCOMES,
  BOOKING_STATES,
  type BookingClosureOutcome,
  type BookingEnquiryState,
} from "./constants";
import type {
  AdminBookingData,
  AdminBookingDetail,
  AdminBookingEvent,
  AdminBookingRow,
} from "./directory";
import {
  mapBookingModuleAvailability,
  type BookingModuleAvailability,
} from "./module-state";
import { venueInstantToLocalInput } from "./timezone";
import type { PublicBookingIntakePayload } from "./public-types";

function asState(value: string): BookingEnquiryState {
  if (value === "new" || value === "in_review" || value === "closed") {
    return value;
  }
  return "new";
}

function asOutcome(value: string | null): BookingClosureOutcome | null {
  if (
    value !== null &&
    (BOOKING_OUTCOMES as readonly string[]).includes(value)
  ) {
    return value as BookingClosureOutcome;
  }
  return null;
}

function asSettingsObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asPositiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function asNonNegInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function hiddenPublicIntake(slug: string): PublicBookingIntakePayload {
  return {
    available: false,
    accepting: false,
    heading: null,
    instructions: null,
    timezone: "Asia/Bangkok",
    venueName: "",
    venueSlug: slug,
    minPartySize: 1,
    maxPartySize: 12,
    horizonDays: 90,
    leadTimeMinutes: 60,
    minLocal: "",
    maxLocal: "",
    defaultLocal: "",
    contentClassification: null,
    availability: "hidden",
  };
}

async function loadModuleAvailability(venueId: string): Promise<{
  moduleState: BookingModuleAvailability;
  entitled: boolean;
  enabled: boolean;
  accepting: boolean;
  isPubliclyVisible: boolean;
  settings: Record<string, unknown>;
  headingEn: string | null;
  headingTh: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select(
      "is_enabled, is_publicly_visible, settings, venue_module_setting_translations ( locale, public_heading )",
    )
    .eq("venue_id", venueId)
    .eq("module_key", BOOKING_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", BOOKING_MODULE_KEY);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("state")
    .eq("venue_id", venueId)
    .maybeSingle();

  const now = Date.now();
  const activeEntitlements = (entitlementRows ?? []).filter(
    (row) =>
      row.revoked_at === null &&
      (row.ends_at === null || Date.parse(row.ends_at) > now),
  );
  const denied = activeEntitlements.some(
    (row) => row.grant_type === "deny" && row.source_key === "override",
  );
  const allowed = activeEntitlements.some((row) => row.grant_type === "allow");
  const entitled = !denied && allowed;
  const trial = activeEntitlements.some((row) => row.source_key === "trial");
  const expired =
    !entitled &&
    (entitlementRows ?? []).some(
      (row) =>
        row.grant_type === "allow" &&
        row.ends_at !== null &&
        Date.parse(row.ends_at) <= now,
    );

  const settings = asSettingsObject(settingsRow?.settings);
  const enabled = settingsRow?.is_enabled === true;
  const accepting = settings.accepting_enquiries !== false;
  const translations = Array.isArray(
    settingsRow?.venue_module_setting_translations,
  )
    ? settingsRow.venue_module_setting_translations
    : [];

  return {
    moduleState: mapBookingModuleAvailability({
      entitled,
      enabled,
      accepting,
      entitlementSource: trial ? "trial" : "plan",
      entitlementEnded: expired,
      subscriptionState: subscription?.state ?? null,
    }),
    entitled,
    enabled,
    accepting,
    isPubliclyVisible: settingsRow?.is_publicly_visible !== false,
    settings,
    headingEn:
      translations.find((row) => row.locale === "en")?.public_heading ?? null,
    headingTh:
      translations.find((row) => row.locale === "th")?.public_heading ?? null,
  };
}

export const loadPublicBookingIntake = cache(
  async function loadPublicBookingIntake(
    venueSlug: string,
    locale: AppLocale,
  ): Promise<PublicBookingIntakePayload> {
    const hidden = hiddenPublicIntake(venueSlug);
    if (getSupabaseConnection() === null) {
      return hidden;
    }

    const supabase = await createSupabaseServerClient();
    const { data: venue } = await supabase
      .from("venues")
      .select("id, name, slug, timezone, content_classification")
      .eq("slug", venueSlug)
      .maybeSingle();

    if (venue === null) {
      return hidden;
    }

    const { data: settingsRow } = await supabase
      .from("venue_module_settings")
      .select(
        "is_enabled, is_publicly_visible, settings, venue_module_setting_translations ( locale, public_heading )",
      )
      .eq("venue_id", venue.id)
      .eq("module_key", BOOKING_MODULE_KEY)
      .maybeSingle();

    if (
      settingsRow === null ||
      settingsRow.is_enabled !== true ||
      settingsRow.is_publicly_visible !== true
    ) {
      return hidden;
    }

    const settings = asSettingsObject(settingsRow.settings);
    const accepting = settings.accepting_enquiries !== false;
    const translations = Array.isArray(
      settingsRow.venue_module_setting_translations,
    )
      ? settingsRow.venue_module_setting_translations
      : [];
    const headingEn =
      translations.find((row) => row.locale === "en")?.public_heading ?? null;
    const headingTh =
      translations.find((row) => row.locale === "th")?.public_heading ?? null;
    const heading = locale === "th" ? headingTh : headingEn;
    const instructionsRaw =
      locale === "th"
        ? String(settings.instructions_th ?? "")
        : String(settings.instructions_en ?? "");

    const leadTimeMinutes = asNonNegInt(settings.lead_time_minutes, 60);
    const horizonDays = asPositiveInt(settings.horizon_days, 90);
    const now = new Date();
    const minInstant = new Date(now.getTime() + leadTimeMinutes * 60_000);
    const maxInstant = new Date(now.getTime() + horizonDays * 86_400_000);
    const defaultInstant = new Date(
      Math.min(minInstant.getTime() + 86_400_000, maxInstant.getTime()),
    );

    return {
      available: true,
      accepting,
      heading: heading && heading.length > 0 ? heading : null,
      instructions: instructionsRaw.length > 0 ? instructionsRaw : null,
      timezone: venue.timezone,
      venueName: venue.name,
      venueSlug: venue.slug,
      minPartySize: asPositiveInt(settings.min_party_size, 1),
      maxPartySize: asPositiveInt(settings.max_party_size, 12),
      horizonDays,
      leadTimeMinutes,
      minLocal: venueInstantToLocalInput(minInstant, venue.timezone),
      maxLocal: venueInstantToLocalInput(maxInstant, venue.timezone),
      defaultLocal: venueInstantToLocalInput(defaultInstant, venue.timezone),
      contentClassification: venue.content_classification,
      availability: accepting ? "enabled" : "paused",
    };
  },
);

export async function loadAdminBookings(
  venueId: string,
  filter?: string,
): Promise<AdminBookingData> {
  const empty: AdminBookingData = {
    moduleState: "not_entitled",
    isEnabled: false,
    isPubliclyVisible: true,
    acceptingEnquiries: true,
    minPartySize: 1,
    maxPartySize: 12,
    horizonDays: 90,
    leadTimeMinutes: 60,
    headingEn: null,
    headingTh: null,
    instructionsEn: "",
    instructionsTh: "",
    timezone: "Asia/Bangkok",
    venueSlug: "",
    rows: [],
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();
  const bookingModule = await loadModuleAvailability(venueId);
  const { data: venue } = await supabase
    .from("venues")
    .select("timezone, slug")
    .eq("id", venueId)
    .maybeSingle();

  let rows: AdminBookingRow[] = [];
  const canReadQueue =
    bookingModule.moduleState === "enabled" ||
    bookingModule.moduleState === "trial" ||
    bookingModule.moduleState === "paused" ||
    bookingModule.moduleState === "restricted";

  if (canReadQueue) {
    let query = supabase
      .from("booking_requests")
      .select(
        "id, state, party_size, requested_for, locale, created_at, row_version, closure_outcome",
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (
      filter !== undefined &&
      (BOOKING_STATES as readonly string[]).includes(filter)
    ) {
      query = query.eq("state", filter);
    }

    const { data: requestRows } = await query;
    rows = (requestRows ?? []).map((row) => ({
      id: row.id,
      state: asState(row.state),
      partySize: row.party_size,
      requestedFor: row.requested_for,
      locale: row.locale === "th" ? "th" : "en",
      createdAt: row.created_at,
      rowVersion: row.row_version,
      closureOutcome: asOutcome(row.closure_outcome),
    }));
  }

  return {
    moduleState: bookingModule.moduleState,
    isEnabled: bookingModule.enabled,
    isPubliclyVisible: bookingModule.isPubliclyVisible,
    acceptingEnquiries: bookingModule.accepting,
    minPartySize: asPositiveInt(bookingModule.settings.min_party_size, 1),
    maxPartySize: asPositiveInt(bookingModule.settings.max_party_size, 12),
    horizonDays: asPositiveInt(bookingModule.settings.horizon_days, 90),
    leadTimeMinutes: asNonNegInt(bookingModule.settings.lead_time_minutes, 60),
    headingEn: bookingModule.headingEn,
    headingTh: bookingModule.headingTh,
    instructionsEn: String(bookingModule.settings.instructions_en ?? ""),
    instructionsTh: String(bookingModule.settings.instructions_th ?? ""),
    timezone: venue?.timezone ?? "Asia/Bangkok",
    venueSlug: venue?.slug ?? "",
    rows,
  };
}

export async function loadAdminBookingDetail(
  venueId: string,
  enquiryId: string,
  includeCustomer: boolean,
): Promise<AdminBookingDetail | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("booking_requests")
    .select(
      "id, venue_id, state, party_size, requested_for, locale, created_at, row_version, closure_outcome",
    )
    .eq("id", enquiryId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (data === null) {
    return null;
  }

  const { data: eventRows } = await supabase
    .from("booking_request_events")
    .select("created_at, action, from_state, to_state")
    .eq("booking_request_id", enquiryId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  const events: AdminBookingEvent[] = (eventRows ?? []).map((row) => ({
    occurredAt: row.created_at,
    action: row.action,
    fromState: row.from_state,
    toState: row.to_state,
  }));

  let contact: AdminBookingDetail["contact"] = null;
  if (includeCustomer) {
    const { data: contactRow } = await supabase
      .from("booking_request_contacts")
      .select("customer_display_name, customer_email, customer_message")
      .eq("booking_request_id", enquiryId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (contactRow !== null) {
      contact = {
        displayName: contactRow.customer_display_name,
        email: contactRow.customer_email,
        message: contactRow.customer_message,
      };
    }
  }

  return {
    id: data.id,
    venueId: data.venue_id,
    state: asState(data.state),
    partySize: data.party_size,
    requestedFor: data.requested_for,
    locale: data.locale === "th" ? "th" : "en",
    createdAt: data.created_at,
    rowVersion: data.row_version,
    closureOutcome: asOutcome(data.closure_outcome),
    contact,
    events,
  };
}
