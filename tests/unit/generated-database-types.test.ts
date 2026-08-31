import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * CI cannot generate types from a hosted Supabase project. This test is the
 * practical stale-type signal: if someone restores the scaffold placeholder,
 * or generates types that omit the foundation tables, the suite fails without
 * needing Docker in GitHub Actions.
 */
describe("generated database types", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../src/core/db/types.ts"),
    "utf8",
  );

  it("are generated from the schema, not the scaffold placeholder", () => {
    expect(source).not.toContain("TEMPORARY placeholder");
    expect(source).toContain("export type Database");
    expect(source).toContain("venues:");
    expect(source).toContain("businesses:");
    expect(source).toContain("venue_translations:");
    expect(source).toContain("permission_actions:");
  });
});
