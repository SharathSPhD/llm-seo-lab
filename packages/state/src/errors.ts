/**
 * @llm-seo-lab/state — typed errors.
 *
 * The driver throws these specific error classes so callers (MCP tools,
 * Next.js server actions) can pattern-match without parsing strings.
 */

export class UseCaseOwnershipError extends Error {
  override readonly name = "UseCaseOwnershipError";
  constructor(message: string) {
    super(message);
  }
}

export class UseCaseNotFoundError extends Error {
  override readonly name = "UseCaseNotFoundError";
  constructor(message: string) {
    super(message);
  }
}

export class IllegalTransitionError extends Error {
  override readonly name = "IllegalTransitionError";
  constructor(message: string) {
    super(message);
  }
}

export class StateDriverError extends Error {
  override readonly name = "StateDriverError";
  constructor(message: string) {
    super(message);
  }
}
