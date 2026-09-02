const LETTER = /[\p{L}\p{N}]/u;

export function publicDisplayInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .map((part) => {
      const match = part.match(LETTER);
      return match === null ? "" : match[0].toUpperCase();
    })
    .filter((letter) => letter.length > 0);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0] ?? "?";
  }

  return `${parts[0] ?? ""}${parts[1] ?? ""}`;
}
