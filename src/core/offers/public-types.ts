import type { OfferLocale } from "./constants";

export interface PublicOfferItem {
  title: string;
  description: string;
  terms: string;
  validFrom: string;
  validUntil: string;
  locale: OfferLocale;
}

export interface PublicVenueOffersPayload {
  available: boolean;
  ok: boolean;
  heading: string | null;
  previewEnabled: boolean;
  previewCount: number;
  timezone: string;
  items: PublicOfferItem[];
  nextCursor: string | null;
  locale: OfferLocale;
}
