import { createHash } from "node:crypto";

export interface FingerprintFile {
  readonly relativePath: string;
  readonly contents: string;
}

export function fingerprintSources(files: readonly FingerprintFile[]): string {
  const hash = createHash("sha256");
  const sorted = [...files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  for (const file of sorted) {
    hash.update(file.relativePath.replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(file.contents.replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function copiedSqlFilesMatch(
  source: readonly FingerprintFile[],
  copied: readonly FingerprintFile[],
): string[] {
  const sourceMap = new Map(
    source.map((file) => [
      file.relativePath.replace(/\\/g, "/"),
      normalize(file.contents),
    ]),
  );
  const copiedMap = new Map(
    copied.map((file) => [
      file.relativePath.replace(/\\/g, "/"),
      normalize(file.contents),
    ]),
  );
  const issues: string[] = [];

  for (const [relativePath, contents] of sourceMap) {
    const other = copiedMap.get(relativePath);
    if (other === undefined) {
      issues.push(`missing copied ${relativePath}`);
    } else if (other !== contents) {
      issues.push(
        `copied ${relativePath} does not match the repository source`,
      );
    }
  }

  for (const relativePath of copiedMap.keys()) {
    if (!sourceMap.has(relativePath)) {
      issues.push(`unexpected copied ${relativePath}`);
    }
  }

  return issues;
}

function normalize(contents: string): string {
  return contents.replace(/\r\n/g, "\n");
}
