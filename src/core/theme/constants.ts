export const THEME_STORAGE_KEY = "venuboard-theme";

export const THEME_NAMES = ["light", "dark", "system"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export type ResolvedTheme = "light" | "dark";

export function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark" || value === "system";
}
