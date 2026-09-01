import "server-only";

import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import {
  mapCatalogueModules,
  mapCatalogueThemes,
  mapReservedSlugs,
  type OnboardingCatalogue,
} from "@/core/onboarding/catalogue-map";

export type {
  CatalogueModule,
  CatalogueTheme,
  OnboardingCatalogue,
} from "@/core/onboarding/catalogue-map";

const EMPTY: OnboardingCatalogue = {
  modules: [],
  themes: [],
  reservedSlugs: [],
  defaultQuotaBytes: null,
};

export async function loadOnboardingCatalogue(): Promise<OnboardingCatalogue> {
  if (getSupabaseConnection() === null) {
    return EMPTY;
  }

  const supabase = await createSupabaseServerClient();
  const [modules, themes, reserved, plan] = await Promise.all([
    supabase
      .from("modules")
      .select("key, name, description, is_core, sort_order")
      .eq("is_available", true)
      .order("sort_order"),
    supabase.from("branding_themes").select("key, name").order("sort_order"),
    supabase.from("reserved_venue_slugs").select("slug"),
    supabase
      .from("plans")
      .select("default_storage_quota_bytes")
      .eq("key", "standard")
      .maybeSingle(),
  ]);

  return {
    modules: mapCatalogueModules(modules.data ?? []),
    themes: mapCatalogueThemes(themes.data ?? []),
    reservedSlugs: mapReservedSlugs(reserved.data ?? []),
    defaultQuotaBytes: plan.data?.default_storage_quota_bytes ?? null,
  };
}
