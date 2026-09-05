const CURSOR_SHAPE = /^[A-Za-z0-9+/]+=*$/;

export function isSafeFeedCursor(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.length === 0) {
    return true;
  }
  if (value.length > 512 || !CURSOR_SHAPE.test(value.replace(/\s/g, ""))) {
    return false;
  }
  try {
    const decoded = Buffer.from(value.replace(/\s/g, ""), "base64").toString(
      "utf8",
    );
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return false;
    }
    const record = parsed as Record<string, unknown>;
    return (
      (record.p === 0 ||
        record.p === 1 ||
        record.p === "0" ||
        record.p === "1") &&
      typeof record.t === "string" &&
      record.t.length > 0 &&
      typeof record.i === "string" &&
      record.i.length > 0
    );
  } catch {
    return false;
  }
}

export function encodeFeedCursor(input: {
  pinned: boolean;
  sortAt: string;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      p: input.pinned ? 1 : 0,
      t: input.sortAt,
      i: input.id,
    }),
    "utf8",
  ).toString("base64");
}
