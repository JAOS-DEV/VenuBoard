import type { CSSProperties } from "react";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export interface VenueBrandColors {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

function luminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function safeHex(value: string | null | undefined, fallback: string): string {
  if (value !== null && value !== undefined && HEX.test(value)) {
    return value;
  }
  return fallback;
}

/**
 * Public venue branding may tint highlights. Core text/background stay on
 * product tokens unless the stored pair still meets a 4.5:1 contrast ratio.
 */
export function safeAvatarStyle(
  branding: VenueBrandColors | null | undefined,
): CSSProperties | undefined {
  if (branding === null || branding === undefined) {
    return undefined;
  }
  const background = safeHex(branding.accentColor, "#525252");
  const candidates = [
    safeHex(branding.textColor, "#171717"),
    safeHex(branding.backgroundColor, "#FFFFFF"),
    "#171717",
    "#FAFAFA",
  ];
  const color = candidates.find(
    (candidate) => contrast(background, candidate) >= 4.5,
  );
  if (color === undefined) {
    return undefined;
  }
  return { backgroundColor: background, color };
}

export function safeVenueBrandStyle(
  branding: VenueBrandColors | null | undefined,
  theme: "light" | "dark",
): CSSProperties | undefined {
  if (branding === null || branding === undefined) {
    return undefined;
  }

  const accent = safeHex(
    branding.accentColor,
    theme === "dark" ? "#8EB4FF" : "#1D4ED8",
  );
  const primary = safeHex(
    branding.primaryColor,
    theme === "dark" ? "#E5E5E5" : "#171717",
  );
  const background = safeHex(
    branding.backgroundColor,
    theme === "dark" ? "#171717" : "#FFFFFF",
  );
  const text = safeHex(
    branding.textColor,
    theme === "dark" ? "#FAFAFA" : "#171717",
  );
  const pairOk = contrast(background, text) >= 4.5;

  return {
    "--venue-accent": accent,
    "--venue-primary": primary,
    ...(pairOk
      ? {
          "--venue-surface": background,
          "--venue-ink": text,
        }
      : {}),
  } as CSSProperties;
}
