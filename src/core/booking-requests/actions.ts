"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import { serverEnv } from "@/core/env/server";

import { submitBookingEnquiryRpc } from "./intake-client";
import { publicBookingIntakeAllowed } from "./intake-guard";
import { publicVenueEnquirePath } from "./public-path";
import { mapBookingRpcResult, type BookingActionResult } from "./result";
import {
  BookingEnquiryIdSchema,
  CloseBookingEnquirySchema,
  SubmitBookingEnquirySchema,
  UpdateBookingSettingsSchema,
} from "./schema";

function unavailable(): BookingActionResult {
  return { ok: false, code: "unavailable" };
}

function revalidateBookingSurfaces(venueSlug: string): void {
  revalidatePath("/admin/bookings");
  const publicPath = publicVenueEnquirePath(venueSlug);
  if (publicPath !== null) {
    revalidatePath(`/en${publicPath}`);
    revalidatePath(`/th${publicPath}`);
    revalidatePath(`/en/v/${venueSlug}`);
    revalidatePath(`/th/v/${venueSlug}`);
  }
}

async function loadVenueSlug(venueId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("venues")
    .select("slug")
    .eq("id", venueId)
    .maybeSingle();
  return data?.slug ?? "";
}

async function loadVenueSlugFromEnquiry(enquiryId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("venue_id")
    .eq("id", enquiryId)
    .maybeSingle();
  if (data === null) {
    return "";
  }
  return loadVenueSlug(data.venue_id);
}

export async function submitBookingEnquiryAction(
  input: unknown,
): Promise<BookingActionResult> {
  if (!publicBookingIntakeAllowed(serverEnv.VENUBOARD_ENV)) {
    return unavailable();
  }

  const parsed = SubmitBookingEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const payload: {
    idempotency_key: string;
    display_name: string;
    email: string;
    party_size: number;
    requested_local: string;
    locale: "en" | "th";
    message?: string;
  } = {
    idempotency_key: parsed.data.idempotencyKey,
    display_name: parsed.data.displayName,
    email: parsed.data.email,
    party_size: parsed.data.partySize,
    requested_local: parsed.data.requestedLocal,
    locale: parsed.data.locale,
  };
  if (parsed.data.message !== undefined && parsed.data.message.length > 0) {
    payload.message = parsed.data.message;
  }

  return submitBookingEnquiryRpc({
    p_venue_slug: parsed.data.venueSlug,
    p_payload: payload,
  });
}

export async function reviewBookingEnquiryAction(
  input: unknown,
): Promise<BookingActionResult> {
  const parsed = BookingEnquiryIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  const actor = await resolveRequestActor({ memberships: "own" });
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_booking_enquiry", {
    p_enquiry_id: parsed.data.enquiryId,
    p_expected_row_version: parsed.data.expectedRowVersion,
  });
  if (error) {
    return unavailable();
  }
  revalidateBookingSurfaces(
    await loadVenueSlugFromEnquiry(parsed.data.enquiryId),
  );
  return mapBookingRpcResult(data);
}

export async function closeBookingEnquiryAction(
  input: unknown,
): Promise<BookingActionResult> {
  const parsed = CloseBookingEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  const actor = await resolveRequestActor({ memberships: "own" });
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("close_booking_enquiry", {
    p_enquiry_id: parsed.data.enquiryId,
    p_outcome: parsed.data.outcome,
    p_expected_row_version: parsed.data.expectedRowVersion,
  });
  if (error) {
    return unavailable();
  }
  revalidateBookingSurfaces(
    await loadVenueSlugFromEnquiry(parsed.data.enquiryId),
  );
  return mapBookingRpcResult(data);
}

export async function reopenBookingEnquiryAction(
  input: unknown,
): Promise<BookingActionResult> {
  const parsed = BookingEnquiryIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  const actor = await resolveRequestActor({ memberships: "own" });
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reopen_booking_enquiry", {
    p_enquiry_id: parsed.data.enquiryId,
    p_expected_row_version: parsed.data.expectedRowVersion,
  });
  if (error) {
    return unavailable();
  }
  revalidateBookingSurfaces(
    await loadVenueSlugFromEnquiry(parsed.data.enquiryId),
  );
  return mapBookingRpcResult(data);
}

export async function updateBookingSettingsAction(
  input: unknown,
): Promise<BookingActionResult> {
  const parsed = UpdateBookingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  const actor = await resolveRequestActor({
    memberships: "own",
    venueId: parsed.data.venueId,
  });
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (
    !can(actor, "manage_venue_module_visibility", {
      type: "venue",
      venueId: parsed.data.venueId,
    })
  ) {
    return { ok: false, code: "forbidden" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_booking_module_settings", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      is_enabled: parsed.data.isEnabled,
      is_publicly_visible: parsed.data.isPubliclyVisible,
      accepting_enquiries: parsed.data.acceptingEnquiries,
      min_party_size: parsed.data.minPartySize,
      max_party_size: parsed.data.maxPartySize,
      horizon_days: parsed.data.horizonDays,
      lead_time_minutes: parsed.data.leadTimeMinutes,
      heading_en: parsed.data.headingEn ?? null,
      heading_th: parsed.data.headingTh ?? null,
      instructions_en: parsed.data.instructionsEn ?? "",
      instructions_th: parsed.data.instructionsTh ?? "",
    } as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateBookingSurfaces(await loadVenueSlug(parsed.data.venueId));
  return mapBookingRpcResult(data);
}
