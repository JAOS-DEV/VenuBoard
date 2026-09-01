const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export function isDisplayableInvitationToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function invitationDisplayPath(
  locale: string,
  token: string,
): string | null {
  if (!isDisplayableInvitationToken(token)) {
    return null;
  }
  if (locale !== "en" && locale !== "th") {
    return null;
  }
  return `/${locale}/invite/${token}`;
}
