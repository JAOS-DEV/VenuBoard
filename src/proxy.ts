import createMiddleware from "next-intl/middleware";

import { routing } from "@/core/i18n/routing";

/**
 * Locale negotiation only. Next.js 16 names this file `proxy.ts`; next-intl
 * still creates the handler with `createMiddleware`.
 *
 * Tenant resolution from a custom domain or subdomain will also live here
 * eventually (ADR-020), as will Supabase session refresh. Neither exists yet,
 * and a proxy that pretended to resolve tenants would be worse than one that
 * does not.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next.js internals, Vercel internals, and anything that
  // looks like a file (a path containing an extension).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
