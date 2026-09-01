export interface CatalogueModule {
  key: string;
  name: string;
  description: string;
  isCore: boolean;
  sortOrder: number;
}

export interface CatalogueTheme {
  key: string;
  name: string;
}

export interface OnboardingCatalogue {
  modules: CatalogueModule[];
  themes: CatalogueTheme[];
  reservedSlugs: string[];
  defaultQuotaBytes: number | null;
}

export function mapCatalogueModules(
  rows: ReadonlyArray<{
    key: string;
    name: string;
    description: string;
    is_core: boolean;
    sort_order: number;
  }>,
): CatalogueModule[] {
  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    isCore: row.is_core,
    sortOrder: row.sort_order,
  }));
}

export function mapCatalogueThemes(
  rows: ReadonlyArray<{ key: string; name: string }>,
): CatalogueTheme[] {
  return rows.map((row) => ({ key: row.key, name: row.name }));
}

export function mapReservedSlugs(
  rows: ReadonlyArray<{ slug: string }>,
): string[] {
  return rows.map((row) => row.slug);
}
