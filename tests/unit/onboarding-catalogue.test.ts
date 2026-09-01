import { describe, expect, it } from "vitest";

import {
  mapCatalogueModules,
  mapCatalogueThemes,
  mapReservedSlugs,
} from "@/core/onboarding/catalogue-map";

describe("onboarding catalogue mapping", () => {
  it("maps database rows without trusting a client list", () => {
    expect(
      mapCatalogueModules([
        {
          key: "core_profile",
          name: "Core venue profile",
          description: "Identity",
          is_core: true,
          sort_order: 1,
        },
        {
          key: "offers",
          name: "Offers",
          description: "Promotions",
          is_core: false,
          sort_order: 7,
        },
      ]),
    ).toEqual([
      {
        key: "core_profile",
        name: "Core venue profile",
        description: "Identity",
        isCore: true,
        sortOrder: 1,
      },
      {
        key: "offers",
        name: "Offers",
        description: "Promotions",
        isCore: false,
        sortOrder: 7,
      },
    ]);

    expect(mapCatalogueThemes([{ key: "system", name: "System" }])).toEqual([
      { key: "system", name: "System" },
    ]);
    expect(mapReservedSlugs([{ slug: "admin" }])).toEqual(["admin"]);
  });
});
