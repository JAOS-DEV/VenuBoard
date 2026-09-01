import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

function isClientModule(source: string): boolean {
  return (
    source.includes('"use client"') ||
    source.includes("'use client'") ||
    source.includes('"use client";')
  );
}

describe("SUPABASE_SECRET_KEY boundary", () => {
  it("is imported only through the server-only env module", () => {
    const server = readFileSync(join(ROOT, "src/core/env/server.ts"), "utf8");
    expect(server).toContain('import "server-only"');

    const clientEnv = readFileSync(
      join(ROOT, "src/core/env/client.ts"),
      "utf8",
    );
    expect(clientEnv).not.toContain("SUPABASE_SECRET_KEY");

    const connection = readFileSync(
      join(ROOT, "src/core/db/connection.ts"),
      "utf8",
    );
    expect(connection).not.toContain("SUPABASE_SECRET_KEY");

    const serverClient = readFileSync(
      join(ROOT, "src/core/db/server-client.ts"),
      "utf8",
    );
    expect(serverClient).toContain('import "server-only"');
    expect(serverClient).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("is never referenced from a client component", () => {
    const files = walk(join(ROOT, "src"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!isClientModule(source)) {
        continue;
      }
      expect(source, file).not.toContain("SUPABASE_SECRET_KEY");
      expect(source, file).not.toMatch(/@\/core\/env\/server/);
    }
  });
});
