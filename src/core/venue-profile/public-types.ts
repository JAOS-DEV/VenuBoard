export interface PublicVenueContact {
  type: "phone" | "email" | "website";
  value: string;
}

export interface PublicVenueProfile {
  available: boolean;
  preview: boolean;
  publicationState: string | null;
  timezone: string;
  hoursMode: "unknown" | "scheduled";
  name: string;
  tagline: string | null;
  description: string | null;
  directions: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  contentClassification: string | null;
  contacts: PublicVenueContact[];
  weeklyIntervals: {
    day: number;
    opens: string;
    closes: string;
    closesNextDay: boolean;
  }[];
  closedWeekdays: number[];
  exceptions: {
    date: string;
    closed: boolean;
    intervals: {
      opens: string;
      closes: string;
      closesNextDay: boolean;
    }[];
  }[];
}

export interface AdminVenueProfile {
  venueId: string;
  businessId: string;
  slug: string;
  timezone: string;
  updatedAt: string;
  publicationState: string;
  openingHoursMode: "unknown" | "scheduled";
  name: string;
  nameEn: string;
  taglineEn: string;
  descriptionEn: string;
  directionsEn: string;
  nameTh: string;
  taglineTh: string;
  descriptionTh: string;
  directionsTh: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  email: string;
  phone: string;
  website: string;
  branding: {
    themeKey: string;
    fontKey: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  } | null;
  week: {
    day: number;
    closed: boolean;
    intervals: { opens: string; closes: string; closesNextDay: boolean }[];
  }[];
  exceptions: {
    date: string;
    closed: boolean;
    intervals: { opens: string; closes: string; closesNextDay: boolean }[];
    internalNote: string;
  }[];
}
