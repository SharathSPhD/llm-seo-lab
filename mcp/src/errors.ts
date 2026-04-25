import type { AeoError, ErrorCode } from "@llm-seo-lab/shared";

export function makeError(
  code: ErrorCode,
  message: string,
  actionable: string,
  retryAfterSeconds?: number,
): AeoError {
  const err: AeoError = { code, message, actionable_next_step: actionable };
  if (retryAfterSeconds !== undefined) err.retry_after_seconds = retryAfterSeconds;
  return err;
}

export const errInvalidInput = (msg: string, fix: string) => makeError("INVALID_INPUT", msg, fix);
export const errNotFound = (msg: string, fix: string) => makeError("NOT_FOUND", msg, fix);
export const errInternal = (msg: string, fix: string) => makeError("INTERNAL", msg, fix);
export const errQuota = (retryAfter: number) =>
  makeError(
    "QUOTA_EXCEEDED",
    "Claude CLI subscription quota exhausted",
    "Reduce concurrency or wait for the rate-limit window to reset",
    retryAfter,
  );
