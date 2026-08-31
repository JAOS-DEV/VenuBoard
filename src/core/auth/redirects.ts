/**
 * Same-origin application path validation for post-auth redirects.
 *
 * Query parameters, invitation payloads and Host headers are never trusted as
 * redirect targets. Only a normalised relative path that stays inside this
 * application may be used.
 */

const MAX_PATH_LENGTH = 512;
const ALLOWED_LOCALES = new Set(["en", "th"]);

const SAFE_PATH = /^\/[A-Za-z0-9/_\-.]*$/;
const PROTOCOL = /^[a-zA-Z][a-zA-Z+.-]*:/;
const ENCODED_SLASH = /%2f/i;
const ENCODED_BACKSLASH = /%5c/i;
const ENCODED_AT = /%40/i;

export type SafeApplicationPath = `/${string}`;

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function stripQueryAndHash(path: string): string {
  const queryIndex = path.search(/[?#]/);
  if (queryIndex === -1) {
    return path;
  }
  return path.slice(0, queryIndex);
}

/**
 * Returns a safe in-app path, or null if the value must not be used for a
 * redirect. Rejects absolute URLs, protocol-relative URLs, encoded bypasses,
 * backslashes, control characters and unknown locale prefixes.
 */
export function parseSafeApplicationPath(
  raw: unknown,
): SafeApplicationPath | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PATH_LENGTH) {
    return null;
  }

  if (
    ENCODED_SLASH.test(trimmed) ||
    ENCODED_BACKSLASH.test(trimmed) ||
    ENCODED_AT.test(trimmed)
  ) {
    return null;
  }

  const decoded = decodeOnce(trimmed);
  if (decoded === null || decoded !== trimmed) {
    // Either malformed encoding, or any percent-encoding. Require the caller
    // to pass a already-decoded path so `%2f` cannot sneak past the slash check.
    if (decoded === null) {
      return null;
    }
    if (decoded !== trimmed && /%/i.test(trimmed)) {
      return parseSafeApplicationPath(decoded);
    }
  }

  const withoutControls = trimmed.replace(/[\u0000-\u001f\u007f]/g, "");
  if (withoutControls !== trimmed) {
    return null;
  }

  const pathOnly = stripQueryAndHash(trimmed);
  if (pathOnly !== trimmed) {
    return null;
  }

  if (!pathOnly.startsWith("/")) {
    return null;
  }

  if (pathOnly.startsWith("//") || pathOnly.startsWith("/\\")) {
    return null;
  }

  if (pathOnly.includes("\\") || pathOnly.includes("@")) {
    return null;
  }

  if (
    PROTOCOL.test(pathOnly) ||
    pathOnly.toLowerCase().startsWith("javascript:")
  ) {
    return null;
  }

  if (pathOnly.includes("://") || pathOnly.includes("http:")) {
    return null;
  }

  const normalised = pathOnly.replace(/\/{2,}/g, "/");
  if (normalised !== pathOnly) {
    return null;
  }

  if (pathOnly.includes("..")) {
    return null;
  }

  if (!SAFE_PATH.test(pathOnly)) {
    return null;
  }

  const segments = pathOnly.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === ".")) {
    return null;
  }

  if (segments[0] !== undefined && segments[0].length === 2) {
    if (!ALLOWED_LOCALES.has(segments[0])) {
      return null;
    }
  }

  return pathOnly as SafeApplicationPath;
}

export function defaultAuthenticatedPath(): SafeApplicationPath {
  return "/admin";
}

/** Locale-stripped path for next-intl navigation helpers. */
export function toNavigationHref(path: SafeApplicationPath): string {
  const stripped = path.replace(/^\/(en|th)(?=\/|$)/, "");
  return stripped.length === 0 ? "/" : stripped;
}

export function signInNavigationHref(returnPath: SafeApplicationPath | null): {
  pathname: "/sign-in";
  query?: { next: string };
} {
  if (returnPath === null) {
    return { pathname: "/sign-in" };
  }
  return { pathname: "/sign-in", query: { next: returnPath } };
}
