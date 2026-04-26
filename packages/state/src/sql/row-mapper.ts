/**
 * Bidirectional mappers between SQLite row shapes and our typed row
 * objects. SQLite stores text/integer/real only, so:
 *
 *   - JSON-typed columns (payload, expected_engines, per_engine_delta,
 *     attractor_metrics, triz_principles_cited, result) are stored as
 *     `text` and JSON.{stringify,parse}d at the boundary.
 *   - boolean (citation_present) is stored as `integer` 0/1.
 */

import type {
  AnalysisRow,
  ApplicationRow,
  MeasurementRow,
  PendingActionRow,
  RecommendationRow,
  Stage,
  UseCaseEventRow,
  UseCaseRow,
} from "../types.ts";

type Raw = Record<string, unknown>;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return 0;
}

function asNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  return asNumber(v);
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "string") return v === "1" || v === "true";
  return false;
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function parseNullableJson<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function rowToUseCase(r: Raw): UseCaseRow {
  return {
    id: asString(r["id"]),
    user_id: asString(r["user_id"]),
    url: asString(r["url"]),
    substrate: asString(r["substrate"]) as UseCaseRow["substrate"],
    title: asString(r["title"]),
    topic: asString(r["topic"]),
    target_audience: asNullableString(r["target_audience"]),
    current_stage: asString(r["current_stage"]) as Stage,
    current_iteration: asNumber(r["current_iteration"]),
    notes: asNullableString(r["notes"]),
    created_at: asString(r["created_at"]),
    updated_at: asString(r["updated_at"]),
  };
}

export function rowToUseCaseEvent(r: Raw): UseCaseEventRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    user_id: asString(r["user_id"]),
    from_stage: (r["from_stage"] == null
      ? null
      : asString(r["from_stage"])) as Stage | null,
    to_stage: asString(r["to_stage"]) as Stage,
    iteration: asNumber(r["iteration"]),
    payload: parseNullableJson<Record<string, unknown>>(r["payload"]),
    created_at: asString(r["created_at"]),
  };
}

export function rowToRecommendation(r: Raw): RecommendationRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    user_id: asString(r["user_id"]),
    iteration: asNumber(r["iteration"]),
    triz_principle: asString(r["triz_principle"]),
    applicability_score: asNumber(r["applicability_score"]),
    knob: asString(r["knob"]),
    diff_summary: asString(r["diff_summary"]),
    payload: parseJson<Record<string, unknown>>(r["payload"], {}),
    rationale: asString(r["rationale"]),
    expected_engines: parseJson<string[]>(r["expected_engines"], []),
    claude_run_id: asNullableString(r["claude_run_id"]),
    created_at: asString(r["created_at"]),
  };
}

export function rowToApplication(r: Raw): ApplicationRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    recommendation_id: asString(r["recommendation_id"]),
    user_id: asString(r["user_id"]),
    iteration: asNumber(r["iteration"]),
    artifact_kind: asString(r["artifact_kind"]),
    artifact_summary: asString(r["artifact_summary"]),
    applied_at: asString(r["applied_at"]),
  };
}

export function rowToMeasurement(r: Raw): MeasurementRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    user_id: asString(r["user_id"]),
    iteration: asNumber(r["iteration"]),
    engine: asString(r["engine"]),
    prompt: asString(r["prompt"]),
    observed_answer: asString(r["observed_answer"]),
    citation_present: asBool(r["citation_present"]),
    citation_position: asNullableNumber(r["citation_position"]),
    source_authority: asNullableString(r["source_authority"]),
    notes: asNullableString(r["notes"]),
    screenshot_path: asNullableString(r["screenshot_path"]),
    observed_at: asString(r["observed_at"]),
  };
}

export function rowToAnalysis(r: Raw): AnalysisRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    user_id: asString(r["user_id"]),
    iteration: asNumber(r["iteration"]),
    verdict: asString(r["verdict"]) as AnalysisRow["verdict"],
    per_engine_delta: parseNullableJson<Record<string, unknown>>(r["per_engine_delta"]),
    attractor_metrics: parseNullableJson<Record<string, unknown>>(r["attractor_metrics"]),
    triz_principles_cited: parseNullableJson<string[]>(r["triz_principles_cited"]),
    next_iteration_suggestion: asNullableString(r["next_iteration_suggestion"]),
    claude_run_id: asNullableString(r["claude_run_id"]),
    created_at: asString(r["created_at"]),
  };
}

export function rowToPendingAction(r: Raw): PendingActionRow {
  return {
    id: asString(r["id"]),
    use_case_id: asString(r["use_case_id"]),
    requested_stage: asString(r["requested_stage"]) as Stage,
    requested_by: asString(r["requested_by"]),
    requested_at: asString(r["requested_at"]),
    status: asString(r["status"]) as PendingActionRow["status"],
    executed_at: asNullableString(r["executed_at"]),
    result: parseNullableJson<Record<string, unknown>>(r["result"]),
  };
}
