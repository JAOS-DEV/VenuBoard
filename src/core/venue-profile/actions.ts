"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import { publicHttpUrl } from "./links";
import {
  mapVenueProfileRpcResult,
  type VenueProfileActionResult,
} from "./result";
import {
  SaveVenueBrandingSchema,
  SaveVenueHoursSchema,
  SaveVenueProfileSchema,
  SetVenuePublicationSchema,
} from "./schema";

function unavailable(): VenueProfileActionResult {
  return { ok: false, code: "unavailable" };
}

async function requireVenueActor(venueId: string) {
  return resolveRequestActor({ memberships: "own", venueId });
}

function revalidateProfile(slug: string): void {
  revalidatePath("/admin/profile");
  if (slug.length > 0) {
    revalidatePath(`/en/v/${slug}`);
    revalidatePath(`/th/v/${slug}`);
    revalidatePath(`/en/v/${slug}/offers`);
    revalidatePath(`/th/v/${slug}/offers`);
    revalidatePath(`/en/v/${slug}/updates`);
    revalidatePath(`/th/v/${slug}/updates`);
    revalidatePath(`/en/v/${slug}/enquire`);
    revalidatePath(`/th/v/${slug}/enquire`);
  }
}

async function loadSlug(venueId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("venues")
    .select("slug")
    .eq("id", venueId)
    .maybeSingle();
  return data?.slug ?? "";
}

function contactsPayload(input: {
  email?: string;
  phone?: string;
  website?: string;
}): Json {
  const contacts: Json[] = [];
  if (input.email !== undefined) {
    contacts.push({ type: "email", value: input.email });
  }
  if (input.phone !== undefined) {
    contacts.push({ type: "phone", value: input.phone });
  }
  if (input.website !== undefined) {
    const safe = publicHttpUrl(input.website);
    if (safe !== null) {
      contacts.push({ type: "website", value: safe });
    }
  }
  return contacts;
}

export async function saveVenuePublicProfileAction(
  input: unknown,
): Promise<VenueProfileActionResult> {
  const parsed = SaveVenueProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  const scope = {
    type: "venue" as const,
    venueId: parsed.data.venueId,
    businessId: actor.currentBusinessId ?? undefined,
  };
  if (!can(actor, "manage_venue", scope)) {
    return { ok: false, code: "forbidden" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_venue_public_profile", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      expected_updated_at: parsed.data.expectedUpdatedAt,
      name: parsed.data.name,
      name_en: parsed.data.nameEn ?? parsed.data.name,
      tagline_en: parsed.data.taglineEn ?? null,
      description_en: parsed.data.descriptionEn ?? null,
      directions_en: parsed.data.directionsEn ?? null,
      name_th: parsed.data.nameTh ?? null,
      tagline_th: parsed.data.taglineTh ?? null,
      description_th: parsed.data.descriptionTh ?? null,
      directions_th: parsed.data.directionsTh ?? null,
      address_line1: parsed.data.addressLine1 ?? null,
      address_line2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city ?? null,
      province: parsed.data.province ?? null,
      postal_code: parsed.data.postalCode ?? null,
      country: parsed.data.country ?? null,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      contacts: contactsPayload(parsed.data),
    },
  });
  if (error) {
    return unavailable();
  }
  const result = mapVenueProfileRpcResult(data);
  if (result.ok) {
    revalidateProfile(await loadSlug(parsed.data.venueId));
  }
  return result;
}

export async function saveVenueOpeningHoursAction(
  input: unknown,
): Promise<VenueProfileActionResult> {
  const parsed = SaveVenueHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  const scope = {
    type: "venue" as const,
    venueId: parsed.data.venueId,
    businessId: actor.currentBusinessId ?? undefined,
  };
  if (!can(actor, "manage_venue", scope)) {
    return { ok: false, code: "forbidden" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_venue_opening_hours", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      expected_updated_at: parsed.data.expectedUpdatedAt,
      mode: parsed.data.mode,
      week: parsed.data.week.map((day) => ({
        day: day.day,
        closed: day.closed,
        intervals: day.intervals.map((interval) => ({
          opens: interval.opens,
          closes: interval.closes,
          closes_next_day: interval.closesNextDay,
        })),
      })),
      exceptions: parsed.data.exceptions.map((row) => ({
        date: row.date,
        closed: row.closed,
        internal_note: row.internalNote ?? null,
        intervals: row.intervals.map((interval) => ({
          opens: interval.opens,
          closes: interval.closes,
          closes_next_day: interval.closesNextDay,
        })),
      })),
    },
  });
  if (error) {
    return unavailable();
  }
  const result = mapVenueProfileRpcResult(data);
  if (result.ok) {
    revalidateProfile(await loadSlug(parsed.data.venueId));
  }
  return result;
}

export async function setVenuePublicationAction(
  input: unknown,
): Promise<VenueProfileActionResult> {
  const parsed = SetVenuePublicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  const scope = {
    type: "venue" as const,
    venueId: parsed.data.venueId,
    businessId: actor.currentBusinessId ?? undefined,
  };
  if (!can(actor, "manage_venue", scope)) {
    return { ok: false, code: "forbidden" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_venue_publication", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      expected_updated_at: parsed.data.expectedUpdatedAt,
      publication_state: parsed.data.publicationState,
    },
  });
  if (error) {
    return unavailable();
  }
  const result = mapVenueProfileRpcResult(data);
  if (result.ok) {
    revalidateProfile(await loadSlug(parsed.data.venueId));
  }
  return result;
}

export async function saveVenueBrandingAction(
  input: unknown,
): Promise<VenueProfileActionResult> {
  const parsed = SaveVenueBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }
  if (getSupabaseConnection() === null) {
    return unavailable();
  }
  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  const scope = {
    type: "venue" as const,
    venueId: parsed.data.venueId,
    businessId: actor.currentBusinessId ?? undefined,
  };
  if (!can(actor, "manage_branding", scope)) {
    return { ok: false, code: "forbidden" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_venue_branding", {
    p_venue_id: parsed.data.venueId,
    p_payload: {
      theme_key: parsed.data.themeKey,
      font_key: parsed.data.fontKey,
      primary_color: parsed.data.primaryColor.toUpperCase(),
      secondary_color: parsed.data.secondaryColor.toUpperCase(),
      accent_color: parsed.data.accentColor.toUpperCase(),
      background_color: parsed.data.backgroundColor.toUpperCase(),
      text_color: parsed.data.textColor.toUpperCase(),
    },
  });
  if (error) {
    return unavailable();
  }
  const result = mapVenueProfileRpcResult(data);
  if (result.ok) {
    revalidateProfile(await loadSlug(parsed.data.venueId));
  }
  return result;
}
