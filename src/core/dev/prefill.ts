import { parseSafeApplicationPath } from "@/core/auth/redirects";
import type { SafeApplicationPath } from "@/core/auth/redirects";

import { resolveDeveloperPersona } from "./personas";

export interface SignInPrefill {
  email: string | null;
  nextPath: SafeApplicationPath | null;
}

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Resolve a sign-in email and return path for ordinary local development.
 *
 * Prefill is allowlist-only: the query carries a persona identifier, never an
 * arbitrary email. Unknown identifiers prefill nothing. Staging, production
 * and test builds pass `enabled: false` and ignore the persona parameter.
 */
export function resolveSignInPrefill(input: {
  enabled: boolean;
  personaId: string | string[] | undefined;
  nextRaw: unknown;
}): SignInPrefill {
  const nextPath = parseSafeApplicationPath(input.nextRaw);

  if (!input.enabled) {
    return { email: null, nextPath };
  }

  const persona = resolveDeveloperPersona(firstQueryValue(input.personaId));
  if (persona === null) {
    return { email: null, nextPath };
  }

  return {
    email: persona.email,
    nextPath: nextPath ?? persona.destination,
  };
}
