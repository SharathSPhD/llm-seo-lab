export type ErrorCode =
  | "QUOTA_EXCEEDED"
  | "CLAUDE_CLI_FAILED"
  | "PLAYWRIGHT_AUTH_EXPIRED"
  | "GH_CLI_FAILED"
  | "INVALID_INPUT"
  | "FILESYSTEM_ERROR"
  | "NOT_FOUND"
  | "INTERNAL";

export interface AeoError {
  code: ErrorCode;
  message: string;
  retry_after_seconds?: number;
  actionable_next_step: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AeoError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (e: AeoError): Result<never> => ({ ok: false, error: e });
