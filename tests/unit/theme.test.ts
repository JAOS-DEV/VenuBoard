import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/core/theme/constants";
import { THEME_INIT_SCRIPT } from "@/core/theme/init-script";

describe("theme bootstrap", () => {
  it("keeps the theme init script static and bound to the storage key", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain("localStorage");
    expect(THEME_INIT_SCRIPT).not.toContain("<script");
  });

  it("does not render a script tag from the client ThemeProvider", () => {
    const source = readFileSync("src/core/theme/theme-provider.tsx", "utf8");
    expect(source).not.toContain("<script");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("next-themes");
  });
});
