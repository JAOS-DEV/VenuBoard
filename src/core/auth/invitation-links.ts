import "server-only";

import { routing, type AppLocale } from "@/core/i18n/routing";

/**
 * Server-only invitation URL construction. The raw token is an authentication
 * secret: callers must not log it, render it in support views, or put it in
 * client-supplied redirects.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export function isPlausibleInvitationToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function invitationPath(
  locale: AppLocale,
  token: string,
): `/${string}` | null {
  if (!isPlausibleInvitationToken(token)) {
    return null;
  }
  if (!routing.locales.includes(locale)) {
    return null;
  }
  return `/${locale}/invite/${token}`;
}

export function buildInvitationUrl(
  origin: string,
  locale: AppLocale,
  token: string,
): string | null {
  const path = invitationPath(locale, token);
  if (path === null) {
    return null;
  }

  try {
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
