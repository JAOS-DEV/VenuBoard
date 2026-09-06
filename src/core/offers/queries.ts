import "server-only";

import { cache } from "react";

import type { AuthenticatedActor } from "@/core/actors/types";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AppLocale } from "@/core/i18n/routing";

import {
  OFFERS_MODULE_KEY,
  OFFER_PAGE_DEFAULT,
  type OfferLocale,
  type OfferState,
} from "./constants";
import type {
  AdminOfferDetail,
  AdminOfferHistoryRow,
  AdminOfferRow,
  AdminOffersData,
} from "./directory";
import { mapOffersModuleAvailability } from "./module-state";
import { mapPublicVenueOffers } from "./public-map";
import type { PublicVenueOffersPayload } from "./public-types";
import { isSafeOfferCursor } from "./cursor";

function asState(value: string): OfferState {
  if (
    value === "pending_approval" ||
    value === "scheduled" ||
    value === "published" ||
    value === "archived"
  ) {
    return value;
  }
  return "draft";
}

export const loadPublicVenueOffers = cache(async function loadPublicVenueOffers(
  venueSlug: string,
  locale: AppLocale,
  opts?: { limit?: number; cursor?: string | null },
): Promise<PublicVenueOffersPayload> {
  const fallbackLocale = (locale === "th" ? "th" : "en") as OfferLocale;
  if (getSupabaseConnection() === null) {
    return mapPublicVenueOffers({ ok: true, available: false }, fallbackLocale);
  }

  const cursor = opts?.cursor ?? null;
  if (cursor !== null && !isSafeOfferCursor(cursor)) {
    return {
      ...mapPublicVenueOffers(
        { ok: true, available: true, items: [] },
        fallbackLocale,
      ),
      available: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_public_venue_offers", {
    p_venue_slug: venueSlug,
    p_locale: locale,
    p_limit: opts?.limit ?? OFFER_PAGE_DEFAULT,
    p_cursor: cursor ?? undefined,
  });

  if (error || data === null) {
    return mapPublicVenueOffers({ ok: true, available: false }, fallbackLocale);
  }

  return mapPublicVenueOffers(data, fallbackLocale);
});

export async function loadAdminOffers(
  _actor: AuthenticatedActor,
  venueId: string,
  filter?: string,
): Promise<AdminOffersData> {
  const empty: AdminOffersData = {
    moduleState: "not_entitled",
    approvalRequired: false,
    homepagePreviewEnabled: true,
    homepagePreviewCount: 3,
    headingEn: null,
    headingTh: null,
    isEnabled: false,
    isPubliclyVisible: true,
    timezone: "UTC",
    rows: [],
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();
  const { data: venueRow } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", venueId)
    .maybeSingle();

  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select(
      "is_enabled, is_publicly_visible, settings, venue_module_setting_translations ( locale, public_heading )",
    )
    .eq("venue_id", venueId)
    .eq("module_key", OFFERS_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", OFFERS_MODULE_KEY);

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
  const moduleState = mapOffersModuleAvailability({
    entitled,
    enabled,
    entitlementSource: trial ? "trial" : "plan",
    entitlementEnded: expired,
    subscriptionState: subscription?.state ?? null,
  });

  const settingsJson =
    settingsRow?.settings !== null &&
    typeof settingsRow?.settings === "object" &&
    !Array.isArray(settingsRow?.settings)
      ? (settingsRow.settings as Record<string, unknown>)
      : null;

  const translations = Array.isArray(
    settingsRow?.venue_module_setting_translations,
  )
    ? settingsRow.venue_module_setting_translations
    : [];

  let rows: AdminOfferRow[] = [];
  if (moduleState === "enabled" || moduleState === "trial") {
    let query = supabase
      .from("offers")
      .select(
        "id, state, valid_from, valid_until, published_at, scheduled_for, approved_at, platform_quarantined_at, offer_translations ( locale, title )",
      )
      .eq("venue_id", venueId)
      .order("updated_at", { ascending: false })
      .limit(40);

    if (filter && filter !== "all") {
      query = query.eq("state", filter);
    }

    const { data: offerRows } = await query;
    rows = (offerRows ?? []).map((row) => {
      const titles = Array.isArray(row.offer_translations)
        ? row.offer_translations
        : [];
      return {
        id: row.id,
        state: asState(row.state),
        titleEn: titles.find((t) => t.locale === "en")?.title ?? null,
        titleTh: titles.find((t) => t.locale === "th")?.title ?? null,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        publishedAt: row.published_at,
        scheduledFor: row.scheduled_for,
        approvedAt: row.approved_at,
        quarantined: row.platform_quarantined_at !== null,
      };
    });
  }

  const previewCount =
    typeof settingsJson?.homepage_preview_count === "number"
      ? settingsJson.homepage_preview_count
      : 3;

  return {
    moduleState,
    approvalRequired: settingsJson?.require_manager_approval === true,
    homepagePreviewEnabled: settingsJson?.homepage_preview_enabled !== false,
    homepagePreviewCount:
      previewCount >= 1 && previewCount <= 6 ? previewCount : 3,
    headingEn:
      translations.find((row) => row.locale === "en")?.public_heading ?? null,
    headingTh:
      translations.find((row) => row.locale === "th")?.public_heading ?? null,
    isEnabled: enabled,
    isPubliclyVisible: settingsRow?.is_publicly_visible !== false,
    timezone: venueRow?.timezone ?? "UTC",
    rows,
  };
}

export async function loadAdminOfferDetail(
  venueId: string,
  offerId: string,
): Promise<AdminOfferDetail | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("offers")
    .select(
      "id, venue_id, state, scheduled_for, published_at, approved_at, rejection_reason, archived_at, platform_quarantined_at, valid_from, valid_until, offer_translations ( locale, title, description, terms )",
    )
    .eq("id", offerId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (data === null) {
    return null;
  }

  const translations = Array.isArray(data.offer_translations)
    ? data.offer_translations
    : [];
  const en = translations.find((row) => row.locale === "en");
  const th = translations.find((row) => row.locale === "th");

  const { data: eventRows } = await supabase
    .from("offer_events")
    .select("action, from_state, to_state, created_at")
    .eq("offer_id", offerId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(20);

  const history: AdminOfferHistoryRow[] = (eventRows ?? []).map((row) => ({
    action: row.action,
    fromState: row.from_state,
    toState: row.to_state,
    createdAt: row.created_at,
  }));

  return {
    id: data.id,
    venueId: data.venue_id,
    state: asState(data.state),
    scheduledFor: data.scheduled_for,
    publishedAt: data.published_at,
    approvedAt: data.approved_at,
    rejectionReason: data.rejection_reason,
    archivedAt: data.archived_at,
    quarantined: data.platform_quarantined_at !== null,
    validFrom: data.valid_from,
    validUntil: data.valid_until,
    titleEn: en?.title ?? null,
    descriptionEn: en?.description ?? null,
    termsEn: en?.terms ?? null,
    titleTh: th?.title ?? null,
    descriptionTh: th?.description ?? null,
    termsTh: th?.terms ?? null,
    history,
  };
}
