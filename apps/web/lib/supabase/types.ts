/**
 * Hand-written shape definitions for the v0.3.0 Supabase schema.
 * Source of truth: infra/supabase/migrations/0001_init.sql
 *
 * We do not run `supabase gen types` in this repo because we want the
 * apps/web and mcp packages to share these types without depending on
 * the Supabase CLI being installed on every developer machine. Update
 * this file when the migration changes.
 */

export type Stage =
  | "DRAFT"
  | "RECOMMENDED"
  | "APPLIED"
  | "REPUBLISHED"
  | "MEASURING"
  | "MEASURED"
  | "ANALYZED"
  | "ABANDONED";

export type Substrate = "web" | "substack" | "youtube";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface UseCaseRow {
  id: string;
  user_id: string;
  url: string;
  substrate: Substrate;
  title: string;
  topic: string;
  target_audience: string | null;
  current_stage: Stage;
  current_iteration: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseCaseEventRow {
  id: string;
  use_case_id: string;
  user_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  iteration: number;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface RecommendationRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  triz_principle: string;
  applicability_score: number;
  knob: string;
  diff_summary: string;
  payload: Record<string, unknown>;
  rationale: string;
  expected_engines: string[];
  claude_run_id: string | null;
  created_at: string;
}

export interface ApplicationRow {
  id: string;
  use_case_id: string;
  recommendation_id: string;
  user_id: string;
  iteration: number;
  artifact_kind: string;
  artifact_summary: string;
  applied_at: string;
}

export interface MeasurementRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  engine: string;
  prompt: string;
  observed_answer: string;
  citation_present: boolean;
  citation_position: number | null;
  source_authority: string | null;
  notes: string | null;
  screenshot_path: string | null;
  observed_at: string;
}

export interface AnalysisRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  verdict: "improved" | "stable" | "regressed" | "inconclusive" | "stub";
  per_engine_delta: Record<string, unknown> | null;
  attractor_metrics: Record<string, unknown> | null;
  triz_principles_cited: string[] | null;
  next_iteration_suggestion: string | null;
  claude_run_id: string | null;
  created_at: string;
}

/**
 * `Database` shape consumed by `@supabase/supabase-js`. We do not enumerate
 * function definitions because v0.3.0 only uses table-level CRUD.
 */
export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: ProfileRow; Update: Partial<ProfileRow> };
      use_cases: { Row: UseCaseRow; Insert: Omit<UseCaseRow, "id" | "created_at" | "updated_at"> & Partial<Pick<UseCaseRow, "id" | "created_at" | "updated_at">>; Update: Partial<UseCaseRow> };
      use_case_events: {
        Row: UseCaseEventRow;
        Insert: Omit<UseCaseEventRow, "id" | "created_at"> & Partial<Pick<UseCaseEventRow, "id" | "created_at">>;
        Update: Partial<UseCaseEventRow>;
      };
      recommendations: {
        Row: RecommendationRow;
        Insert: Omit<RecommendationRow, "id" | "created_at"> & Partial<Pick<RecommendationRow, "id" | "created_at">>;
        Update: Partial<RecommendationRow>;
      };
      applications: {
        Row: ApplicationRow;
        Insert: Omit<ApplicationRow, "id" | "applied_at"> & Partial<Pick<ApplicationRow, "id" | "applied_at">>;
        Update: Partial<ApplicationRow>;
      };
      measurements: {
        Row: MeasurementRow;
        Insert: Omit<MeasurementRow, "id" | "observed_at"> & Partial<Pick<MeasurementRow, "id" | "observed_at">>;
        Update: Partial<MeasurementRow>;
      };
      analyses: {
        Row: AnalysisRow;
        Insert: Omit<AnalysisRow, "id" | "created_at"> & Partial<Pick<AnalysisRow, "id" | "created_at">>;
        Update: Partial<AnalysisRow>;
      };
    };
    Enums: {
      use_case_stage: Stage;
      substrate: Substrate;
    };
  };
}
