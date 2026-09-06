import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { publicBookingIntakeAllowed } from "@/core/booking-requests/intake-guard";
import {
  bookingOutcomeCopyKey,
  bookingStateBadgeVariant,
  bookingStateCopyKey,
} from "@/core/booking-requests/labels";
import {
  bookingIntakeIsOpen,
  mapBookingModuleAvailability,
} from "@/core/booking-requests/module-state";
import { publicVenueEnquirePath } from "@/core/booking-requests/public-path";
import {
  mapBookingRpcResult,
  normalizeBookingErrorCode,
} from "@/core/booking-requests/result";
import {
  SubmitBookingEnquirySchema,
  UpdateBookingSettingsSchema,
} from "@/core/booking-requests/schema";
import {
  parseVenueLocalDateTime,
  venueInstantToLocalInput,
  venueLocalDateTimeToUtc,
} from "@/core/booking-requests/timezone";
import { isRawInternalState } from "@/core/ui/status";

describe("booking enquiry validation", () => {
  it("accepts bounded public intake fields and a uuid idempotency key", () => {
    const parsed = SubmitBookingEnquirySchema.safeParse({
      venueSlug: "harbor-light",
      displayName: "  Alex Harbour  ",
      email: "alex.harbour@example.com",
      partySize: 2,
      requestedLocal: "2026-09-12T19:00",
      locale: "en",
      message: "Window table",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.displayName).toBe("Alex Harbour");
    }

    expect(
      SubmitBookingEnquirySchema.safeParse({
        venueSlug: "Harbor Light",
        displayName: "Alex",
        email: "alex.harbour@example.com",
        partySize: 2,
        requestedLocal: "2026-09-12T19:00",
        locale: "en",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);

    expect(
      SubmitBookingEnquirySchema.safeParse({
        venueSlug: "harbor-light",
        displayName: "Alex",
        email: "not-an-email",
        partySize: 2,
        requestedLocal: "2026-09-12T19:00",
        locale: "en",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });

  it("rejects executable settings keys via bounded schema", () => {
    const parsed = UpdateBookingSettingsSchema.safeParse({
      venueId: "00000000-0000-4000-8000-000000000101",
      isEnabled: true,
      isPubliclyVisible: true,
      acceptingEnquiries: true,
      minPartySize: 1,
      maxPartySize: 12,
      horizonDays: 90,
      leadTimeMinutes: 60,
      headingEn: "Enquire",
    });
    expect(parsed.success).toBe(true);
    expect(
      UpdateBookingSettingsSchema.safeParse({
        venueId: "00000000-0000-4000-8000-000000000101",
        isEnabled: true,
        isPubliclyVisible: true,
        acceptingEnquiries: true,
        minPartySize: 1,
        maxPartySize: 12,
        horizonDays: 90,
        leadTimeMinutes: 60,
        javascript: "alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("booking timezone conversion", () => {
  it("converts venue-local time without using the device zone", () => {
    const local = parseVenueLocalDateTime("2026-09-12T19:00");
    expect(local).not.toBeNull();
    if (local === null) {
      return;
    }
    const utc = venueLocalDateTimeToUtc(local, "Asia/Bangkok");
    expect(utc?.toISOString()).toBe("2026-09-12T12:00:00.000Z");
    expect(venueInstantToLocalInput(utc as Date, "Asia/Bangkok")).toBe(
      "2026-09-12T19:00",
    );
  });
});

describe("booking module state", () => {
  it("treats paused intake as entitled but not open", () => {
    const paused = mapBookingModuleAvailability({
      entitled: true,
      enabled: true,
      accepting: false,
      entitlementSource: "plan",
      entitlementEnded: false,
      subscriptionState: "active",
    });
    expect(paused).toBe("paused");
    expect(bookingIntakeIsOpen(paused)).toBe(false);
    expect(
      bookingIntakeIsOpen(
        mapBookingModuleAvailability({
          entitled: true,
          enabled: true,
          accepting: true,
          entitlementSource: "trial",
          entitlementEnded: false,
          subscriptionState: "active",
        }),
      ),
    ).toBe(true);
    expect(
      bookingIntakeIsOpen(
        mapBookingModuleAvailability({
          entitled: true,
          enabled: true,
          accepting: true,
          entitlementSource: "plan",
          entitlementEnded: false,
          subscriptionState: "restricted",
        }),
      ),
    ).toBe(true);
  });

  it("keeps historical reads behind entitlement", () => {
    expect(
      mapBookingModuleAvailability({
        entitled: false,
        enabled: true,
        accepting: true,
        entitlementSource: "trial",
        entitlementEnded: true,
        subscriptionState: "active",
      }),
    ).toBe("expired");
  });
});

describe("booking errors and intake guard", () => {
  it("normalises unknown codes to unavailable", () => {
    expect(normalizeBookingErrorCode("duplicate_key")).toBe("unavailable");
    expect(mapBookingRpcResult({ ok: false, code: "conflict" })).toEqual({
      ok: false,
      code: "conflict",
    });
    expect(mapBookingRpcResult({ ok: true })).toEqual({ ok: true });
  });

  it("fails hosted public intake closed", () => {
    expect(publicBookingIntakeAllowed("local")).toBe(true);
    expect(publicBookingIntakeAllowed("test")).toBe(true);
    expect(publicBookingIntakeAllowed("staging")).toBe(false);
    expect(publicBookingIntakeAllowed("production")).toBe(false);

    const actionSource = readFileSync(
      "src/core/booking-requests/actions.ts",
      "utf8",
    );
    const submitFn = actionSource.slice(
      actionSource.indexOf("export async function submitBookingEnquiryAction"),
      actionSource.indexOf("export async function reviewBookingEnquiryAction"),
    );
    const guardAt = submitFn.indexOf("publicBookingIntakeAllowed");
    const rpcAt = submitFn.indexOf("submitBookingEnquiryRpc");
    expect(guardAt).toBeGreaterThan(-1);
    expect(rpcAt).toBeGreaterThan(guardAt);

    const clientSource = readFileSync(
      "src/core/booking-requests/intake-client.ts",
      "utf8",
    );
    expect(clientSource).toContain('import "server-only"');
    expect(clientSource).toContain('rpc("submit_booking_enquiry"');
    expect(clientSource).not.toContain("review_booking_enquiry");
    expect(clientSource).not.toContain("close_booking_enquiry");
  });
});

describe("booking labels and public path", () => {
  it("uses operator copy rather than raw states", () => {
    expect(bookingStateCopyKey("in_review")).toBe("stateInReview");
    expect(bookingOutcomeCopyKey("handled")).toBe("outcomeHandled");
    expect(bookingStateBadgeVariant("new")).toBe("pending");
    expect(isRawInternalState("in_review")).toBe(false);
  });

  it("builds a slug-only public enquire path", () => {
    expect(publicVenueEnquirePath("harbor-light")).toBe(
      "/v/harbor-light/enquire",
    );
    expect(publicVenueEnquirePath("../evil")).toBeNull();
    expect(publicVenueEnquirePath("harbor/light")).toBeNull();
  });
});

describe("booking privacy surfaces", () => {
  it("does not put customer payload in urls, storage or html injection", () => {
    const files = [
      "src/core/booking-requests/actions.ts",
      "src/core/booking-requests/queries.ts",
      "src/core/booking-requests/intake-client.ts",
      "src/components/booking-requests/public-booking-form.tsx",
      "src/components/booking-requests/booking-admin-detail.tsx",
      "src/app/[locale]/admin/bookings/page.tsx",
      "src/app/[locale]/(public)/v/[venueSlug]/enquire/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("dangerouslySetInnerHTML");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("console.log");
    }

    const enquirePage = readFileSync(
      "src/app/[locale]/(public)/v/[venueSlug]/enquire/page.tsx",
      "utf8",
    );
    expect(enquirePage).toContain("adult-notice");
    expect(enquirePage).toContain("nightlife_18_plus");

    const listPage = readFileSync(
      "src/app/[locale]/admin/bookings/page.tsx",
      "utf8",
    );
    expect(listPage).toContain("ResponsiveFilterControls");
    expect(listPage).toContain("min-h-11");
    expect(listPage).not.toMatch(/href=\{`\/admin\/bookings\/\$\{.*email/);
  });

  it("gates bookings nav on booking actions rather than create_content", () => {
    const surfaces = readFileSync("src/core/authz/surfaces.ts", "utf8");
    expect(surfaces).toContain("hasBookingsAccess");
    expect(surfaces).toContain("view_bookings");
    expect(surfaces).toContain("view_booking_customer_details");
    expect(surfaces).toMatch(/const BOOKING_ACTIONS = \[[^\]]*view_bookings/s);
  });
});
