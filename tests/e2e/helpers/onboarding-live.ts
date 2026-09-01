import { createHash } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_BRANDING } from "../../../src/core/onboarding/constants";
import {
  onboardingWizardSchema,
  toOnboardingPayload,
} from "../../../src/core/onboarding/schema";

export const LIVE_BUSINESS_NAME = "E2E Lotus Holdings";
export const LIVE_LEGAL_NAME = "E2E Lotus Holdings Co.";
export const LIVE_VENUE_NAME_EN = "E2E Lotus Pier";
export const LIVE_VENUE_NAME_TH = "ท่าดอกบัวอีทูอี";
export const LIVE_DESCRIPTION_EN = "A fictional riverside bar.";
export const LIVE_DESCRIPTION_TH = "บาร์ริมน้ำสมมติ";

export interface LiveOnboardingFacts {
  businessCount: number;
  venueCount: number;
  publicationState: string | null;
  classification: string | null;
  timezone: string | null;
  subscriptionVenueId: string | null;
  subscriptionState: string | null;
  trialEndsAt: string | null;
  entitledModules: string[];
  deniedModules: string[];
  quotaBytes: number | null;
  usedBytes: number | null;
  planQuotaBytes: number | null;
  primaryColor: string | null;
  themeKey: string | null;
  englishName: string | null;
  thaiName: string | null;
  invitationScope: string | null;
  invitationRole: string | null;
  invitationVenueId: string | null;
  tokenHash: string | null;
  tokenHashLooksHashed: boolean;
  tokenHashMatches: boolean;
  rawTokenStored: boolean;
  summaryHasToken: boolean;
  auditHasToken: boolean;
}

function loadLocalKeys(): {
  url: string;
  publishable: string;
} | null {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (
    url === undefined ||
    url.length === 0 ||
    publishable === undefined ||
    publishable.length === 0
  ) {
    return null;
  }
  return { url, publishable };
}

async function signedInAdminClient(
  email: string,
  password: string,
): Promise<SupabaseClient | null> {
  const keys = loadLocalKeys();
  if (keys === null) {
    return null;
  }
  const client = createClient(keys.url, keys.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error !== null) {
    return null;
  }
  return client;
}

export function invitationTokenHash(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function liveOnboardingPayload(
  slug: string,
  ownerEmail: string,
  idempotencyKey: string,
): Record<string, unknown> {
  const parsed = onboardingWizardSchema.parse({
    idempotencyKey,
    business: {
      name: LIVE_BUSINESS_NAME,
      legalName: LIVE_LEGAL_NAME,
      country: "TH",
      defaultLocale: "en",
    },
    venue: {
      nameEn: LIVE_VENUE_NAME_EN,
      nameTh: LIVE_VENUE_NAME_TH,
      descriptionEn: LIVE_DESCRIPTION_EN,
      descriptionTh: LIVE_DESCRIPTION_TH,
      slug,
      timezone: "Asia/Bangkok",
      defaultLocale: "en",
      supportedLocales: ["en", "th"],
      contentClassification: "general",
      classificationLocked: false,
    },
    branding: { ...DEFAULT_BRANDING },
    trial: {
      days: 30,
      extensionDays: 0,
      excludedModuleKeys: ["offers"],
      individualModuleTrials: [],
      quotaBytes: null,
    },
    overrides: [],
    owner: { email: ownerEmail },
  });
  return toOnboardingPayload(parsed);
}

export async function loadLiveOnboardingFacts(
  slug: string,
  rawToken: string,
  credentials: { email: string; password: string },
): Promise<LiveOnboardingFacts | null> {
  const supabase = await signedInAdminClient(
    credentials.email,
    credentials.password,
  );
  if (supabase === null) {
    return null;
  }

  const venues = await supabase
    .from("venues")
    .select(
      "id, business_id, publication_state, content_classification, timezone, name",
    )
    .eq("slug", slug);
  if (venues.error !== null) {
    return null;
  }
  const venue = venues.data?.[0] ?? null;
  const businesses = await supabase
    .from("businesses")
    .select("id")
    .eq("name", LIVE_BUSINESS_NAME);

  if (venue === null) {
    return {
      businessCount: businesses.data?.length ?? 0,
      venueCount: venues.data?.length ?? 0,
      publicationState: null,
      classification: null,
      timezone: null,
      subscriptionVenueId: null,
      subscriptionState: null,
      trialEndsAt: null,
      entitledModules: [],
      deniedModules: [],
      quotaBytes: null,
      usedBytes: null,
      planQuotaBytes: null,
      primaryColor: null,
      themeKey: null,
      englishName: null,
      thaiName: null,
      invitationScope: null,
      invitationRole: null,
      invitationVenueId: null,
      tokenHash: null,
      tokenHashLooksHashed: false,
      tokenHashMatches: false,
      rawTokenStored: false,
      summaryHasToken: false,
      auditHasToken: false,
    };
  }

  const [
    subscription,
    entitlements,
    storage,
    plan,
    branding,
    translations,
    invitations,
    runs,
    audits,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("venue_id, state, trial_ends_at, plan_id")
      .eq("venue_id", venue.id)
      .maybeSingle(),
    supabase
      .from("venue_module_entitlements")
      .select("module_key, grant_type")
      .eq("venue_id", venue.id)
      .is("revoked_at", null),
    supabase
      .from("venue_storage_usage")
      .select("quota_bytes, used_bytes")
      .eq("venue_id", venue.id)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("default_storage_quota_bytes")
      .eq("key", "standard")
      .maybeSingle(),
    supabase
      .from("venue_branding")
      .select("primary_color, theme_key")
      .eq("venue_id", venue.id)
      .maybeSingle(),
    supabase
      .from("venue_translations")
      .select("locale, name")
      .eq("venue_id", venue.id),
    supabase
      .from("invitations")
      .select("scope_type, role, venue_id, token_hash")
      .eq("business_id", venue.business_id)
      .eq("scope_type", "business"),
    supabase
      .from("platform_onboarding_runs")
      .select("result_summary")
      .eq("venue_id", venue.id),
    supabase
      .from("audit_log")
      .select("summary, metadata")
      .eq("venue_id", venue.id),
  ]);

  const invitation = invitations.data?.[0] ?? null;
  const expectedHash = invitationTokenHash(rawToken);
  const summaryText = JSON.stringify(runs.data ?? []);
  const auditText = JSON.stringify(audits.data ?? []);
  const hash = invitation?.token_hash ?? null;

  return {
    businessCount: businesses.data?.length ?? 0,
    venueCount: venues.data?.length ?? 0,
    publicationState: venue.publication_state,
    classification: venue.content_classification,
    timezone: venue.timezone,
    subscriptionVenueId: subscription.data?.venue_id ?? null,
    subscriptionState: subscription.data?.state ?? null,
    trialEndsAt: subscription.data?.trial_ends_at ?? null,
    entitledModules: (entitlements.data ?? [])
      .filter((row) => row.grant_type === "allow")
      .map((row) => row.module_key),
    deniedModules: (entitlements.data ?? [])
      .filter((row) => row.grant_type === "deny")
      .map((row) => row.module_key),
    quotaBytes: storage.data?.quota_bytes ?? null,
    usedBytes: storage.data?.used_bytes ?? null,
    planQuotaBytes: plan.data?.default_storage_quota_bytes ?? null,
    primaryColor: branding.data?.primary_color ?? null,
    themeKey: branding.data?.theme_key ?? null,
    englishName:
      translations.data?.find((row) => row.locale === "en")?.name ?? null,
    thaiName:
      translations.data?.find((row) => row.locale === "th")?.name ?? null,
    invitationScope: invitation?.scope_type ?? null,
    invitationRole: invitation?.role ?? null,
    invitationVenueId: invitation?.venue_id ?? null,
    tokenHash: hash,
    tokenHashLooksHashed: hash !== null && /^[0-9a-f]{64}$/.test(hash),
    tokenHashMatches: hash === expectedHash,
    rawTokenStored: hash === rawToken,
    summaryHasToken:
      summaryText.includes(rawToken) ||
      summaryText.includes("invitation_token"),
    auditHasToken: auditText.includes(rawToken),
  };
}

export async function retryLiveOnboarding(input: {
  email: string;
  password: string;
  idempotencyKey: string;
  slug: string;
  ownerEmail: string;
}): Promise<{ ok: boolean; idempotent: boolean; hasToken: boolean } | null> {
  const keys = loadLocalKeys();
  if (keys === null) {
    return null;
  }

  const client = createClient(keys.url, keys.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError !== null) {
    return null;
  }

  const { data, error } = await client.rpc("onboard_platform_venue", {
    p_idempotency_key: input.idempotencyKey,
    p_payload: liveOnboardingPayload(
      input.slug,
      input.ownerEmail,
      input.idempotencyKey,
    ),
  });
  if (error !== null || data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  return {
    ok: record.ok === true,
    idempotent: record.idempotent === true,
    hasToken: typeof record.invitation_token === "string",
  };
}

export function trialWindowLooksStandard(trialEndsAt: string | null): boolean {
  if (trialEndsAt === null) {
    return false;
  }
  const ends = Date.parse(trialEndsAt);
  if (Number.isNaN(ends)) {
    return false;
  }
  const deltaDays = (ends - Date.now()) / 86_400_000;
  return deltaDays > 29 && deltaDays < 31;
}
