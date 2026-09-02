"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import {
  ADMIN_SCOPE_COOKIE,
  serializeAdminScopeCookie,
} from "@/core/auth/scope-cookie";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import {
  adminScopeInputSchema,
  assignStaffInputSchema,
  createStaffInputSchema,
  emptyToNull,
  staffConsentInputSchema,
  staffModuleSettingsInputSchema,
  staffPresenceInputSchema,
  updateStaffProfileInputSchema,
} from "./schema";
import { parseStaffRpcResult, type StaffActionResult } from "./result";
import { STAFF_MODULE_KEY } from "./constants";

function unavailable(): StaffActionResult {
  return { ok: false, code: "unavailable" };
}

async function requireVenueActor(venueId: string, businessId?: string) {
  const actor = await resolveRequestActor({
    memberships: "own",
    venueId,
    businessId,
  });
  return actor;
}

export async function selectAdminVenue(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = adminScopeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(
    parsed.data.venueId,
    parsed.data.businessId,
  );
  if (actor.kind !== "authenticated") {
    return { ok: false, code: "unauthenticated" };
  }

  const allowed =
    actor.businessMemberships.some(
      (row) => row.businessId === parsed.data.businessId,
    ) ||
    actor.venueMemberships.some((row) => row.venueId === parsed.data.venueId);

  if (!allowed) {
    return { ok: false, code: "forbidden" };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_SCOPE_COOKIE,
    value: serializeAdminScopeCookie(parsed.data),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function createStaffMemberAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = createStaffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  if (
    parsed.data.publicationState === "published" &&
    parsed.data.consentState !== "granted"
  ) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
  if (
    !can(actor, "manage_public_staff_profiles", {
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
  const { data, error } = await supabase.rpc(
    "create_staff_member_with_profile",
    {
      p_venue_id: parsed.data.venueId,
      p_payload: {
        internal_display_name: parsed.data.internalDisplayName,
        public_display_name: parsed.data.publicDisplayName,
        public_title: emptyToNull(parsed.data.publicTitle),
        bio_en: emptyToNull(parsed.data.bioEn),
        bio_th: emptyToNull(parsed.data.bioTh),
        avatar_storage_path: emptyToNull(parsed.data.avatarStoragePath),
        display_order: parsed.data.displayOrder,
        publication_state: parsed.data.publicationState,
        consent_state: parsed.data.consentState,
        user_id: emptyToNull(parsed.data.userId),
      } as Json,
    },
  );

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function updateStaffProfileAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = updateStaffProfileInputSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("update_staff_public_profile", {
    p_profile_id: parsed.data.profileId,
    p_payload: {
      public_display_name: parsed.data.publicDisplayName,
      public_title: emptyToNull(parsed.data.publicTitle),
      bio_en: emptyToNull(parsed.data.bioEn),
      bio_th: emptyToNull(parsed.data.bioTh),
      avatar_storage_path: emptyToNull(parsed.data.avatarStoragePath),
      display_order: parsed.data.displayOrder,
      publication_state: parsed.data.publicationState,
      assignment_status: parsed.data.assignmentStatus,
    } as Json,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function setStaffConsentAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = staffConsentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_staff_public_consent", {
    p_profile_id: parsed.data.profileId,
    p_consent_state: parsed.data.consentState,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function setStaffPresenceAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = staffPresenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_staff_presence", {
    p_profile_id: parsed.data.profileId,
    p_state: parsed.data.state,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function bulkMarkStaffNotPresentAction(
  venueId: string,
): Promise<StaffActionResult> {
  const actor = await requireVenueActor(venueId);
  if (!can(actor, "toggle_staff_presence", { type: "venue", venueId })) {
    return { ok: false, code: "forbidden" };
  }

  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("bulk_mark_staff_not_present", {
    p_venue_id: venueId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function deactivateStaffAction(
  staffMemberId: string,
): Promise<StaffActionResult> {
  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("deactivate_staff_member", {
    p_staff_member_id: staffMemberId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function restoreStaffAction(
  staffMemberId: string,
): Promise<StaffActionResult> {
  if (getSupabaseConnection() === null) {
    return unavailable();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("restore_staff_member", {
    p_staff_member_id: staffMemberId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function assignStaffToVenueAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = assignStaffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
  if (
    !can(actor, "manage_public_staff_profiles", {
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
  const { data, error } = await supabase.rpc("assign_staff_to_venue", {
    p_staff_member_id: parsed.data.staffMemberId,
    p_venue_id: parsed.data.venueId,
    p_payload: {
      public_display_name: parsed.data.publicDisplayName,
      public_title: emptyToNull(parsed.data.publicTitle),
      bio_en: emptyToNull(parsed.data.bioEn),
      bio_th: emptyToNull(parsed.data.bioTh),
      publication_state: "draft",
      consent_state: "pending",
    } as Json,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/staff");
  return parseStaffRpcResult(data);
}

export async function saveStaffModuleSettingsAction(
  input: unknown,
): Promise<StaffActionResult> {
  const parsed = staffModuleSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_payload" };
  }

  const actor = await requireVenueActor(parsed.data.venueId);
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
  const settings = {
    display_mode: parsed.data.displayMode,
    carousel_order: parsed.data.carouselOrder,
    presence_expiry_hours: parsed.data.presenceExpiryHours,
    carousel_auto_advance: parsed.data.carouselAutoAdvance,
  };

  const { data: existing } = await supabase
    .from("venue_module_settings")
    .select("id")
    .eq("venue_id", parsed.data.venueId)
    .eq("module_key", STAFF_MODULE_KEY)
    .maybeSingle();

  if (existing === null) {
    const { data: inserted, error } = await supabase
      .from("venue_module_settings")
      .insert({
        venue_id: parsed.data.venueId,
        module_key: STAFF_MODULE_KEY,
        is_enabled: parsed.data.isEnabled,
        is_publicly_visible: parsed.data.isPubliclyVisible,
        display_order: 2,
        settings,
      })
      .select("id")
      .maybeSingle();

    if (error || inserted === null) {
      return { ok: false, code: "forbidden" };
    }

    await upsertHeadings(
      inserted.id,
      parsed.data.venueId,
      parsed.data.headingEn,
      parsed.data.headingTh,
    );
  } else {
    const { error } = await supabase
      .from("venue_module_settings")
      .update({
        is_enabled: parsed.data.isEnabled,
        is_publicly_visible: parsed.data.isPubliclyVisible,
        settings,
      })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, code: "forbidden" };
    }

    await upsertHeadings(
      existing.id,
      parsed.data.venueId,
      parsed.data.headingEn,
      parsed.data.headingTh,
    );
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

async function upsertHeadings(
  settingId: string,
  venueId: string,
  headingEn: string | undefined,
  headingTh: string | undefined,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const rows = [
    { locale: "en" as const, value: emptyToNull(headingEn) },
    { locale: "th" as const, value: emptyToNull(headingTh) },
  ];

  for (const row of rows) {
    if (row.value === null) {
      await supabase
        .from("venue_module_setting_translations")
        .delete()
        .eq("venue_module_setting_id", settingId)
        .eq("locale", row.locale);
      continue;
    }

    const { data: existing } = await supabase
      .from("venue_module_setting_translations")
      .select("id")
      .eq("venue_module_setting_id", settingId)
      .eq("locale", row.locale)
      .maybeSingle();

    if (existing === null) {
      await supabase.from("venue_module_setting_translations").insert({
        venue_module_setting_id: settingId,
        venue_id: venueId,
        locale: row.locale,
        public_heading: row.value,
      });
    } else {
      await supabase
        .from("venue_module_setting_translations")
        .update({ public_heading: row.value })
        .eq("id", existing.id);
    }
  }
}
