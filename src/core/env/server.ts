import "server-only";

import { parseServerEnv, type ServerEnv } from "./schema.ts";

/**
 * Validated server environment. The `server-only` import above means importing
 * this module from a Client Component is a build error, which is how the
 * Supabase secret key is kept out of browser bundles.
 *
 * Validation is eager: a misconfigured environment fails at boot rather than
 * at the first request that happens to need a value.
 */
export const serverEnv: ServerEnv = parseServerEnv(process.env);

export type { ServerEnv };
