const VENUE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

export function publicVenueUpdatesPath(slug: string): string | null {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) {
    return null;
  }
  if (!VENUE_SLUG.test(slug)) {
    return null;
  }
  return `/v/${slug}/updates`;
}
