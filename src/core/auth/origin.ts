import "server-only";

import { serverEnv } from "@/core/env/server";

import {
  authCallbackUrl,
  CANONICAL_LOCAL_APP_ORIGIN,
  resolveAppOriginFrom,
  resolveCallbackRedirectOriginFrom,
} from "./app-origin";

export { authCallbackUrl, CANONICAL_LOCAL_APP_ORIGIN };

export function resolveAppOrigin(requestOrigin: string | null): string | null {
  return resolveAppOriginFrom(
    {
      VENUBOARD_ENV: serverEnv.VENUBOARD_ENV,
      NEXT_PUBLIC_APP_ORIGIN: serverEnv.NEXT_PUBLIC_APP_ORIGIN,
    },
    requestOrigin,
  );
}

export function resolveCallbackRedirectOrigin(
  requestUrl: string,
): string | null {
  return resolveCallbackRedirectOriginFrom(
    {
      VENUBOARD_ENV: serverEnv.VENUBOARD_ENV,
      NEXT_PUBLIC_APP_ORIGIN: serverEnv.NEXT_PUBLIC_APP_ORIGIN,
    },
    requestUrl,
  );
}
