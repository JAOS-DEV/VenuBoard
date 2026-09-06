export interface PublicVenueNavLink {
  href: string;
  label: string;
  scroll?: boolean;
}

export interface PublicVenueDestinationInput {
  homeHref: string | null;
  homeLabel: string;
  offersHref: string | null;
  offersLabel: string;
  offersAvailable: boolean;
  updatesHref: string | null;
  updatesLabel: string;
  updatesAvailable: boolean;
  enquireHref: string | null;
  enquireLabel: string;
  enquireAvailable: boolean;
  enquireAccepting: boolean;
}

export function publicVenueDestinations(
  input: PublicVenueDestinationInput,
): PublicVenueNavLink[] {
  const links: PublicVenueNavLink[] = [];

  if (input.homeHref !== null) {
    links.push({
      href: input.homeHref,
      label: input.homeLabel,
      scroll: false,
    });
  }
  if (input.offersAvailable && input.offersHref !== null) {
    links.push({ href: input.offersHref, label: input.offersLabel });
  }
  if (input.updatesAvailable && input.updatesHref !== null) {
    links.push({ href: input.updatesHref, label: input.updatesLabel });
  }
  if (
    input.enquireAvailable &&
    input.enquireAccepting &&
    input.enquireHref !== null
  ) {
    links.push({ href: input.enquireHref, label: input.enquireLabel });
  }

  return links;
}
