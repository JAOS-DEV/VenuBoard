"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import { loadPublicVenueOffers } from "./queries";
import type { PublicVenueOffersPayload } from "./public-types";

import {
  CreateOfferSchema,
  OfferIdSchema,
  RejectOfferSchema,
  ScheduleOfferSchema,
  UpdateOfferSchema,
  UpdateOffersSettingsSchema,
} from "./schema";
import {
  mapOfferRpcResult,
  mapOfferRpcResultWithId,
  type OfferActionResult,
} from "./result";

function unavailable<T = void>(): OfferActionResult<T> {
  return { ok: false, code: "unavailable" };
}

async function requireVenueActor(venueId: string) {
  return resolveRequestActor({ memberships: "own", venueId });
}

function revalidateOffers(venueSlug: string): void {
  revalidatePath("/admin/offers");
  if (venueSlug.length > 0) {
    revalidatePath(`/en/v/${venueSlug}`);
    revalidatePath(`/th/v/${venueSlug}`);
    revalidatePath(`/en/v/${venueSlug}/offers`);
    revalidatePath(`/th/v/${venueSlug}/offers`);
  }
}

async function loadVenueSlugFromOffer(offerId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("offers")
    .select("venue_id")
    .eq("id", offerId)
    .maybeSingle();
  if (data === null) {
    return "";
  }
  return loadVenueSlug(data.venue_id);
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

function offerWritePayload(input: {
  titleEn: string;
  descriptionEn: string;
  termsEn: string;
  titleTh?: string;
  descriptionTh?: string;
  termsTh?: string;
  validFromLocal: string;
  validUntilLocal: string;
  mediaStoragePath?: string;
}): Record<string, unknown> {
  return {
    title_en: input.titleEn,
    description_en: input.descriptionEn,
    terms_en: input.termsEn,
    title_th: input.titleTh ?? null,
    description_th: input.descriptionTh ?? null,
    terms_th: input.termsTh ?? null,
    valid_from_local: input.validFromLocal,
    valid_until_local: input.validUntilLocal,
    media_storage_path: input.mediaStoragePath ?? null,
  };
}

export async function createOfferAction(
  input: unknown,
): Promise<OfferActionResult<{ offerId: string }>> {
  const parsed = CreateOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (
    !can(actor, "create_content", {
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
  const { data, error } = await supabase.rpc("create_offer", {
    p_venue_id: parsed.data.venueId,
    p_payload: offerWritePayload(parsed.data) as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlug(parsed.data.venueId));
  return mapOfferRpcResultWithId(data);
}

export async function updateOfferDraftAction(
  input: unknown,
): Promise<OfferActionResult> {
  const parsed = UpdateOfferSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("update_offer_draft", {
    p_offer_id: parsed.data.offerId,
    p_payload: offerWritePayload(parsed.data) as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlugFromOffer(parsed.data.offerId));
  return mapOfferRpcResult(data);
}

async function offerIdAction(
  offerId: string,
  rpcName:
    | "submit_offer_for_approval"
    | "approve_offer"
    | "publish_offer_now"
    | "unpublish_offer"
    | "archive_offer"
    | "restore_offer_to_draft",
): Promise<OfferActionResult> {
  const parsed = OfferIdSchema.safeParse({ offerId });
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
  const { data, error } = await supabase.rpc(rpcName, {
    p_offer_id: parsed.data.offerId,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlugFromOffer(parsed.data.offerId));
  return mapOfferRpcResult(data);
}

export async function submitOfferAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "submit_offer_for_approval");
}

export async function approveOfferAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "approve_offer");
}

export async function publishOfferNowAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "publish_offer_now");
}

export async function unpublishOfferAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "unpublish_offer");
}

export async function archiveOfferAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "archive_offer");
}

export async function restoreOfferAction(
  offerId: string,
): Promise<OfferActionResult> {
  return offerIdAction(offerId, "restore_offer_to_draft");
}

export async function loadMorePublicOffersAction(input: {
  venueSlug: string;
  locale: "en" | "th";
  cursor: string;
}): Promise<PublicVenueOffersPayload> {
  return loadPublicVenueOffers(input.venueSlug, input.locale, {
    cursor: input.cursor,
  });
}

export async function rejectOfferAction(
  input: unknown,
): Promise<OfferActionResult> {
  const parsed = RejectOfferSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("reject_offer", {
    p_offer_id: parsed.data.offerId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlugFromOffer(parsed.data.offerId));
  return mapOfferRpcResult(data);
}

export async function scheduleOfferAction(
  input: unknown,
): Promise<OfferActionResult> {
  const parsed = ScheduleOfferSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("schedule_offer_publication", {
    p_offer_id: parsed.data.offerId,
    p_scheduled_for: parsed.data.scheduledFor,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlugFromOffer(parsed.data.offerId));
  return mapOfferRpcResult(data);
}

export async function updateOffersSettingsAction(
  input: unknown,
): Promise<OfferActionResult> {
  const parsed = UpdateOffersSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  const actor = await requireVenueActor(parsed.data.venueId);
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
  const { data, error } = await supabase.rpc("update_offers_module_settings", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      is_enabled: parsed.data.isEnabled,
      is_publicly_visible: parsed.data.isPubliclyVisible,
      heading_en: parsed.data.headingEn ?? null,
      heading_th: parsed.data.headingTh ?? null,
      settings: {
        require_manager_approval: parsed.data.requireManagerApproval,
        homepage_preview_enabled: parsed.data.homepagePreviewEnabled,
        homepage_preview_count: parsed.data.homepagePreviewCount,
      },
    } as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateOffers(await loadVenueSlug(parsed.data.venueId));
  return mapOfferRpcResult(data);
}
