import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import th from "../../messages/th.json";

describe("local development messages", () => {
  it("keeps English and Thai developer-hub keys aligned", () => {
    expect(Object.keys(en.dev).sort()).toEqual(Object.keys(th.dev).sort());
    expect(Object.keys(en.dev.serviceLabels).sort()).toEqual(
      Object.keys(th.dev.serviceLabels).sort(),
    );
    expect(Object.keys(en.dev.groups).sort()).toEqual(
      Object.keys(th.dev.groups).sort(),
    );
    expect(Object.keys(en.dev.catalog).sort()).toEqual(
      Object.keys(th.dev.catalog).sort(),
    );

    for (const id of Object.keys(en.dev.catalog) as Array<
      keyof typeof en.dev.catalog
    >) {
      expect(Object.keys(en.dev.catalog[id]).sort()).toEqual(
        Object.keys(th.dev.catalog[id]).sort(),
      );
    }
  });

  it("keeps English and Thai shell notice keys aligned", () => {
    expect(Object.keys(en.shell).sort()).toEqual(Object.keys(th.shell).sort());
    expect(en.shell.localNotice.length).toBeGreaterThan(0);
    expect(th.shell.localNotice.length).toBeGreaterThan(0);
    expect(en.shell.stagingNotice.length).toBeGreaterThan(0);
    expect(th.shell.stagingNotice.length).toBeGreaterThan(0);
  });

  it("removes the obsolete foundation banner", () => {
    expect(JSON.stringify(en)).not.toContain(
      "product modules are not implemented yet",
    );
    expect(JSON.stringify(th)).not.toContain("ยังไม่ได้พัฒนาโมดูลผลิตภัณฑ์");
    expect("scaffoldNotice" in en.shell || "scaffoldNotice" in th.shell).toBe(
      false,
    );
  });
});
