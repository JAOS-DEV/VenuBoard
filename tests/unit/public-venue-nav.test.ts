import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { publicVenueDestinations } from "@/core/public-venue/destinations";
import {
  publicModuleHeadingIsCustom,
  resolvePublicModuleHeading,
} from "@/core/public-venue/heading";
import {
  publicVenueEnquirePath,
  publicVenueHomePath,
  publicVenueOffersPath,
  publicVenueUpdatesPath,
  isPublicVenueHomePath,
  pathnameWithoutLocale,
} from "@/core/public-venue/paths";
import {
  clearPublicHomeScrollIntent,
  peekPublicHomeScrollIntent,
  readPublicHomeScrollY,
  setPublicHomeScrollIntent,
  writePublicHomeScrollY,
} from "@/core/public-venue/scroll-state";

const harbor = {
  homeHref: publicVenueHomePath("harbor-light"),
  homeLabel: "Home",
  offersHref: publicVenueOffersPath("harbor-light"),
  offersLabel: "Offers",
  updatesHref: publicVenueUpdatesPath("harbor-light"),
  updatesLabel: "Updates",
  enquireHref: publicVenueEnquirePath("harbor-light"),
  enquireLabel: "Send an enquiry",
};

describe("public venue paths", () => {
  it("builds locale-relative venue destinations from a safe slug", () => {
    expect(publicVenueHomePath("harbor-light")).toBe("/v/harbor-light");
    expect(publicVenueOffersPath("harbor-light")).toBe(
      "/v/harbor-light/offers",
    );
    expect(publicVenueUpdatesPath("harbor-light")).toBe(
      "/v/harbor-light/updates",
    );
    expect(publicVenueEnquirePath("harbor-light")).toBe(
      "/v/harbor-light/enquire",
    );
  });

  it("rejects unsafe slugs rather than interpolating them into public paths", () => {
    expect(publicVenueHomePath("")).toBeNull();
    expect(publicVenueHomePath("../admin")).toBeNull();
    expect(publicVenueOffersPath("harbor/light")).toBeNull();
    expect(publicVenueUpdatesPath("Harbor Light")).toBeNull();
    expect(publicVenueEnquirePath("a".repeat(81))).toBeNull();
  });

  it("recognises locale-prefixed and locale-relative venue homepages", () => {
    expect(pathnameWithoutLocale("/en/v/harbor-light")).toBe("/v/harbor-light");
    expect(pathnameWithoutLocale("/v/harbor-light")).toBe("/v/harbor-light");
    expect(isPublicVenueHomePath("/en/v/harbor-light", "harbor-light")).toBe(
      true,
    );
    expect(
      isPublicVenueHomePath("/v/harbor-light/offers", "harbor-light"),
    ).toBe(false);
    expect(isPublicVenueHomePath("/en/v/night-orchid", "harbor-light")).toBe(
      false,
    );
  });
});

describe("public venue destinations", () => {
  it("keeps Offers and Updates when the homepage preview is disabled or empty", () => {
    const links = publicVenueDestinations({
      ...harbor,
      offersAvailable: true,
      updatesAvailable: true,
      enquireAvailable: true,
      enquireAccepting: true,
    });

    expect(links.map((link) => link.href)).toEqual([
      "/v/harbor-light",
      "/v/harbor-light/offers",
      "/v/harbor-light/updates",
      "/v/harbor-light/enquire",
    ]);
    expect(links[0]?.scroll).toBe(false);
    expect(links[1]?.scroll).toBeUndefined();
    expect(JSON.stringify(links)).not.toContain("/admin");
    expect(JSON.stringify(links)).not.toContain("/platform");
    expect(JSON.stringify(links)).not.toContain("/dev");
  });

  it("omits unavailable modules and paused enquiry intake", () => {
    const links = publicVenueDestinations({
      ...harbor,
      offersAvailable: false,
      updatesAvailable: true,
      enquireAvailable: true,
      enquireAccepting: false,
    });

    expect(links.map((link) => link.label)).toEqual(["Home", "Updates"]);
  });

  it("omits enquiry when the module itself is unavailable", () => {
    const links = publicVenueDestinations({
      ...harbor,
      offersAvailable: true,
      updatesAvailable: false,
      enquireAvailable: false,
      enquireAccepting: true,
    });

    expect(links.map((link) => link.href)).toEqual([
      "/v/harbor-light",
      "/v/harbor-light/offers",
    ]);
  });
});

describe("public module heading identity", () => {
  it("keeps a custom heading and treats matching copy as the section label", () => {
    expect(
      resolvePublicModuleHeading("This week at Harbor Light", "Offers"),
    ).toBe("This week at Harbor Light");
    expect(
      publicModuleHeadingIsCustom("This week at Harbor Light", "Offers"),
    ).toBe(true);
    expect(publicModuleHeadingIsCustom("Offers", "Offers")).toBe(false);
    expect(publicModuleHeadingIsCustom("offers", "Offers")).toBe(false);
    expect(publicModuleHeadingIsCustom(null, "Offers")).toBe(false);
    expect(resolvePublicModuleHeading(null, "Offers")).toBe("Offers");
  });
});

describe("public homepage scroll state", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPublicHomeScrollIntent();
  });

  it("scopes saved positions by locale and venue and stores only a number", () => {
    writePublicHomeScrollY("en", "harbor-light", 640);
    writePublicHomeScrollY("th", "harbor-light", 12);
    writePublicHomeScrollY("en", "night-orchid", 900);
    expect(readPublicHomeScrollY("en", "harbor-light")).toBe(640);
    expect(readPublicHomeScrollY("th", "harbor-light")).toBe(12);
    expect(readPublicHomeScrollY("en", "night-orchid")).toBe(900);
    expect(
      sessionStorage.getItem("vb.public-home-scroll.v1:en:harbor-light"),
    ).toBe("640");
    expect(
      sessionStorage.getItem("vb.public-home-scroll.v1:en:harbor-light"),
    ).not.toContain("@");
    expect(readPublicHomeScrollY("en", "../admin")).toBeNull();
    writePublicHomeScrollY("en", "harbor-light", -20);
    expect(readPublicHomeScrollY("en", "harbor-light")).toBe(640);
  });

  it("keeps a one-shot restore/top intent without enquiry payload", () => {
    setPublicHomeScrollIntent("restore");
    expect(peekPublicHomeScrollIntent()).toBe("restore");
    expect(sessionStorage.getItem("vb.public-home-scroll-intent.v1")).toBe(
      "restore",
    );
    clearPublicHomeScrollIntent();
    expect(peekPublicHomeScrollIntent()).toBeNull();
    setPublicHomeScrollIntent("top");
    expect(peekPublicHomeScrollIntent()).toBe("top");
  });
});

describe("public venue navigation sources", () => {
  it("uses explicit application links and the shared back-link pattern", () => {
    const files = [
      "src/app/[locale]/(public)/v/[venueSlug]/layout.tsx",
      "src/app/[locale]/(public)/v/[venueSlug]/offers/page.tsx",
      "src/app/[locale]/(public)/v/[venueSlug]/updates/page.tsx",
      "src/app/[locale]/(public)/v/[venueSlug]/enquire/page.tsx",
      "src/components/patterns/public-venue-back-link.tsx",
      "src/components/patterns/public-venue-scroll-manager.tsx",
      "src/components/shells/public-venue-shell.tsx",
      "src/components/offers/public-offers-preview.tsx",
      "src/components/feed/public-feed-preview.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("router.back");
      expect(source).not.toContain("useRouter");
      expect(source).not.toContain("dangerouslySetInnerHTML");
    }

    const back = readFileSync(
      "src/components/patterns/public-venue-back-link.tsx",
      "utf8",
    );
    expect(back).toContain('data-testid="public-venue-back"');
    expect(back).toContain("min-h-11");
    expect(back).toContain("scroll={false}");
    expect(back).not.toContain("w-full");
    expect(back).not.toContain("<Button");

    const shell = readFileSync(
      "src/components/shells/public-venue-shell.tsx",
      "utf8",
    );
    expect(shell).toContain("showDeveloperHub={false}");
    expect(shell).toContain("identityScroll={false}");
    expect(shell).toContain("PublicVenueScrollManager");
    expect(shell).not.toContain('href="/admin"');
    expect(shell).not.toContain('href="/platform"');
    expect(shell).not.toContain('href="/dev"');

    const layout = readFileSync(
      "src/app/[locale]/(public)/v/[venueSlug]/layout.tsx",
      "utf8",
    );
    expect(layout).toContain("publicVenueDestinations");
    expect(layout).toContain("offers.available");
    expect(layout).toContain("feed.available");
    expect(layout).toContain("booking.available");
    expect(layout).toContain("booking.accepting");
    expect(layout).not.toContain("previewEnabled");

    const offersPreview = readFileSync(
      "src/components/offers/public-offers-preview.tsx",
      "utf8",
    );
    expect(offersPreview).toContain("publicVenueOffersPath");
    expect(offersPreview).not.toContain("/v/${venueSlug}/offers");
    expect(offersPreview).toContain("PublicModuleHeading");
    expect(offersPreview).toContain("previewEnabled");

    const feedPreview = readFileSync(
      "src/components/feed/public-feed-preview.tsx",
      "utf8",
    );
    expect(feedPreview).toContain("publicVenueUpdatesPath");
    expect(feedPreview).toContain("PublicModuleHeading");
    expect(
      readFileSync("src/components/offers/public-offers-list.tsx", "utf8"),
    ).toContain('t("empty")');
    expect(
      readFileSync("src/components/feed/public-feed-list.tsx", "utf8"),
    ).toContain('t("empty")');

    const scrollState = readFileSync(
      "src/core/public-venue/scroll-state.ts",
      "utf8",
    );
    expect(scrollState).toContain("sessionStorage");
    expect(scrollState).not.toContain("localStorage");
    expect(scrollState).not.toContain("displayName");
    expect(scrollState).not.toContain("email");
    const manager = readFileSync(
      "src/components/patterns/public-venue-scroll-manager.tsx",
      "utf8",
    );
    expect(manager).not.toContain("router.back");
    expect(manager).not.toContain('behavior: "smooth"');
    expect(manager).toContain("composedPath");
    expect(manager).not.toContain("5_000");
    expect(manager).not.toContain("enforceLock");
    expect(scrollState).toContain("schedulePublicHomeScrollRestore");
    expect(scrollState).not.toContain("5_000");

    const calendar = readFileSync(
      "src/components/events/venue-events-calendar.tsx",
      "utf8",
    );
    expect(calendar).toContain("preventScroll: true");
    expect(calendar).toContain("initialSelectedDateISO");
  });
});
