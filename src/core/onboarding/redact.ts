const TOKEN_FIELD = /invitation[_-]?token/i;

export function redactOnboardingSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(
      /invitation[_-]?token[=:]\s*[A-Za-z0-9._~+-]+/gi,
      "invitation_token=[redacted]",
    );
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactOnboardingSecrets(entry));
  }

  if (value !== null && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = TOKEN_FIELD.test(key)
        ? "[redacted]"
        : redactOnboardingSecrets(entry);
    }
    return next;
  }

  return value;
}

export function invitationTokenLeaked(
  haystack: unknown,
  token: string,
): boolean {
  if (token.length === 0) {
    return false;
  }
  return JSON.stringify(haystack).includes(token);
}
