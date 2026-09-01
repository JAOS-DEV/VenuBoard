import { describe, expect, it } from "vitest";

import {
  canonicalHexColor,
  contrastRatio,
  contrastWarning,
} from "@/core/onboarding/colors";

describe("canonicalHexColor", () => {
  it("accepts six-digit hex and canonicalises case", () => {
    expect(canonicalHexColor("#1f2937")).toBe("#1F2937");
    expect(canonicalHexColor("  #FFFFFF  ")).toBe("#FFFFFF");
  });

  it("rejects CSS functions, named colours and shorthand", () => {
    expect(canonicalHexColor("rgb(1,2,3)")).toBeNull();
    expect(canonicalHexColor("red")).toBeNull();
    expect(canonicalHexColor("#fff")).toBeNull();
    expect(canonicalHexColor("url(#x)")).toBeNull();
    expect(canonicalHexColor("var(--bg)")).toBeNull();
  });
});

describe("contrast", () => {
  it("warns below WCAG 4.5:1 and allows stronger pairs", () => {
    expect(contrastWarning("#111827", "#FFFFFF")).toBe(false);
    expect(contrastWarning("#777777", "#888888")).toBe(true);
    expect(contrastRatio("#111827", "#FFFFFF")).toBeGreaterThan(4.5);
  });
});
