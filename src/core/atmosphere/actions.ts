"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { atmosphereFrontOfHouseProvenConditions } from "@/core/authz/scope";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";

import { mapAtmosphereRpcResult, type AtmosphereActionResult } from "./result";
import {
  ClearAtmosphereSchema,
  SetAtmosphereSchema,
  UpdateAtmosphereSettingsSchema,
} from "./schema";

function unavailable(): AtmosphereActionResult {
  return { ok: false, code: "unavailable" };
}

async function requireVenueActor(venueId: string) {
  return resolveRequestActor({ memberships: "own", venueId });
}

function revalidateAtmosphere(venueSlug: string): void {
  revalidatePath("/admin/atmosphere");
  if (venueSlug.length > 0) {
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

async function venueAllowsFrontOfHouse(venueId: string): Promise<boolean> {
  if (getSupabaseConnection() === null) {
    return false;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("venue_module_settings")
    .select("settings")
    .eq("venue_id", venueId)
    .eq("module_key", "atmosphere")
    .maybeSingle();
  const settings = data?.settings;
  if (
    settings === null ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    return false;
  }
  return (
    (settings as Record<string, unknown>).front_of_house_may_update === true
  );
}

function tenantRoleForVenue(
  actor: Awaited<ReturnType<typeof requireVenueActor>>,
  venueId: string,
): string | null {
  if (actor.kind !== "authenticated") {
    return null;
  }
  return (
    actor.venueMemberships.find((row) => row.venueId === venueId)?.role ?? null
  );
}

export async function setAtmosphereAction(
  input: unknown,
): Promise<AtmosphereActionResult> {
  const parsed = SetAtmosphereSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }

  const frontOfHouse = await venueAllowsFrontOfHouse(parsed.data.venueId);
  const role = tenantRoleForVenue(actor, parsed.data.venueId);
  if (
    !can(
      actor,
      "manage_atmosphere",
      { type: "venue", venueId: parsed.data.venueId },
      {
        provenConditions: atmosphereFrontOfHouseProvenConditions(
          role,
          frontOfHouse,
        ),
      },
    )
  ) {
    return { ok: false, code: "forbidden" };
  }

  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_venue_atmosphere", {
    p_venue_id: parsed.data.venueId,
    p_state: parsed.data.state,
    p_expiry_minutes: parsed.data.expiryMinutes,
  });

  if (error) {
    return unavailable();
  }

  revalidateAtmosphere(await loadVenueSlug(parsed.data.venueId));
  return mapAtmosphereRpcResult(data);
}

export async function clearAtmosphereAction(
  input: unknown,
): Promise<AtmosphereActionResult> {
  const parsed = ClearAtmosphereSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }

  const frontOfHouse = await venueAllowsFrontOfHouse(parsed.data.venueId);
  const role = tenantRoleForVenue(actor, parsed.data.venueId);
  if (
    !can(
      actor,
      "manage_atmosphere",
      { type: "venue", venueId: parsed.data.venueId },
      {
        provenConditions: atmosphereFrontOfHouseProvenConditions(
          role,
          frontOfHouse,
        ),
      },
    )
  ) {
    return { ok: false, code: "forbidden" };
  }

  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("clear_venue_atmosphere", {
    p_venue_id: parsed.data.venueId,
  });

  if (error) {
    return unavailable();
  }

  revalidateAtmosphere(await loadVenueSlug(parsed.data.venueId));
  return mapAtmosphereRpcResult(data);
}

export async function updateAtmosphereSettingsAction(
  input: unknown,
): Promise<AtmosphereActionResult> {
  const parsed = UpdateAtmosphereSettingsSchema.safeParse(input);
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
  const payload: Record<string, unknown> = {
    is_enabled: parsed.data.isEnabled,
    is_publicly_visible: parsed.data.isPubliclyVisible,
    heading_en: parsed.data.headingEn ?? "",
    heading_th: parsed.data.headingTh ?? "",
    settings: {
      default_expiry_minutes: parsed.data.defaultExpiryMinutes,
      front_of_house_may_update: parsed.data.frontOfHouseMayUpdate,
      presentation: parsed.data.presentation,
    },
  };

  const { data, error } = await supabase.rpc(
    "update_atmosphere_module_settings",
    {
      p_venue_id: parsed.data.venueId,
      p_payload: payload as Json,
    },
  );

  if (error) {
    return unavailable();
  }

  revalidateAtmosphere(await loadVenueSlug(parsed.data.venueId));
  return mapAtmosphereRpcResult(data);
}
