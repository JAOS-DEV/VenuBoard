export const FEED_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "inactive",
  "unavailable",
] as const;

export type FeedActionCode = (typeof FEED_ERROR_CODES)[number];

export type FeedActionResult<T = void> =
  { ok: true; data?: T } | { ok: false; code: FeedActionCode };

export function normalizeFeedErrorCode(code: unknown): FeedActionCode {
  if (
    typeof code === "string" &&
    (FEED_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return code as FeedActionCode;
  }
  return "unavailable";
}

export function mapFeedRpcResult(payload: unknown): FeedActionResult {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeFeedErrorCode(record.code) };
  }

  return { ok: true };
}

export function mapFeedRpcResultWithId(
  payload: unknown,
): FeedActionResult<{ postId: string }> {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, code: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, code: normalizeFeedErrorCode(record.code) };
  }

  if (typeof record.post_id === "string") {
    return { ok: true, data: { postId: record.post_id } };
  }

  return { ok: true };
}
