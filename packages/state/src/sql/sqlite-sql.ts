/**
 * Centralized SQL strings used by both the local JsonlSqliteDriver
 * (better-sqlite3) and the hosted D1HttpDriver (Cloudflare D1 binding).
 * Keeping the SQL in one place means the two drivers can never drift in
 * column lists or ordering.
 *
 * SQLite/D1 semantics only — no Postgres-isms.
 */

export const SQL = {
  // ---------------- use_cases ----------------
  insertUseCase: `
    insert into use_cases (
      id, user_id, url, substrate, title, topic, target_audience,
      current_stage, current_iteration, notes, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectUseCaseById: `select * from use_cases where id = ?`,
  selectUseCasesByUser: `select * from use_cases where user_id = ? order by updated_at desc`,
  updateUseCaseStage: `
    update use_cases
    set current_stage = ?, current_iteration = ?, updated_at = ?
    where id = ?
  `,

  // ---------------- use_case_events ----------------
  insertUseCaseEvent: `
    insert into use_case_events (
      id, use_case_id, user_id, from_stage, to_stage, iteration, payload, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectEventsByUseCase: `
    select * from use_case_events where use_case_id = ? order by created_at asc, id asc
  `,

  // ---------------- recommendations ----------------
  insertRecommendation: `
    insert into recommendations (
      id, use_case_id, user_id, iteration, triz_principle,
      applicability_score, knob, diff_summary, payload, rationale,
      expected_engines, claude_run_id, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectRecommendationsByUseCase: `
    select * from recommendations where use_case_id = ? order by created_at asc, id asc
  `,

  // ---------------- applications ----------------
  insertApplication: `
    insert into applications (
      id, use_case_id, recommendation_id, user_id, iteration,
      artifact_kind, artifact_summary, applied_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectApplicationsByUseCase: `
    select * from applications where use_case_id = ? order by applied_at asc, id asc
  `,

  // ---------------- measurements ----------------
  insertMeasurement: `
    insert into measurements (
      id, use_case_id, user_id, iteration, engine, prompt,
      observed_answer, citation_present, citation_position,
      source_authority, notes, screenshot_path, observed_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectMeasurementsByUseCase: `
    select * from measurements where use_case_id = ? order by observed_at asc, id asc
  `,

  // ---------------- analyses ----------------
  insertAnalysis: `
    insert into analyses (
      id, use_case_id, user_id, iteration, verdict,
      per_engine_delta, attractor_metrics, triz_principles_cited,
      next_iteration_suggestion, claude_run_id, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  selectAnalysesByUseCase: `
    select * from analyses where use_case_id = ? order by created_at asc, id asc
  `,

  // ---------------- pending_actions ----------------
  insertPendingAction: `
    insert into pending_actions (
      id, use_case_id, requested_stage, requested_by, requested_at,
      status, executed_at, result
    ) values (?, ?, ?, ?, ?, 'pending', null, null)
  `,
  selectPendingActionsByUser: `
    select * from pending_actions
    where requested_by = ? and status = 'pending'
    order by requested_at asc
  `,
  selectPendingActionsByUserAndUseCase: `
    select * from pending_actions
    where requested_by = ? and use_case_id = ? and status = 'pending'
    order by requested_at asc
  `,
  selectPendingActionById: `select * from pending_actions where id = ?`,
  updatePendingActionExecuted: `
    update pending_actions
    set status = ?, executed_at = ?, result = ?
    where id = ?
  `,
} as const;
