/**
 * Conservative `.env` parsing for local CLI scripts.
 *
 * Does not interpolate, expand commands, or print values. Existing process
 * environment keys always win so safety tests can override `.env.local`.
 */

export const LOCAL_ENV_FILE_NAME = ".env.local";

export const MISSING_LOCAL_ENV_FILE_MESSAGE =
  "missing .env.local. Copy .env.example to .env.local and configure local values.";

const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

export function parseDotEnvContents(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  const text = contents.startsWith("\uFEFF") ? contents.slice(1) : contents;

  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const match = ASSIGNMENT.exec(line);
    if (match === null || match[1] === undefined || match[2] === undefined) {
      continue;
    }

    values[match[1]] = unquoteEnvValue(match[2]);
  }

  return values;
}

function unquoteEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.search(/\s+#/);
  if (commentIndex === -1) {
    return trimmed;
  }
  return trimmed.slice(0, commentIndex).trim();
}

/**
 * Copies file values into `target` only when the key is currently unset.
 * Empty strings already present in `target` are treated as overrides.
 */
export function mergeUnsetEnvValues(
  target: Record<string, string | undefined>,
  fileValues: Record<string, string>,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...target };
  for (const [key, value] of Object.entries(fileValues)) {
    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

export function applyParsedEnvFile(
  input: {
    exists: boolean;
    contents?: string;
    required: boolean;
  },
  current: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (!input.exists) {
    if (input.required) {
      throw new Error(MISSING_LOCAL_ENV_FILE_MESSAGE);
    }
    return { ...current };
  }

  return mergeUnsetEnvValues(
    current,
    parseDotEnvContents(input.contents ?? ""),
  );
}
