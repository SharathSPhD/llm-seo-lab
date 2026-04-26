/**
 * @llm-seo-lab/state — JSONL event mirror.
 *
 * The canonical state for the lab is `data/use-cases/<id>/state.jsonl`,
 * a sequence of typed events. v0.4.0 makes JSONL re-derivable from
 * SQLite (and vice versa) so anyone can clone the repo and rebuild a
 * working DB from JSONL alone, with no Supabase dependency.
 *
 * Spec: docs/v0.4.0/spec.md §5.1.
 *
 * The 6 event types are:
 *
 *   - USE_CASE_CREATED       — emits the full UseCaseRow on `createUseCase`
 *   - RECOMMENDATION_CREATED — emits a RecommendationRow per row inserted
 *   - APPLICATION_CREATED    — emits an ApplicationRow on insertApplication
 *   - MEASUREMENT_CREATED    — emits a MeasurementRow on insertMeasurement
 *   - ANALYSIS_CREATED       — emits an AnalysisRow on insertAnalysis
 *   - STAGE_TRANSITION       — emits a UseCaseEventRow on updateUseCaseStage
 */

import type {
  AnalysisRow,
  ApplicationRow,
  MeasurementRow,
  RecommendationRow,
  UseCaseEventRow,
  UseCaseRow,
} from "./types.ts";

export type JsonlEvent =
  | { type: "USE_CASE_CREATED"; use_case: UseCaseRow }
  | { type: "RECOMMENDATION_CREATED"; recommendation: RecommendationRow }
  | { type: "APPLICATION_CREATED"; application: ApplicationRow }
  | { type: "MEASUREMENT_CREATED"; measurement: MeasurementRow }
  | { type: "ANALYSIS_CREATED"; analysis: AnalysisRow }
  | { type: "STAGE_TRANSITION"; event: UseCaseEventRow };

export function encodeEvent(e: JsonlEvent): string {
  return JSON.stringify(e);
}

export function parseEvent(line: string): JsonlEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonlEvent;
  } catch {
    return null;
  }
}

export function parseJsonl(text: string): JsonlEvent[] {
  return text
    .split("\n")
    .map(parseEvent)
    .filter((e): e is JsonlEvent => e !== null);
}

/**
 * Sink for JSONL writes. The default `FsJsonlSink` writes to
 * `data/use-cases/<id>/state.jsonl`; tests can pass an in-memory sink.
 */
export interface JsonlSink {
  append(use_case_id: string, event: JsonlEvent): Promise<void> | void;
}

export class MemoryJsonlSink implements JsonlSink {
  readonly events = new Map<string, JsonlEvent[]>();
  append(use_case_id: string, event: JsonlEvent): void {
    const arr = this.events.get(use_case_id) ?? [];
    arr.push(event);
    this.events.set(use_case_id, arr);
  }
  read(use_case_id: string): JsonlEvent[] {
    return [...(this.events.get(use_case_id) ?? [])];
  }
}
