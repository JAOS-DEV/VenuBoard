import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConnection } from "./connection";
import type { Database } from "./types";

/**
 * Browser Supabase client. Uses the publishable key only, so every request is
 * subject to Row Level Security.
 *
 * No table is queried anywhere in this phase. RLS policies do not exist yet, so
 * there is nothing safe to read.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabaseConnection();

  return createBrowserClient<Database>(url, publishableKey);
}
