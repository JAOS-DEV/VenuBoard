import "server-only";

import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";

const LIST_LIMIT = 50;

export interface PlatformVenueListItem {
  venueId: string;
  businessId: string;
  businessName: string;
  venueName: string;
  slug: string;
  publicationState: string;
  classification: string;
  createdAt: string;
}

export interface PlatformVenueOverview {
  venueId: string;
  businessId: string;
  businessName: string;
  venueName: string;
  slug: string;
  publicationState: string;
  classification: string;
  timezone: string;
  subscriptionState: string | null;
  trialEndsAt: string | null;
  entitledModules: string[];
  deniedModules: string[];
  quotaBytes: number | null;
  usedBytes: number | null;
  invitationState: string | null;
  invitationEmail: string | null;
  branding: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    themeKey: string;
  } | null;
  auditSummaries: string[];
}

function businessNameFromEmbed(
  business: { name: string } | { name: string }[] | null,
): string {
  if (business === null) {
    return "";
  }
  if (Array.isArray(business)) {
    return business[0]?.name ?? "";
  }
  return business.name;
}

export async function listPlatformVenues(): Promise<PlatformVenueListItem[]> {
  if (getSupabaseConnection() === null) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("venues")
    .select(
      "id, business_id, name, slug, publication_state, content_classification, created_at, businesses(name)",
    )
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  return (data ?? []).map((row) => ({
    venueId: row.id,
    businessId: row.business_id,
    businessName: businessNameFromEmbed(
      row.businesses as { name: string } | { name: string }[] | null,
    ),
    venueName: row.name,
    slug: row.slug,
    publicationState: row.publication_state,
    classification: row.content_classification,
    createdAt: row.created_at,
  }));
}

export function platformVenueListLimit(): number {
  return LIST_LIMIT;
}

export async function loadPlatformVenueOverview(
  venueId: string,
): Promise<PlatformVenueOverview | null> {
  if (getSupabaseConnection() === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: venue } = await supabase
    .from("venues")
    .select(
      "id, business_id, name, slug, publication_state, content_classification, timezone, businesses(name)",
    )
    .eq("id", venueId)
    .maybeSingle();

  if (venue === null) {
    return null;
  }

  const [subscription, entitlements, storage, invitations, branding, audits] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("state, trial_ends_at")
        .eq("venue_id", venueId)
        .maybeSingle(),
      supabase
        .from("venue_module_entitlements")
        .select("module_key, grant_type")
        .eq("venue_id", venueId)
        .is("revoked_at", null),
      supabase
        .from("venue_storage_usage")
        .select("quota_bytes, used_bytes")
        .eq("venue_id", venueId)
        .maybeSingle(),
      supabase
        .from("invitations")
        .select("state, email")
        .eq("business_id", venue.business_id)
        .eq("scope_type", "business")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("venue_branding")
        .select("primary_color, background_color, text_color, theme_key")
        .eq("venue_id", venueId)
        .maybeSingle(),
      supabase
        .from("audit_log")
        .select("summary")
        .eq("venue_id", venueId)
        .order("occurred_at", { ascending: false })
        .limit(5),
    ]);

  const invitation = invitations.data?.[0] ?? null;
  const entitled = (entitlements.data ?? [])
    .filter((row) => row.grant_type === "allow")
    .map((row) => row.module_key);
  const denied = (entitlements.data ?? [])
    .filter((row) => row.grant_type === "deny")
    .map((row) => row.module_key);

  return {
    venueId: venue.id,
    businessId: venue.business_id,
    businessName: businessNameFromEmbed(
      venue.businesses as { name: string } | { name: string }[] | null,
    ),
    venueName: venue.name,
    slug: venue.slug,
    publicationState: venue.publication_state,
    classification: venue.content_classification,
    timezone: venue.timezone,
    subscriptionState: subscription.data?.state ?? null,
    trialEndsAt: subscription.data?.trial_ends_at ?? null,
    entitledModules: entitled,
    deniedModules: denied,
    quotaBytes: storage.data?.quota_bytes ?? null,
    usedBytes: storage.data?.used_bytes ?? null,
    invitationState: invitation?.state ?? null,
    invitationEmail: invitation?.email ?? null,
    branding:
      branding.data === null || branding.data === undefined
        ? null
        : {
            primaryColor: branding.data.primary_color,
            backgroundColor: branding.data.background_color,
            textColor: branding.data.text_color,
            themeKey: branding.data.theme_key,
          },
    auditSummaries: (audits.data ?? [])
      .map((row) => row.summary)
      .filter((summary): summary is string => summary !== null),
  };
}
