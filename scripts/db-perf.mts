#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { parseServerEnv } from "../src/core/env/schema.ts";
import { refuseLinkedHostedProject } from "./lib/local-supabase.mts";

/**
 * Warm EXPLAIN (ANALYZE, BUFFERS) for the documented RLS-sensitive paths.
 * Local Docker only. Does not claim production equivalence.
 *
 * SQL is loaded with `supabase db query -f` so Windows cmd.exe does not split
 * `EXPLAIN (ANALYZE, BUFFERS)` into extra positional arguments.
 */
const OPERATION = "db:perf";

parseServerEnv(process.env);
refuseLinkedHostedProject(OPERATION);

const queries: {
  name: string;
  file: string;
  expectIndex?: string;
}[] = [
  {
    name: "1. Public venue resolution + translation lookup",
    file: join("supabase", "perf", "explain", "01_public_lookup.sql"),
    expectIndex: "venues_public_lookup_idx",
  },
  {
    name: "2. Business membership resolution",
    file: join("supabase", "perf", "explain", "02_business_membership.sql"),
    expectIndex: "business_memberships_user_business_idx",
  },
  {
    name: "3. Venue membership resolution",
    file: join("supabase", "perf", "explain", "03_venue_membership.sql"),
    expectIndex: "venue_memberships_user_venue_idx",
  },
  {
    name: "4. Entitlement resolution",
    file: join("supabase", "perf", "explain", "04_entitlements.sql"),
    expectIndex: "venue_module_entitlements_lookup_idx",
  },
  {
    name: "5. Venue-admin listing (perf tenant, 10 of many venues)",
    file: join("supabase", "perf", "explain", "05_admin_list.sql"),
    expectIndex: "venues_business_id_idx",
  },
];

function explain(file: string): string {
  const result = spawnSync("npx", ["supabase", "db", "query", "-f", file], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error !== undefined || result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    console.error(`[${OPERATION}] EXPLAIN failed.`);
    process.exit(result.status ?? 1);
  }

  return `${result.stdout}\n${result.stderr}`;
}

console.log(
  `[${OPERATION}] local Docker EXPLAIN (ANALYZE, BUFFERS). Warm cache. Not production.`,
);

let missingIndexName = false;

for (const query of queries) {
  process.stderr.write(`\n=== ${query.name} ===\n`);
  const output = explain(query.file);
  process.stdout.write(output);

  if (query.expectIndex !== undefined && !output.includes(query.expectIndex)) {
    console.warn(
      `[${OPERATION}] note: expected index "${query.expectIndex}" did not appear in the plan text (planner may still be correct).`,
    );
    missingIndexName = true;
  }
}

if (missingIndexName) {
  console.warn(
    `[${OPERATION}] one or more expected index names were missing from plan text. Record the actual plan in docs/performance/foundation-rls-baseline.md; this command still exits 0 so a seq scan can be documented honestly.`,
  );
}

process.exit(0);
