import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import th from "../../messages/th.json";

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

describe("design-system messages", () => {
  it("keeps shell, status, adminNav, platformNav, gallery and eventsPublic aligned", () => {
    expect(keysOf(en.shell)).toEqual(keysOf(th.shell));
    expect(keysOf(en.status)).toEqual(keysOf(th.status));
    expect(keysOf(en.adminNav)).toEqual(keysOf(th.adminNav));
    expect(keysOf(en.platformNav)).toEqual(keysOf(th.platformNav));
    expect(keysOf(en.gallery)).toEqual(keysOf(th.gallery));
    expect(keysOf(en.eventsPublic)).toEqual(keysOf(th.eventsPublic));
    expect(keysOf(en.eventsPublic.weekdays)).toEqual(
      keysOf(th.eventsPublic.weekdays),
    );
    expect(keysOf(en.publicVenue)).toEqual(keysOf(th.publicVenue));
    expect(en.publicVenue.backToVenue).toBe("Back to {venueName}");
    expect(th.publicVenue.backToVenue).toBe("กลับไปที่ {venueName}");
    expect(en.publicVenue.navOffers).toBe("Offers");
    expect(th.publicVenue.navOffers).toBe("โปรโมชัน");
    expect(en.offersPublic.viewAll).toBe("View all offers");
    expect(th.offersPublic.viewAll).toBe("ดูโปรโมชันทั้งหมด");
    expect(en.feedPublic.viewAll).toBe("View all updates");
    expect(th.feedPublic.viewAll).toBe("ดูข่าวสารทั้งหมด");
    expect(keysOf(en.atmospherePublic)).toEqual(keysOf(th.atmospherePublic));
    expect(keysOf(en.atmosphereAdmin)).toEqual(keysOf(th.atmosphereAdmin));
    expect(keysOf(en.feedPublic)).toEqual(keysOf(th.feedPublic));
    expect(keysOf(en.feedAdmin)).toEqual(keysOf(th.feedAdmin));
    expect(keysOf(en.bookingPublic)).toEqual(keysOf(th.bookingPublic));
    expect(keysOf(en.bookingAdmin)).toEqual(keysOf(th.bookingAdmin));
    expect(keysOf(en.offersPublic)).toEqual(keysOf(th.offersPublic));
    expect(keysOf(en.offersAdmin)).toEqual(keysOf(th.offersAdmin));
  });

  it("does not use raw entitlement strings as user copy", () => {
    expect(en.status.notEntitled).not.toContain("not_entitled");
    expect(en.staffAdmin.stateNotEntitled).not.toBe("Not entitled");
    expect(en.eventsAdmin.stateNotEntitled).not.toContain("not_entitled");
    expect(en.atmosphereAdmin.stateNotEntitled).not.toContain("not_entitled");
    expect(en.feedAdmin.stateNotEntitled).not.toContain("not_entitled");
    expect(en.feedAdmin.title).not.toContain("pending_approval");
    expect(en.feedAdmin.stateNotEntitledHelp).not.toBe(
      en.feedAdmin.stateNotEntitled,
    );
    expect(en.feedAdmin.stateDisabledHelp).not.toBe(en.feedAdmin.stateDisabled);
    expect(en.feedAdmin.filterStatus).toBe("Status");
    expect(th.feedAdmin.filterStatus).toBe("สถานะ");
    expect(en.feedAdmin.filterType).toBe("Content type");
    expect(th.feedAdmin.filterType).toBe("ประเภทเนื้อหา");
    expect(en.feedAdmin.viewPublic).toBe("View public updates");
    expect(th.feedAdmin.viewPublic).toBe("ดูข่าวสารสาธารณะ");
    expect(en.offersAdmin.stateNotEntitled).not.toContain("not_entitled");
    expect(en.offersAdmin.title).not.toContain("pending_approval");
    expect(en.offersAdmin.stateNotEntitledHelp).not.toBe(
      en.offersAdmin.stateNotEntitled,
    );
  });
});
