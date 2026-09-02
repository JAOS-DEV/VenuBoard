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

export interface LiveOnboardingIdentity {
  slug: string;
  ownerEmail: string;
  businessName: string;
  legalName: string;
}

export interface LiveOnboardingFacts {
  businessId: string | null;
  venueId: string | null;
  businessCount: number;
  venueCount: number;
  onboardingRunCount: number;
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

export interface LiveOnboardingRetryResult {
  ok: boolean;
  idempotent: boolean;
  hasToken: boolean;
  businessId: string | null;
  venueId: string | null;
}

const EMPTY_FACTS: LiveOnboardingFacts = {
  businessId: null,
  venueId: null,
  businessCount: 0,
  venueCount: 0,
  onboardingRunCount: 0,
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

export function liveOnboardingIdentity(suffix: string): LiveOnboardingIdentity {
  return {
    slug: `e2e-pier-${suffix}`,
    ownerEmail: `owner.${suffix}@example.com`,
    businessName: `E2E Lotus Holdings ${suffix}`,
    legalName: `E2E Lotus Holdings ${suffix} Co.`,
  };
}

export function liveOnboardingPayload(
  identity: LiveOnboardingIdentity,
  idempotencyKey: string,
): Record<string, unknown> {
  const parsed = onboardingWizardSchema.parse({
    idempotencyKey,
    business: {
      name: identity.businessName,
      legalName: identity.legalName,
      country: "TH",
      defaultLocale: "en",
    },
    venue: {
      nameEn: LIVE_VENUE_NAME_EN,
      nameTh: LIVE_VENUE_NAME_TH,
      descriptionEn: LIVE_DESCRIPTION_EN,
      descriptionTh: LIVE_DESCRIPTION_TH,
      slug: identity.slug,
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
    owner: { email: identity.ownerEmail },
  });
  return toOnboardingPayload(parsed);
}

export async function loadLiveOnboardingFacts(
  input: {
    slug: string;
    rawToken: string;
    idempotencyKey: string;
  },
  credentials: { email: string; password: string },
): Promise<LiveOnboardingFacts | null> {
  const supabase = await signedInAdminClient(
    credentials.email,
    credentials.password,
  );
  if (supabase === null) {
    return null;
  }

  const [runs, venuesBySlug] = await Promise.all([
    supabase
      .from("platform_onboarding_runs")
      .select(
        "idempotency_key, business_id, venue_id, invitation_id, result_summary",
      )
      .eq("idempotency_key", input.idempotencyKey),
    supabase
      .from("venues")
      .select(
        "id, business_id, publication_state, content_classification, timezone, name",
      )
      .eq("slug", input.slug),
  ]);

  if (runs.error !== null || venuesBySlug.error !== null) {
    return null;
  }

  const runCount = runs.data?.length ?? 0;
  const run = runs.data?.[0] ?? null;
  const slugVenueCount = venuesBySlug.data?.length ?? 0;
  const slugVenue = venuesBySlug.data?.[0] ?? null;

  if (run === null || slugVenue === null) {
    return {
      ...EMPTY_FACTS,
      onboardingRunCount: runCount,
      venueCount: slugVenueCount,
    };
  }

  const [businesses, venuesForBusiness] = await Promise.all([
    supabase.from("businesses").select("id").eq("id", run.business_id),
    supabase.from("venues").select("id").eq("business_id", run.business_id),
  ]);

  if (
    businesses.error !== null ||
    venuesForBusiness.error !== null ||
    slugVenue.id !== run.venue_id ||
    slugVenue.business_id !== run.business_id
  ) {
    return {
      ...EMPTY_FACTS,
      businessId: run.business_id,
      venueId: run.venue_id,
      onboardingRunCount: runCount,
      businessCount: businesses.data?.length ?? 0,
      venueCount: venuesForBusiness.data?.length ?? 0,
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
    audits,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("venue_id, state, trial_ends_at, plan_id")
      .eq("venue_id", run.venue_id)
      .maybeSingle(),
    supabase
      .from("venue_module_entitlements")
      .select("module_key, grant_type")
      .eq("venue_id", run.venue_id)
      .is("revoked_at", null),
    supabase
      .from("venue_storage_usage")
      .select("quota_bytes, used_bytes")
      .eq("venue_id", run.venue_id)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("default_storage_quota_bytes")
      .eq("key", "standard")
      .maybeSingle(),
    supabase
      .from("venue_branding")
      .select("primary_color, theme_key")
      .eq("venue_id", run.venue_id)
      .maybeSingle(),
    supabase
      .from("venue_translations")
      .select("locale, name")
      .eq("venue_id", run.venue_id),
    supabase
      .from("invitations")
      .select("scope_type, role, venue_id, token_hash")
      .eq("id", run.invitation_id),
    supabase
      .from("audit_log")
      .select("summary, metadata")
      .eq("venue_id", run.venue_id),
  ]);

  const invitation = invitations.data?.[0] ?? null;
  const expectedHash = invitationTokenHash(input.rawToken);
  const summaryText = JSON.stringify(runs.data ?? []);
  const auditText = JSON.stringify(audits.data ?? []);
  const hash = invitation?.token_hash ?? null;

  return {
    businessId: run.business_id,
    venueId: run.venue_id,
    businessCount: businesses.data?.length ?? 0,
    venueCount: venuesForBusiness.data?.length ?? 0,
    onboardingRunCount: runCount,
    publicationState: slugVenue.publication_state,
    classification: slugVenue.content_classification,
    timezone: slugVenue.timezone,
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
    rawTokenStored: hash === input.rawToken,
    summaryHasToken:
      summaryText.includes(input.rawToken) ||
      summaryText.includes("invitation_token"),
    auditHasToken: auditText.includes(input.rawToken),
  };
}

export async function retryLiveOnboarding(input: {
  email: string;
  password: string;
  idempotencyKey: string;
  identity: LiveOnboardingIdentity;
}): Promise<LiveOnboardingRetryResult | null> {
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
    p_payload: liveOnboardingPayload(input.identity, input.idempotencyKey),
  });
  if (error !== null || data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  return {
    ok: record.ok === true,
    idempotent: record.idempotent === true,
    hasToken: typeof record.invitation_token === "string",
    businessId:
      typeof record.business_id === "string" ? record.business_id : null,
    venueId: typeof record.venue_id === "string" ? record.venue_id : null,
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
