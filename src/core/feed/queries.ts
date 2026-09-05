import "server-only";

import type { AuthenticatedActor } from "@/core/actors/types";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AppLocale } from "@/core/i18n/routing";

import {
  FEED_MODULE_KEY,
  FEED_PAGE_DEFAULT,
  type FeedLocale,
} from "./constants";
import type { AdminFeedData, AdminFeedDetail, AdminFeedRow } from "./directory";
import { mapFeedModuleAvailability } from "./module-state";
import { mapPublicVenueFeed } from "./public-map";
import type { PublicVenueFeedPayload } from "./public-types";
import { isSafeFeedCursor } from "./cursor";
import type { FeedPostState, FeedPostType } from "./constants";

function asState(value: string): FeedPostState {
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

function asType(value: string): FeedPostType {
  if (value === "announcement" || value === "notice") {
    return value;
  }
  return "update";
}

export async function loadPublicVenueFeed(
  venueSlug: string,
  locale: AppLocale,
  opts?: { limit?: number; cursor?: string | null },
): Promise<PublicVenueFeedPayload> {
  const fallbackLocale = (locale === "th" ? "th" : "en") as FeedLocale;
  if (getSupabaseConnection() === null) {
    return mapPublicVenueFeed({ ok: true, available: false }, fallbackLocale);
  }

  const cursor = opts?.cursor ?? null;
  if (cursor !== null && !isSafeFeedCursor(cursor)) {
    return {
      ...mapPublicVenueFeed(
        { ok: true, available: true, items: [] },
        fallbackLocale,
      ),
      available: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_public_venue_feed", {
    p_venue_slug: venueSlug,
    p_locale: locale,
    p_limit: opts?.limit ?? FEED_PAGE_DEFAULT,
    p_cursor: cursor ?? undefined,
  });

  if (error || data === null) {
    return mapPublicVenueFeed({ ok: true, available: false }, fallbackLocale);
  }

  return mapPublicVenueFeed(data, fallbackLocale);
}

export async function loadAdminFeed(
  actor: AuthenticatedActor,
  venueId: string,
  businessId: string,
  filter?: string,
  postType?: string,
): Promise<AdminFeedData> {
  const empty: AdminFeedData = {
    moduleState: "not_entitled",
    approvalRequired: false,
    homepagePreviewEnabled: true,
    homepagePreviewCount: 3,
    horizonDays: 365,
    displayDensity: "comfortable",
    headingEn: null,
    headingTh: null,
    isEnabled: false,
    isPubliclyVisible: true,
    rows: [],
    copyDestinations: [],
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();
  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select(
      "is_enabled, is_publicly_visible, settings, venue_module_setting_translations ( locale, public_heading )",
    )
    .eq("venue_id", venueId)
    .eq("module_key", FEED_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", FEED_MODULE_KEY);

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
  const moduleState = mapFeedModuleAvailability({
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

  let rows: AdminFeedRow[] = [];
  if (moduleState === "enabled" || moduleState === "trial") {
    let query = supabase
      .from("feed_posts")
      .select(
        "id, state, post_type, published_at, scheduled_for, is_pinned, approved_at, feed_post_translations ( locale, title )",
      )
      .eq("venue_id", venueId)
      .order("updated_at", { ascending: false })
      .limit(40);

    if (filter && filter !== "all") {
      query = query.eq("state", filter);
    }
    if (
      postType === "update" ||
      postType === "announcement" ||
      postType === "notice"
    ) {
      query = query.eq("post_type", postType);
    }

    const { data: postRows } = await query;
    rows = (postRows ?? []).map((row) => {
      const titles = Array.isArray(row.feed_post_translations)
        ? row.feed_post_translations
        : [];
      return {
        id: row.id,
        state: asState(row.state),
        postType: asType(row.post_type),
        titleEn: titles.find((t) => t.locale === "en")?.title ?? null,
        titleTh: titles.find((t) => t.locale === "th")?.title ?? null,
        publishedAt: row.published_at,
        scheduledFor: row.scheduled_for,
        isPinned: row.is_pinned,
        approvedAt: row.approved_at,
      };
    });
  }

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
    horizonDays:
      typeof settingsJson?.horizon_days === "number"
        ? settingsJson.horizon_days
        : 365,
    displayDensity:
      settingsJson?.display_density === "compact" ? "compact" : "comfortable",
    headingEn:
      translations.find((row) => row.locale === "en")?.public_heading ?? null,
    headingTh:
      translations.find((row) => row.locale === "th")?.public_heading ?? null,
    isEnabled: enabled,
    isPubliclyVisible: settingsRow?.is_publicly_visible !== false,
    rows,
    copyDestinations,
  };
}

export async function loadAdminFeedDetail(
  venueId: string,
  postId: string,
): Promise<AdminFeedDetail | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("feed_posts")
    .select(
      "id, venue_id, state, post_type, scheduled_for, published_at, submitted_by, approved_at, rejection_reason, is_pinned, archived_at, feed_post_translations ( locale, title, body )",
    )
    .eq("id", postId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (data === null) {
    return null;
  }

  const translations = Array.isArray(data.feed_post_translations)
    ? data.feed_post_translations
    : [];
  const en = translations.find((row) => row.locale === "en");
  const th = translations.find((row) => row.locale === "th");

  return {
    id: data.id,
    venueId: data.venue_id,
    state: asState(data.state),
    postType: asType(data.post_type),
    scheduledFor: data.scheduled_for,
    publishedAt: data.published_at,
    submittedBy: data.submitted_by,
    approvedAt: data.approved_at,
    rejectionReason: data.rejection_reason,
    isPinned: data.is_pinned,
    archivedAt: data.archived_at,
    titleEn: en?.title ?? null,
    bodyEn: en?.body ?? null,
    titleTh: th?.title ?? null,
    bodyTh: th?.body ?? null,
  };
}
