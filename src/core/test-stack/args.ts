/**
 * Extra arguments after `npm run test:e2e --` / `npm run test:db --`.
 * Drops the Node script path and a lone `--` so Playwright/pgTAP paths
 * forward correctly on Windows.
 */
export function forwardedCliArgs(argv: readonly string[]): string[] {
  const rest = argv.slice(2);
  if (rest[0] === "--") {
    return rest.slice(1);
  }
  return [...rest];
}

export function rewriteSqlTestArg(
  arg: string,
  joinFromWorkspace: (...parts: string[]) => string,
): string {
  const normalized = arg.replace(/\\/g, "/");
  if (!normalized.startsWith("supabase/tests/")) {
    return arg;
  }
  return joinFromWorkspace(...normalized.split("/"));
}
