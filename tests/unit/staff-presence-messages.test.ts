import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import th from "../../messages/th.json";

describe("staff presence messages", () => {
  it("keeps English and Thai staffAdmin keys aligned", () => {
    expect(Object.keys(en.staffAdmin).sort()).toEqual(
      Object.keys(th.staffAdmin).sort(),
    );
    expect(Object.keys(en.staffPublic).sort()).toEqual(
      Object.keys(th.staffPublic).sort(),
    );
  });
});
