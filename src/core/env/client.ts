import { parseClientEnv, type ClientEnv } from "./schema.ts";

/**
 * Browser-safe environment values. Next.js inlines `NEXT_PUBLIC_*` variables at
 * build time, so they must be referenced statically rather than looked up
 * dynamically from `process.env`.
 *
 * Nothing here is a secret, and nothing here may become one. The VenuBoard
 * environment identifier is deliberately absent: the environment badge is
 * rendered on the server and passed down as a prop.
 */
export const clientEnv: ClientEnv = parseClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
});

export type { ClientEnv };
