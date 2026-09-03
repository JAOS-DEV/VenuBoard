import "server-only";

import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { AppLocale } from "@/core/i18n/routing";

import {
  ATMOSPHERE_MODULE_KEY,
  DEFAULT_ATMOSPHERE_EXPIRY_MINUTES,
  clampAtmosphereExpiryMinutes,
  isAtmosphereCurrent,
  isAtmosphereState,
  type AtmosphereExpiryMinutes,
  type AtmospherePresentation,
} from "./constants";
import type {
  AdminAtmosphereData,
  AtmosphereHistoryRow,
  AtmosphereSettingsView,
} from "./directory";
import { mapAtmosphereModuleAvailability } from "./module-state";
import { mapPublicAtmosphere, type PublicAtmosphereCard } from "./public-map";

export type { AdminAtmosphereData, PublicAtmosphereCard };

function asSettingsObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parsePresentation(value: unknown): AtmospherePresentation {
  if (value === "compact" || value === "badge" || value === "card") {
    return value;
  }
  return "card";
}

function parseExpiry(value: unknown): AtmosphereExpiryMinutes {
  if (typeof value === "number") {
    return clampAtmosphereExpiryMinutes(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return clampAtmosphereExpiryMinutes(Number(value));
  }
  return DEFAULT_ATMOSPHERE_EXPIRY_MINUTES;
}

function emptySettings(): AtmosphereSettingsView {
  return {
    isEnabled: false,
    isPubliclyVisible: true,
    defaultExpiryMinutes: DEFAULT_ATMOSPHERE_EXPIRY_MINUTES,
    frontOfHouseMayUpdate: false,
    presentation: "card",
    headingEn: "",
    headingTh: "",
  };
}

export async function loadPublicVenueAtmosphere(
  venueSlug: string,
  locale: AppLocale,
): Promise<PublicAtmosphereCard> {
  const hidden = mapPublicAtmosphere({ ok: true, available: false });
  if (getSupabaseConnection() === null) {
    return hidden;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_venue_atmosphere", {
    p_venue_slug: venueSlug,
    p_locale: locale,
  });

  if (error || data === null) {
    return hidden;
  }

  return mapPublicAtmosphere(data);
}

export async function loadAdminAtmosphere(
  venueId: string,
): Promise<AdminAtmosphereData> {
  const empty: AdminAtmosphereData = {
    moduleState: "not_entitled",
    current: null,
    currentIsLive: false,
    settings: emptySettings(),
    history: [],
    venueSlug: "",
  };

  if (getSupabaseConnection() === null) {
    return empty;
  }

  const supabase = await createSupabaseServerClient();

  const { data: venueRow } = await supabase
    .from("venues")
    .select("slug")
    .eq("id", venueId)
    .maybeSingle();

  const { data: settingsRow } = await supabase
    .from("venue_module_settings")
    .select("id, is_enabled, is_publicly_visible, settings")
    .eq("venue_id", venueId)
    .eq("module_key", ATMOSPHERE_MODULE_KEY)
    .maybeSingle();

  const { data: entitlementRows } = await supabase
    .from("venue_module_entitlements")
    .select("grant_type, source_key, ends_at, revoked_at")
    .eq("venue_id", venueId)
    .eq("module_key", ATMOSPHERE_MODULE_KEY);

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

  const rawSettings = asSettingsObject(settingsRow?.settings);
  const settings: AtmosphereSettingsView = {
    isEnabled: settingsRow?.is_enabled === true,
    isPubliclyVisible: settingsRow?.is_publicly_visible !== false,
    defaultExpiryMinutes: parseExpiry(rawSettings.default_expiry_minutes),
    frontOfHouseMayUpdate: rawSettings.front_of_house_may_update === true,
    presentation: parsePresentation(rawSettings.presentation),
    headingEn: "",
    headingTh: "",
  };

  if (settingsRow?.id !== undefined) {
    const { data: translations } = await supabase
      .from("venue_module_setting_translations")
      .select("locale, public_heading")
      .eq("venue_module_setting_id", settingsRow.id)
      .eq("venue_id", venueId);

    for (const row of translations ?? []) {
      if (row.locale === "en") {
        settings.headingEn = row.public_heading ?? "";
      }
      if (row.locale === "th") {
        settings.headingTh = row.public_heading ?? "";
      }
    }
  }

  const moduleState = mapAtmosphereModuleAvailability({
    entitled,
    enabled: settings.isEnabled,
    entitlementSource: trial ? "trial" : "plan",
    entitlementEnded: expired,
    subscriptionState: subscription?.state ?? null,
  });

  let current: AdminAtmosphereData["current"] = null;
  let history: AtmosphereHistoryRow[] = [];

  const readable =
    moduleState === "enabled" ||
    moduleState === "trial" ||
    moduleState === "restricted" ||
    moduleState === "entitled_disabled";

  if (readable) {
    const { data: currentRow } = await supabase
      .from("venue_atmosphere")
      .select("atmosphere_state, set_at, expires_at")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (currentRow !== null && isAtmosphereState(currentRow.atmosphere_state)) {
      current = {
        state: currentRow.atmosphere_state,
        setAt: currentRow.set_at,
        expiresAt: currentRow.expires_at,
      };
    }

    const { data: historyRows } = await supabase
      .from("venue_atmosphere_events")
      .select(
        "id, action, previous_state, new_state, expiry_minutes, changed_at",
      )
      .eq("venue_id", venueId)
      .order("changed_at", { ascending: false })
      .limit(20);

    history = (historyRows ?? []).flatMap((row) => {
      if (
        row.action !== "set" &&
        row.action !== "replace" &&
        row.action !== "clear"
      ) {
        return [];
      }
      const previous =
        row.previous_state !== null && isAtmosphereState(row.previous_state)
          ? row.previous_state
          : null;
      const next =
        row.new_state !== null && isAtmosphereState(row.new_state)
          ? row.new_state
          : null;
      return [
        {
          id: row.id,
          action: row.action,
          previousState: previous,
          newState: next,
          expiryMinutes:
            typeof row.expiry_minutes === "number"
              ? clampAtmosphereExpiryMinutes(row.expiry_minutes)
              : null,
          changedAt: row.changed_at,
        },
      ];
    });
  }

  return {
    moduleState,
    current,
    currentIsLive: current !== null && isAtmosphereCurrent(current.expiresAt),
    settings,
    history,
    venueSlug: venueRow?.slug ?? "",
  };
}
