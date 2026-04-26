/**
 * @llm-seo-lab/state — public API.
 *
 * One driver interface, two implementations:
 *
 *   - {@link JsonlSqliteDriver}  local-first (better-sqlite3 + JSONL mirror)
 *   - {@link D1HttpDriver}       Cloudflare D1 binding (Pages Functions)
 *
 * MCP tools and the Next.js server-action layer construct the right
 * driver at process boot and inject it into call sites.
 */

export type { StateDriver } from "./driver.ts";
export type {
  AnalysisRow,
  ApplicationRow,
  CreateUseCaseInput,
  EnqueuePendingActionInput,
  MeasurementRow,
  PendingActionRow,
  RecommendationRow,
  Stage,
  Substrate,
  UpdateUseCaseStageInput,
  UseCaseEventRow,
  UseCaseRow,
  UseCaseStateBundle,
} from "./types.ts";
export type { JsonlEvent, JsonlSink } from "./jsonl.ts";
export { encodeEvent, parseEvent, parseJsonl, MemoryJsonlSink } from "./jsonl.ts";
export { FsJsonlSink } from "./sinks/fs-jsonl.ts";
export type { JsonlSqliteDriverOptions, SqliteLike, SqliteStmt } from "./drivers/jsonl-sqlite.ts";
export { JsonlSqliteDriver } from "./drivers/jsonl-sqlite.ts";
export type { D1HttpDriverOptions, D1Like, D1PreparedLike } from "./drivers/d1-http.ts";
export { D1HttpDriver } from "./drivers/d1-http.ts";
export {
  IllegalTransitionError,
  StateDriverError,
  UseCaseNotFoundError,
  UseCaseOwnershipError,
} from "./errors.ts";
export { SQL } from "./sql/sqlite-sql.ts";
export {
  rowToAnalysis,
  rowToApplication,
  rowToMeasurement,
  rowToPendingAction,
  rowToRecommendation,
  rowToUseCase,
  rowToUseCaseEvent,
} from "./sql/row-mapper.ts";
export { openLocalSqlite } from "./sqlite/bootstrap.ts";
export type { InitSqliteOptions } from "./sqlite/bootstrap.ts";
