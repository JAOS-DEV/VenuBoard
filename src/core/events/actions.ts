"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import {
  CreateEventSchema,
  UpdateEventDraftSchema,
  RejectEventSchema,
  ScheduleEventSchema,
  CancelEventSchema,
  CopyEventSchema,
} from "./schema";
import {
  mapEventRpcResult,
  mapEventRpcResultWithId,
  type EventActionResult,
} from "./result";

function unavailable<T = void>(): EventActionResult<T> {
  return { ok: false, code: "unavailable" };
}

function eventWritePayload(input: {
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  titleEn: string;
  summaryEn?: string;
  descriptionEn?: string;
  ctaLabelEn?: string;
  titleTh?: string;
  summaryTh?: string;
  descriptionTh?: string;
  ctaLabelTh?: string;
  posterStoragePath?: string;
}): Record<string, unknown> {
  return {
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    timezone: input.timezone,
    is_all_day: input.isAllDay,
    poster_storage_path: input.posterStoragePath ?? null,
    title_en: input.titleEn,
    summary_en: input.summaryEn ?? null,
    description_en: input.descriptionEn ?? null,
    cta_label_en: input.ctaLabelEn ?? null,
    title_th: input.titleTh ?? null,
    summary_th: input.summaryTh ?? null,
    description_th: input.descriptionTh ?? null,
    cta_label_th: input.ctaLabelTh ?? null,
  };
}

async function requireVenueActor(venueId: string) {
  return resolveRequestActor({ memberships: "own", venueId });
}

export async function createEventAction(
  input: unknown,
): Promise<EventActionResult<{ eventId: string }>> {
  const parsed = CreateEventSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("create_event", {
    p_venue_id: parsed.data.venueId,
    p_payload: eventWritePayload(parsed.data) as Json,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResultWithId(data);
}

export async function updateEventDraftAction(
  input: unknown,
): Promise<EventActionResult> {
  const parsed = UpdateEventDraftSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("update_event_draft", {
    p_event_id: parsed.data.eventId,
    p_payload: eventWritePayload(parsed.data) as Json,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function submitEventForApprovalAction(
  eventId: string,
): Promise<EventActionResult> {
  if (!eventId) {
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
  const { data, error } = await supabase.rpc("submit_event_for_approval", {
    p_event_id: eventId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function approveEventAction(
  eventId: string,
): Promise<EventActionResult> {
  if (!eventId) {
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
  const { data, error } = await supabase.rpc("approve_event", {
    p_event_id: eventId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function rejectEventAction(
  input: unknown,
): Promise<EventActionResult> {
  const parsed = RejectEventSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("reject_event", {
    p_event_id: parsed.data.eventId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function publishEventNowAction(
  eventId: string,
): Promise<EventActionResult> {
  if (!eventId) {
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
  const { data, error } = await supabase.rpc("publish_event_now", {
    p_event_id: eventId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function scheduleEventPublicationAction(
  input: unknown,
): Promise<EventActionResult> {
  const parsed = ScheduleEventSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("schedule_event_publication", {
    p_event_id: parsed.data.eventId,
    p_publish_at: parsed.data.publishAt,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function cancelEventAction(
  input: unknown,
): Promise<EventActionResult> {
  const parsed = CancelEventSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("cancel_event", {
    p_event_id: parsed.data.eventId,
    p_reason: parsed.data.reason ?? "",
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function archiveEventAction(
  eventId: string,
): Promise<EventActionResult> {
  if (!eventId) {
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
  const { data, error } = await supabase.rpc("archive_event", {
    p_event_id: eventId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function restoreEventToDraftAction(
  eventId: string,
): Promise<EventActionResult> {
  if (!eventId) {
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
  const { data, error } = await supabase.rpc("restore_event_to_draft", {
    p_event_id: eventId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResult(data);
}

export async function copyEventToVenueAction(
  input: unknown,
): Promise<EventActionResult<{ eventId: string }>> {
  const parsed = CopyEventSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("copy_event_to_venue", {
    p_event_id: parsed.data.eventId,
    p_destination_venue_id: parsed.data.destVenueId,
  });

  if (error) {
    return unavailable();
  }

  revalidatePath("/admin/events");
  return mapEventRpcResultWithId(data);
}
