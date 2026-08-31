import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConnection } from "./connection";
import type { Database } from "./types";

/**
 * Browser Supabase client. Uses the publishable key only, so every request is
 * subject to Row Level Security. The clients are typed against generated
 * `Database` types; the UI still does not query tenant tables in this phase.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabaseConnection();

  return createBrowserClient<Database>(url, publishableKey);
}
