const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeVenueSlug(raw: string): string | null {
  const compact = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (compact.length === 0 || compact.length > 64) {
    return null;
  }

  if (!SLUG_PATTERN.test(compact)) {
    return null;
  }

  return compact;
}

export function slugRejectReason(
  raw: string,
  reserved: readonly string[],
): string | null {
  const normalised = normalizeVenueSlug(raw);
  if (normalised === null) {
    return "invalid";
  }
  if (reserved.includes(normalised)) {
    return "reserved";
  }
  return null;
}
