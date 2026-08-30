import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseConnection } from "./connection";
import type { Database } from "./types";

/**
 * Server Supabase client for Server Components, Server Actions and route
 * handlers. It carries the user's session through cookies and uses the
 * publishable key, so Row Level Security applies to it exactly as it does in
 * the browser.
 *
 * There is deliberately **no service-role client** in this repository. A
 * service-role connection bypasses RLS, which is the one mechanism protecting
 * tenants from each other (ADR-005). If a future task genuinely needs elevated
 * access, it gets its own reviewed module with an explicit justification — not
 * a convenient shared helper.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseConnection();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Session refresh is handled by
          // the request proxy once authentication exists; ignoring this is the
          // pattern Supabase documents for read-only render paths.
        }
      },
    },
  });
}
