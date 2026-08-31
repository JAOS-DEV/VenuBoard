import "server-only";

import { isLocalClass } from "@/core/env/environment";
import { serverEnv } from "@/core/env/server";

const LOCAL_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

/**
 * Origin used for Auth redirects and invitation links. Never taken from an
 * unchecked query parameter. Host headers are only accepted when they match
 * the local allow-list or NEXT_PUBLIC_APP_ORIGIN.
 */
export function resolveAppOrigin(requestOrigin: string | null): string | null {
  const configured = serverEnv.NEXT_PUBLIC_APP_ORIGIN;
  if (configured !== undefined) {
    return configured.replace(/\/$/, "");
  }

  if (requestOrigin === null) {
    return isLocalClass(serverEnv.VENUBOARD_ENV)
      ? "http://127.0.0.1:3000"
      : null;
  }

  try {
    const url = new URL(requestOrigin);
    const origin = url.origin;
    if (isLocalClass(serverEnv.VENUBOARD_ENV) && LOCAL_ORIGINS.has(origin)) {
      return origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function authCallbackUrl(
  origin: string,
  locale: "en" | "th",
  nextPath: string | null,
): string {
  const url = new URL(`/${locale}/auth/callback`, origin);
  if (nextPath !== null) {
    url.searchParams.set("next", nextPath);
  }
  return url.toString();
}
