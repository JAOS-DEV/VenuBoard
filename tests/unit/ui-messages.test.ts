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
    expect(keysOf(en.atmospherePublic)).toEqual(keysOf(th.atmospherePublic));
    expect(keysOf(en.atmosphereAdmin)).toEqual(keysOf(th.atmosphereAdmin));
  });

  it("does not use raw entitlement strings as user copy", () => {
    expect(en.status.notEntitled).not.toContain("not_entitled");
    expect(en.staffAdmin.stateNotEntitled).not.toBe("Not entitled");
    expect(en.eventsAdmin.stateNotEntitled).not.toContain("not_entitled");
    expect(en.atmosphereAdmin.stateNotEntitled).not.toContain("not_entitled");
  });
});
