import "server-only";

import { can } from "@/core/authz/can";
import type { AuthenticatedActor } from "@/core/actors/types";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import type { AppLocale } from "@/core/i18n/routing";
import { STAFF_MODULE_KEY } from "./constants";
import type {
  AdminStaffRow,
  AdminVenueOption,
  StaffDirectoryData,
} from "./directory";
import { effectivePresenceState } from "./expiry";
import { mapStaffModuleAvailability } from "./module-state";
import {
  mapPublicStaffCarousel,
  parseStaffModuleSettings,
  type PublicStaffCarousel,
} from "./public-map";

export type { AdminStaffRow, AdminVenueOption, StaffDirectoryData };

export async function listAdminVenues(
  actor: AuthenticatedActor,
): Promise<AdminVenueOption[]> {
  if (getSupabaseConnection() === null) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, business_id, name, slug")
    .order("name");

  if (error || data === null) {
    return [];
  }

  const allowedVenueIds = new Set(
    actor.venueMemberships.map((row) => row.venueId),
  );
  const allowedBusinessIds = new Set(
    actor.businessMemberships.map((row) => row.businessId),
  );

  return data
    .filter(
      (row) =>
        allowedVenueIds.has(row.id) || allowedBusinessIds.has(row.business_id),
    )
    .map((row) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      slug: row.slug,
    }));
}

export async function loadPublicStaffCarousel(
  venueSlug: string,
  locale: AppLocale,
): Promise<PublicStaffCarousel> {
  if (getSupabaseConnection() === null) {
    return mapPublicStaffCarousel({ ok: true, available: false }, locale);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_public_staff_presence", {
    p_venue_slug: venueSlug,
    p_locale: locale,
    p_limit: 24,
    p_offset: 0,
  });

  if (error) {
    return mapPublicStaffCarousel({ ok: true, available: false }, locale);
  }

  return mapPublicStaffCarousel(data, locale);
}

export async function loadPublicVenueSnapshot(venueSlug: string): Promise<{
  id: string;
  name: string;
  slug: string;
  contentClassification: string;
  branding: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  } | null;
} | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("venues")
    .select(
      "id, name, slug, content_classification, venue_branding ( primary_color, background_color, text_color, accent_color )",
    )
    .eq("slug", venueSlug)
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  const branding = Array.isArray(data.venue_branding)
    ? data.venue_branding[0]
    : data.venue_branding;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    contentClassification: data.content_classification,
    branding:
      branding === null || branding === undefined
        ? null
        : {
            primaryColor: branding.primary_color,
            backgroundColor: branding.background_color,
            textColor: branding.text_color,
            accentColor: branding.accent_color,
          },
  };
}

export async function loadStaffDirectory(
  actor: AuthenticatedActor,
  venueId: string,
  businessId: string,
): Promise<StaffDirectoryData> {
  const empty: StaffDirectoryData = {
    moduleState: "not_entitled",
    entitled: false,
    enabled: false,
    publiclyVisible: false,
    settings: parseStaffModuleSettings(null),
    headingEn: null,
    headingTh: null,
    rows: [],
    assignableMembers: [],
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();
  const scope = { type: "venue" as const, venueId, businessId };

  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select(
      "is_enabled, is_publicly_visible, settings, venue_module_setting_translations ( locale, public_heading )",
    )
    .eq("venue_id", venueId)
    .eq("module_key", STAFF_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", STAFF_MODULE_KEY);

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
  const moduleState = mapStaffModuleAvailability({
    entitled,
    enabled,
    entitlementSource: trial ? "trial" : "plan",
    entitlementEnded: expired,
    subscriptionState: subscription?.state ?? null,
  });

  const translations = Array.isArray(
    settingsRow?.venue_module_setting_translations,
  )
    ? settingsRow.venue_module_setting_translations
    : [];

  const headingEn =
    translations.find((row) => row.locale === "en")?.public_heading ?? null;
  const headingTh =
    translations.find((row) => row.locale === "th")?.public_heading ?? null;

  const canViewPrivate = can(actor, "view_private_staff_data", scope);
  const canManage = can(actor, "manage_public_staff_profiles", scope);

  const { data: profileRows } = await supabase
    .from("staff_public_profiles")
    .select(
      "id, staff_member_id, public_display_name, public_title, display_order, assignment_status, publication_state, consent_state, staff_members ( id, internal_display_name, status, user_id ), current_staff_presence ( state, presence_expires_at ), staff_public_profile_translations ( locale, public_bio )",
    )
    .eq("venue_id", venueId)
    .order("display_order");

  const rows: AdminStaffRow[] = (profileRows ?? []).map((row) => {
    const member = Array.isArray(row.staff_members)
      ? row.staff_members[0]
      : row.staff_members;
    const presence = Array.isArray(row.current_staff_presence)
      ? row.current_staff_presence[0]
      : row.current_staff_presence;
    const bios = Array.isArray(row.staff_public_profile_translations)
      ? row.staff_public_profile_translations
      : [];
    const presenceState = effectivePresenceState(
      presence?.state === "present" ? "present" : "not_present",
      presence?.presence_expires_at ?? null,
    );

    return {
      profileId: row.id,
      staffMemberId: row.staff_member_id,
      internalDisplayName: canViewPrivate
        ? (member?.internal_display_name ?? null)
        : null,
      publicDisplayName: row.public_display_name,
      publicTitle: row.public_title,
      bioEn: bios.find((item) => item.locale === "en")?.public_bio ?? null,
      bioTh: bios.find((item) => item.locale === "th")?.public_bio ?? null,
      assignmentStatus: row.assignment_status,
      publicationState: row.publication_state,
      consentState:
        row.consent_state === "granted" || row.consent_state === "withdrawn"
          ? row.consent_state
          : "pending",
      staffStatus: member?.status ?? "active",
      linkedUserId: member?.user_id ?? null,
      displayOrder: row.display_order,
      presenceState,
      presenceExpiresAt: presence?.presence_expires_at ?? null,
    };
  });

  let assignableMembers: StaffDirectoryData["assignableMembers"] = [];
  if (canManage) {
    const { data: members } = await supabase
      .from("staff_members")
      .select("id, internal_display_name, status")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("internal_display_name");

    const assigned = new Set(rows.map((row) => row.staffMemberId));
    assignableMembers = (members ?? []).map((member) => ({
      id: member.id,
      internalDisplayName: member.internal_display_name,
      alreadyAssigned: assigned.has(member.id),
    }));
  }

  return {
    moduleState,
    entitled,
    enabled,
    publiclyVisible: settingsRow?.is_publicly_visible === true,
    settings: parseStaffModuleSettings(settingsRow?.settings as Json | null),
    headingEn,
    headingTh,
    rows,
    assignableMembers,
  };
}
