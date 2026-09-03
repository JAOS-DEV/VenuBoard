import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SEMANTIC_COLOR_TOKENS, STATUS_VARIANTS } from "@/core/ui/tokens";
import {
  isRawInternalState,
  moduleAvailabilityCopyKey,
} from "@/core/ui/status";
import { safeAvatarStyle, safeVenueBrandStyle } from "@/core/ui/branding";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../../src/app/globals.css"), "utf8");

describe("design tokens", () => {
  it("declares every semantic colour token in light and dark CSS", () => {
    for (const token of SEMANTIC_COLOR_TOKENS) {
      expect(css).toContain(`--${token}:`);
    }
    expect(css).toContain(".dark {");
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("color-scheme: dark");
  });

  it("declares status token pairs", () => {
    for (const variant of STATUS_VARIANTS) {
      expect(css).toContain(`--status-${variant}:`);
      expect(css).toContain(`--status-${variant}-foreground:`);
    }
  });
});

describe("module availability copy", () => {
  it("maps internal states to human keys", () => {
    expect(moduleAvailabilityCopyKey("not_entitled")).toBe("notEntitled");
    expect(moduleAvailabilityCopyKey("entitled_disabled")).toBe(
      "moduleDisabled",
    );
    expect(moduleAvailabilityCopyKey("expired")).toBe("trialExpired");
    expect(moduleAvailabilityCopyKey("restricted")).toBe(
      "temporarilyUnavailable",
    );
  });

  it("detects raw internal vocabulary", () => {
    expect(isRawInternalState("not_entitled")).toBe(true);
    expect(isRawInternalState("Not included in this venue’s plan")).toBe(false);
  });
});

describe("venue branding", () => {
  it("picks contrasting avatar ink for a bright accent", () => {
    const style = safeAvatarStyle({
      primaryColor: "#1F4E5F",
      backgroundColor: "#F7F4EF",
      textColor: "#1A1A1A",
      accentColor: "#F2C14E",
    });
    expect(style?.color).toBe("#1A1A1A");
    expect(style?.backgroundColor).toBe("#F2C14E");
  });

  it("omits unsafe text/background pairs", () => {
    const style = safeVenueBrandStyle(
      {
        primaryColor: "#111111",
        backgroundColor: "#FFFF00",
        textColor: "#FFFFFF",
        accentColor: "#1D4ED8",
      },
      "light",
    );
    expect(style).toBeDefined();
    expect(style).not.toHaveProperty("--venue-surface");
    expect(style).toHaveProperty("--venue-accent");
  });

  it("keeps a contrasting pair", () => {
    const style = safeVenueBrandStyle(
      {
        primaryColor: "#111111",
        backgroundColor: "#FFFFFF",
        textColor: "#111111",
        accentColor: "#1D4ED8",
      },
      "light",
    );
    expect(style).toHaveProperty("--venue-surface");
  });
});
