import {
  isLocalClass,
  type VenuBoardEnvironment,
} from "@/core/env/environment";

/** Canonical local Next.js origin. Magic links and post-auth redirects use this. */
export const CANONICAL_LOCAL_APP_ORIGIN = "http://localhost:3000";

const LOCAL_APP_ORIGINS = new Set([CANONICAL_LOCAL_APP_ORIGIN]);

export interface AppOriginEnv {
  VENUBOARD_ENV: VenuBoardEnvironment;
  NEXT_PUBLIC_APP_ORIGIN?: string;
}

/**
 * Origin used for Auth redirects and invitation links. Never taken from an
 * unchecked query parameter. Host headers are only accepted when they match
 * the local allow-list or NEXT_PUBLIC_APP_ORIGIN.
 */
export function resolveAppOriginFrom(
  env: AppOriginEnv,
  requestOrigin: string | null,
): string | null {
  const configured = env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  if (requestOrigin === null) {
    return isLocalClass(env.VENUBOARD_ENV) ? CANONICAL_LOCAL_APP_ORIGIN : null;
  }

  try {
    const origin = new URL(requestOrigin).origin;
    if (isLocalClass(env.VENUBOARD_ENV) && LOCAL_APP_ORIGINS.has(origin)) {
      return origin;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Prefer the request URL origin when it is allowlisted; otherwise the local
 * canonical origin. Configured NEXT_PUBLIC_APP_ORIGIN still wins inside
 * resolveAppOriginFrom.
 */
export function resolveCallbackRedirectOriginFrom(
  env: AppOriginEnv,
  requestUrl: string,
): string | null {
  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(requestUrl).origin;
  } catch {
    requestOrigin = null;
  }

  return (
    resolveAppOriginFrom(env, requestOrigin) ?? resolveAppOriginFrom(env, null)
  );
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
