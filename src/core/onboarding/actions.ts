"use server";

import { resolveRequestActor } from "@/core/actors/resolve";
import { canOnboardTenants } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import {
  parseOnboardingRpcResult,
  type OnboardingActionResult,
} from "@/core/onboarding/result";
import {
  onboardingWizardSchema,
  toOnboardingPayload,
} from "@/core/onboarding/schema";
import { normalizeVenueSlug } from "@/core/onboarding/slug";

export type { OnboardingActionResult };

export async function checkVenueSlugAvailability(
  rawSlug: string,
): Promise<{ available: boolean }> {
  const actor = await resolveRequestActor({ memberships: "platform" });
  if (!canOnboardTenants(actor)) {
    return { available: false };
  }

  const slug = normalizeVenueSlug(rawSlug);
  if (slug === null) {
    return { available: false };
  }

  if (getSupabaseConnection() === null) {
    return { available: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("venue_slug_is_available", {
    p_slug: slug,
  });

  if (error || typeof data !== "boolean") {
    return { available: false };
  }

  return { available: data };
}

export async function submitPlatformOnboarding(
  input: unknown,
): Promise<OnboardingActionResult> {
  const actor = await resolveRequestActor({ memberships: "platform" });
  if (!canOnboardTenants(actor)) {
    return { ok: false, code: "forbidden" };
  }

  const parsed = onboardingWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("onboard_platform_venue", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_payload: toOnboardingPayload(parsed.data) as Json,
  });

  if (error) {
    return { ok: false, code: "unavailable" };
  }

  return parseOnboardingRpcResult(data);
}
