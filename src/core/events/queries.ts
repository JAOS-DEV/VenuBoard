import "server-only";

import type { AppLocale } from "@/core/i18n/routing";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AuthenticatedActor } from "@/core/actors/types";
import type { PublicEventItem, PublicVenueEventsPayload } from "./public-types";
import { mapPublicVenueEvents } from "./public-map";
import type { PublicVenueEventsView } from "./constants";
import { type EventLocale } from "./constants";
import { EVENTS_MODULE_KEY } from "./constants";
import { mapEventsModuleAvailability } from "./module-state";
import type { AdminEventsData, AdminEventRow } from "./directory";

export async function loadPublicVenueEvents(
  venueSlug: string,
  locale: AppLocale,
  view: PublicVenueEventsView,
  opts?: {
    month?: string | null; // YYYY-MM
    limit?: number;
    offset?: number;
  },
): Promise<PublicVenueEventsPayload> {
  if (getSupabaseConnection() === null) {
    const fallbackLocale = (locale === "th" ? "th" : "en") as EventLocale;
    return mapPublicVenueEvents({ ok: true, available: false }, fallbackLocale);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_public_venue_events", {
    p_venue_slug: venueSlug,
    p_locale: locale,
    p_view: view,
    p_month: opts?.month ?? undefined,
    p_limit: opts?.limit ?? 48,
    p_offset: opts?.offset ?? 0,
  });

  if (error || data === null) {
    const fallbackLocale = (locale === "th" ? "th" : "en") as EventLocale;
    return mapPublicVenueEvents({ ok: true, available: false }, fallbackLocale);
  }

  const fallbackLocale = (locale === "th" ? "th" : "en") as EventLocale;
  return mapPublicVenueEvents(data, fallbackLocale);
}

export async function loadPublicVenueUpcomingEvents(
  venueSlug: string,
  locale: AppLocale,
): Promise<PublicVenueEventsPayload> {
  return loadPublicVenueEvents(venueSlug, locale, "upcoming", {
    limit: 48,
    offset: 0,
  });
}

export async function loadPublicVenueArchiveEvents(
  venueSlug: string,
  locale: AppLocale,
): Promise<PublicVenueEventsPayload> {
  return loadPublicVenueEvents(venueSlug, locale, "archive", {
    limit: 48,
    offset: 0,
  });
}

export function mergeEventItems(
  upcoming: PublicEventItem[],
  archive: PublicEventItem[],
): PublicEventItem[] {
  const all = [...upcoming, ...archive];
  return all.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function loadAdminEvents(
  actor: AuthenticatedActor,
  venueId: string,
  businessId: string,
  filter?: string,
): Promise<AdminEventsData> {
  const empty: AdminEventsData = {
    moduleState: "not_entitled",
    approvalRequired: false,
    venueTimezone: "UTC",
    rows: [],
    copyDestinations: [],
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();

  // Fetch venue timezone
  const { data: venueRow } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", venueId)
    .maybeSingle();

  const venueTimezone = venueRow?.timezone ?? "UTC";

  // Fetch module state
  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select("is_enabled, settings")
    .eq("venue_id", venueId)
    .eq("module_key", EVENTS_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", EVENTS_MODULE_KEY);

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

  const enabled = settingsRow?.is_enabled === true;
  const moduleState = mapEventsModuleAvailability({
    entitled,
    enabled,
    entitlementSource: trial ? "trial" : "plan",
    entitlementEnded: expired,
    subscriptionState: subscription?.state ?? null,
  });

  // Derive approvalRequired server-side from settings JSON
  const settingsJson =
    settingsRow?.settings !== null &&
    typeof settingsRow?.settings === "object" &&
    !Array.isArray(settingsRow?.settings)
      ? (settingsRow.settings as Record<string, unknown>)
      : null;
  const approvalRequired = settingsJson?.require_manager_approval === true;

  // Load events if module is accessible
  let rows: AdminEventRow[] = [];
  if (moduleState === "enabled" || moduleState === "trial") {
    let query = supabase
      .from("events")
      .select(
        "id, state, approval_status, starts_at, ends_at, timezone, publish_at, cancelled_at, archived_at, event_translations ( locale, title )",
      )
      .eq("venue_id", venueId)
      .order("starts_at", { ascending: false })
      .limit(20);

    if (filter && filter !== "all") {
      query = query.eq("state", filter);
    }

    const { data: eventRows } = await query;

    rows = (eventRows ?? []).map((row) => {
      const translations = Array.isArray(row.event_translations)
        ? row.event_translations
        : [];
      return {
        id: row.id,
        state: row.state,
        approvalStatus: row.approval_status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timezone: row.timezone,
        titleEn: translations.find((t) => t.locale === "en")?.title ?? null,
        titleTh: translations.find((t) => t.locale === "th")?.title ?? null,
        publishAt: row.publish_at,
        cancelledAt: row.cancelled_at,
        archivedAt: row.archived_at,
      };
    });
  }

  // Copy destinations: same-business venues the actor can create in
  const allowedBusinessIds = new Set(
    actor.businessMemberships.map((row) => row.businessId),
  );
  const allowedVenueIds = new Set(
    actor.venueMemberships.map((row) => row.venueId),
  );

  const { data: allVenues } = await supabase
    .from("venues")
    .select("id, name, business_id")
    .eq("business_id", businessId)
    .neq("id", venueId)
    .order("name");

  const copyDestinations = (allVenues ?? [])
    .filter(
      (v) => allowedBusinessIds.has(v.business_id) || allowedVenueIds.has(v.id),
    )
    .map((v) => ({ id: v.id, name: v.name, businessId: v.business_id }));

  return {
    moduleState,
    approvalRequired,
    venueTimezone,
    rows,
    copyDestinations,
  };
}

export async function loadAdminEventDetail(
  venueId: string,
  eventId: string,
): Promise<{
  id: string;
  state: string;
  approvalStatus: string;
  rejectionReason: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  publishAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  posterStoragePath: string | null;
  titleEn: string | null;
  summaryEn: string | null;
  descriptionEn: string | null;
  ctaLabelEn: string | null;
  titleTh: string | null;
  summaryTh: string | null;
  descriptionTh: string | null;
  ctaLabelTh: string | null;
} | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("events")
    .select(
      "id, state, approval_status, rejection_reason, starts_at, ends_at, timezone, is_all_day, publish_at, cancelled_at, archived_at, poster_storage_path, event_translations ( locale, title, summary, description, cta_label )",
    )
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error || row === null) {
    return null;
  }

  const translations = Array.isArray(row.event_translations)
    ? row.event_translations
    : [];
  const en = translations.find((t) => t.locale === "en");
  const th = translations.find((t) => t.locale === "th");

  return {
    id: row.id,
    state: row.state,
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    isAllDay: row.is_all_day,
    publishAt: row.publish_at,
    cancelledAt: row.cancelled_at,
    archivedAt: row.archived_at,
    posterStoragePath: row.poster_storage_path,
    titleEn: en?.title ?? null,
    summaryEn: en?.summary ?? null,
    descriptionEn: en?.description ?? null,
    ctaLabelEn: en?.cta_label ?? null,
    titleTh: th?.title ?? null,
    summaryTh: th?.summary ?? null,
    descriptionTh: th?.description ?? null,
    ctaLabelTh: th?.cta_label ?? null,
  };
}
