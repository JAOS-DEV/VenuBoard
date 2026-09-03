import { NextResponse } from "next/server";

import {
  CANONICAL_LOCAL_APP_ORIGIN,
  resolveCallbackRedirectOrigin,
} from "@/core/auth/origin";
import {
  parseSafeApplicationPath,
  toNavigationHref,
} from "@/core/auth/redirects";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import { routing, type AppLocale } from "@/core/i18n/routing";

interface CallbackContext {
  params: Promise<{ locale: string }>;
}

function localeOrDefault(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

export async function GET(
  request: Request,
  context: CallbackContext,
): Promise<NextResponse> {
  const { locale: rawLocale } = await context.params;
  const locale = localeOrDefault(rawLocale);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath =
    parseSafeApplicationPath(url.searchParams.get("next")) ?? "/admin";
  const origin = resolveCallbackRedirectOrigin(request.url);
  const providerError = url.searchParams.get("error");

  if (origin === null) {
    return NextResponse.redirect(
      new URL(`/${locale}/sign-in`, CANONICAL_LOCAL_APP_ORIGIN),
    );
  }

  if (providerError !== null) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
  }

  if (code !== null && getSupabaseConnection() !== null) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
    }
  }

  const destination = new URL(
    `/${locale}${toNavigationHref(nextPath)}`,
    origin,
  );

  return NextResponse.redirect(destination);
}
