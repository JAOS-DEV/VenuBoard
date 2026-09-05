"use server";

import { revalidatePath } from "next/cache";

import { resolveRequestActor } from "@/core/actors/resolve";
import { can } from "@/core/authz/can";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import type { Json } from "@/core/db/types";
import { loadPublicVenueFeed } from "./queries";
import type { PublicVenueFeedPayload } from "./public-types";

import {
  CopyFeedPostSchema,
  CreateFeedPostSchema,
  FeedPostIdSchema,
  RejectFeedPostSchema,
  ScheduleFeedPostSchema,
  UpdateFeedPostSchema,
  UpdateFeedSettingsSchema,
} from "./schema";
import {
  mapFeedRpcResult,
  mapFeedRpcResultWithId,
  type FeedActionResult,
} from "./result";

function unavailable<T = void>(): FeedActionResult<T> {
  return { ok: false, code: "unavailable" };
}

async function requireVenueActor(venueId: string) {
  return resolveRequestActor({ memberships: "own", venueId });
}

function revalidateFeed(venueSlug: string): void {
  revalidatePath("/admin/feed");
  if (venueSlug.length > 0) {
    revalidatePath(`/en/v/${venueSlug}`);
    revalidatePath(`/th/v/${venueSlug}`);
    revalidatePath(`/en/v/${venueSlug}/updates`);
    revalidatePath(`/th/v/${venueSlug}/updates`);
  }
}

async function loadVenueSlugFromPost(postId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("feed_posts")
    .select("venue_id")
    .eq("id", postId)
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

function postWritePayload(input: {
  postType: string;
  titleEn: string;
  bodyEn: string;
  titleTh?: string;
  bodyTh?: string;
}): Record<string, unknown> {
  return {
    post_type: input.postType,
    title_en: input.titleEn,
    body_en: input.bodyEn,
    title_th: input.titleTh ?? null,
    body_th: input.bodyTh ?? null,
  };
}

export async function createFeedPostAction(
  input: unknown,
): Promise<FeedActionResult<{ postId: string }>> {
  const parsed = CreateFeedPostSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("create_feed_post", {
    p_venue_id: parsed.data.venueId,
    p_payload: postWritePayload(parsed.data) as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlug(parsed.data.venueId));
  return mapFeedRpcResultWithId(data);
}

export async function updateFeedPostDraftAction(
  input: unknown,
): Promise<FeedActionResult> {
  const parsed = UpdateFeedPostSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("update_feed_post_draft", {
    p_post_id: parsed.data.postId,
    p_payload: postWritePayload(parsed.data) as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlugFromPost(parsed.data.postId));
  return mapFeedRpcResult(data);
}

async function postIdAction(
  postId: string,
  rpcName:
    | "submit_feed_post_for_approval"
    | "approve_feed_post"
    | "publish_feed_post_now"
    | "unpublish_feed_post"
    | "pin_feed_post"
    | "unpin_feed_post"
    | "archive_feed_post"
    | "restore_feed_post_to_draft",
): Promise<FeedActionResult> {
  const parsed = FeedPostIdSchema.safeParse({ postId });
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
    p_post_id: parsed.data.postId,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlugFromPost(parsed.data.postId));
  return mapFeedRpcResult(data);
}

export async function submitFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "submit_feed_post_for_approval");
}

export async function approveFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "approve_feed_post");
}

export async function publishFeedPostNowAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "publish_feed_post_now");
}

export async function unpublishFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "unpublish_feed_post");
}

export async function pinFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "pin_feed_post");
}

export async function unpinFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "unpin_feed_post");
}

export async function archiveFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "archive_feed_post");
}

export async function restoreFeedPostAction(
  postId: string,
): Promise<FeedActionResult> {
  return postIdAction(postId, "restore_feed_post_to_draft");
}

export async function loadMorePublicFeedAction(input: {
  venueSlug: string;
  locale: "en" | "th";
  cursor: string;
}): Promise<PublicVenueFeedPayload> {
  return loadPublicVenueFeed(input.venueSlug, input.locale, {
    cursor: input.cursor,
  });
}

export async function rejectFeedPostAction(
  input: unknown,
): Promise<FeedActionResult> {
  const parsed = RejectFeedPostSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("reject_feed_post", {
    p_post_id: parsed.data.postId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlugFromPost(parsed.data.postId));
  return mapFeedRpcResult(data);
}

export async function scheduleFeedPostAction(
  input: unknown,
): Promise<FeedActionResult> {
  const parsed = ScheduleFeedPostSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("schedule_feed_post_publication", {
    p_post_id: parsed.data.postId,
    p_scheduled_for: parsed.data.scheduledFor,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlugFromPost(parsed.data.postId));
  return mapFeedRpcResult(data);
}

export async function copyFeedPostAction(
  input: unknown,
): Promise<FeedActionResult<{ postId: string }>> {
  const parsed = CopyFeedPostSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("copy_feed_post_to_venue", {
    p_post_id: parsed.data.postId,
    p_destination_venue_id: parsed.data.destVenueId,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlugFromPost(parsed.data.postId));
  revalidateFeed(await loadVenueSlug(parsed.data.destVenueId));
  return mapFeedRpcResultWithId(data);
}

export async function updateFeedSettingsAction(
  input: unknown,
): Promise<FeedActionResult> {
  const parsed = UpdateFeedSettingsSchema.safeParse(input);
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
  const { data, error } = await supabase.rpc("update_feed_module_settings", {
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
        horizon_days: parsed.data.horizonDays,
        display_density: parsed.data.displayDensity,
      },
    } as Json,
  });
  if (error) {
    return unavailable();
  }
  revalidateFeed(await loadVenueSlug(parsed.data.venueId));
  return mapFeedRpcResult(data);
}
