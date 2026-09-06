const VENUE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

export function publicVenueHomePath(slug: string): string | null {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) {
    return null;
  }
  if (!VENUE_SLUG.test(slug)) {
    return null;
  }
  return `/v/${slug}`;
}

export function publicVenueOffersPath(slug: string): string | null {
  const home = publicVenueHomePath(slug);
  return home === null ? null : `${home}/offers`;
}

export function publicVenueUpdatesPath(slug: string): string | null {
  const home = publicVenueHomePath(slug);
  return home === null ? null : `${home}/updates`;
}

export function publicVenueEnquirePath(slug: string): string | null {
  const home = publicVenueHomePath(slug);
  return home === null ? null : `${home}/enquire`;
}

export function pathnameWithoutLocale(pathname: string): string {
  const match = /^\/(en|th)(?=\/|$)/.exec(pathname);
  if (match === null) {
    return pathname.length > 0 ? pathname : "/";
  }
  const rest = pathname.slice(match[0].length);
  return rest.length > 0 ? rest : "/";
}

export function isPublicVenueHomePath(pathname: string, slug: string): boolean {
  const home = publicVenueHomePath(slug);
  return home !== null && pathnameWithoutLocale(pathname) === home;
}
