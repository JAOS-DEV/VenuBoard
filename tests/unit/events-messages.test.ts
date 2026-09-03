import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import th from "../../messages/th.json";

describe("events admin messages", () => {
  it("keeps English and Thai eventsAdmin keys aligned", () => {
    expect(Object.keys(en.eventsAdmin).sort()).toEqual(
      Object.keys(th.eventsAdmin).sort(),
    );
  });

  it("eventsAdmin section exists in both languages", () => {
    expect(en).toHaveProperty("eventsAdmin");
    expect(th).toHaveProperty("eventsAdmin");
  });

  it("admin section has eventsModule key in both languages", () => {
    expect(en.admin).toHaveProperty("eventsModule");
    expect(th.admin).toHaveProperty("eventsModule");
    expect(en.admin.eventsModule).toBeTruthy();
    expect(th.admin.eventsModule).toBeTruthy();
  });

  it("all required eventsAdmin keys are present in EN", () => {
    const requiredKeys = [
      "title",
      "intro",
      "venueSelector",
      "useVenue",
      "noVenue",
      "noAccess",
      "unavailable",
      "createEvent",
      "editEvent",
      "stateNotEntitled",
      "stateEntitledDisabled",
      "stateEnabled",
      "stateTrial",
      "stateExpired",
      "stateRestricted",
      "stateSuspended",
      "draft",
      "pendingApproval",
      "approved",
      "scheduled",
      "published",
      "cancelled",
      "archived",
      "titleEn",
      "titleTh",
      "summaryEn",
      "summaryTh",
      "descriptionEn",
      "descriptionTh",
      "ctaLabelEn",
      "ctaLabelTh",
      "startsAt",
      "endsAt",
      "isAllDay",
      "timezone",
      "posterDeferred",
      "posterStoragePath",
      "saveDraft",
      "submitForApproval",
      "approve",
      "reject",
      "rejectionReason",
      "publishNow",
      "schedulePublication",
      "scheduledAt",
      "cancel",
      "archive",
      "restoreToDraft",
      "copyToVenue",
      "copyDestination",
      "confirmCancel",
      "confirmArchive",
      "confirmRestore",
      "saved",
      "genericError",
      "forbidden",
      "notFound",
      "conflict",
      "approvalRequired",
      "noEvents",
      "filterAll",
      "filterDraft",
      "filterPending",
      "filterPublished",
      "filterScheduled",
      "filterCancelled",
      "filterArchived",
    ];

    for (const key of requiredKeys) {
      expect(en.eventsAdmin).toHaveProperty(key);
    }
  });

  it("no empty string values in EN eventsAdmin", () => {
    for (const [key, value] of Object.entries(en.eventsAdmin)) {
      expect(value, `Key "${key}" is empty`).not.toBe("");
    }
  });

  it("no empty string values in TH eventsAdmin", () => {
    for (const [key, value] of Object.entries(th.eventsAdmin)) {
      expect(value, `Key "${key}" is empty`).not.toBe("");
    }
  });
});
