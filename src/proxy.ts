import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { refreshAuthSession } from "@/core/auth/session-refresh";
import { routing } from "@/core/i18n/routing";

const handleI18n = createMiddleware(routing);

/**
 * Locale negotiation plus Auth cookie refresh. Authorisation is enforced in
 * protected server layouts, not here.
 */
export default async function proxy(request: NextRequest) {
  request.headers.set("x-venuboard-pathname", request.nextUrl.pathname);
  const response = handleI18n(request);
  return refreshAuthSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
