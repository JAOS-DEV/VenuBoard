export function resolvePublicModuleHeading(
  heading: string | null,
  fallback: string,
): string {
  const configured = heading?.trim() ?? "";
  return configured.length > 0 ? configured : fallback;
}

export function publicModuleHeadingIsCustom(
  heading: string | null,
  sectionLabel: string,
): boolean {
  const configured = heading?.trim() ?? "";
  if (configured.length === 0) {
    return false;
  }
  return (
    configured.localeCompare(sectionLabel.trim(), undefined, {
      sensitivity: "accent",
    }) !== 0
  );
}
