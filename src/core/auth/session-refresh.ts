import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseConnection } from "@/core/db/connection";

/**
 * Refresh the Auth cookies on the request/response pair. Used by `src/proxy.ts`
 * together with locale negotiation. This is not authorisation.
 */
export async function refreshAuthSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const connection = getSupabaseConnection();
  if (connection === null) {
    return response;
  }

  const supabase = createServerClient(
    connection.url,
    connection.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
