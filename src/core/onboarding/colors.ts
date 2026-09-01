const HEX = /^#[0-9A-Fa-f]{6}$/;

export function canonicalHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!HEX.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const canonical = canonicalHexColor(hex);
  if (canonical === null) {
    return null;
  }

  const red = Number.parseInt(canonical.slice(1, 3), 16);
  const green = Number.parseInt(canonical.slice(3, 5), 16);
  const blue = Number.parseInt(canonical.slice(5, 7), 16);

  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const left = relativeLuminance(foreground);
  const right = relativeLuminance(background);
  if (left === null || right === null) {
    return null;
  }

  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastWarning(
  foreground: string,
  background: string,
): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio === null || ratio < 4.5;
}
