import { clientEnv } from "@/core/env/client";

/**
 * The publishable connection details shared by the browser and server clients.
 *
 * Kept in one place so the "is Supabase configured at all?" question has a
 * single answer. In this scaffold phase the answer is normally "no", and the
 * placeholder surfaces say so rather than pretending to load data.
 */
export interface SupabaseConnection {
  url: string;
  publishableKey: string;
}

export function getSupabaseConnection(): SupabaseConnection | null {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    clientEnv;

  if (
    NEXT_PUBLIC_SUPABASE_URL === undefined ||
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined
  ) {
    return null;
  }

  return {
    url: NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requireSupabaseConnection(): SupabaseConnection {
  const connection = getSupabaseConnection();

  if (connection === null) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local. " +
        "Run `npm run supabase:start` for a local stack (requires Docker).",
    );
  }

  return connection;
}
