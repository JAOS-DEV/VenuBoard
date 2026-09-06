import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConnection } from "@/core/db/connection";
import type { Database, Json } from "@/core/db/types";
import { serverEnv } from "@/core/env/server";

import { mapBookingRpcResult, type BookingActionResult } from "./result";

interface SubmitBookingEnquiryRpcArgs {
  p_venue_slug: string;
  p_payload: {
    idempotency_key: string;
    display_name: string;
    email: string;
    party_size: number;
    requested_local: string;
    locale: "en" | "th";
    message?: string;
  };
}

/**
 * Narrow secret-key client used only to call `submit_booking_enquiry`.
 * It is never imported from Client Components.
 */
export async function submitBookingEnquiryRpc(
  args: SubmitBookingEnquiryRpcArgs,
): Promise<BookingActionResult> {
  const connection = getSupabaseConnection();
  const secret = serverEnv.SUPABASE_SECRET_KEY;
  if (connection === null || secret === undefined) {
    return { ok: false, code: "unavailable" };
  }

  const client = createClient<Database>(connection.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.rpc("submit_booking_enquiry", {
    p_venue_slug: args.p_venue_slug,
    p_payload: args.p_payload as Json,
  });
  if (error) {
    return { ok: false, code: "unavailable" };
  }
  return mapBookingRpcResult(data);
}
