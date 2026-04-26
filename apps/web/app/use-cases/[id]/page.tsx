/**
 * /use-cases/[id] — single-use-case stage panel.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 *
 * The page renders five blocks:
 *
 *   1. Header (title, URL, substrate, current stage, current iteration).
 *   2. Stage panel — one button per legal transition from the current
 *      stage. Each button posts to a Next.js server action that hits MCP
 *      and writes a `use_case_events` row.
 *   3. Iteration timeline — last N events with stage chips.
 *   4. Recommendations + applications for the current iteration.
 *   5. Measurements + latest analysis verdict.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isSupabaseMode } from "../../../lib/supabase/env.ts";
import { getCurrentUserAsync } from "../../../lib/auth.ts";
import { getUseCaseBundle } from "../../../lib/actions/use-cases.ts";
import { getAllowedTransitions } from "@llm-seo-lab/shared";
import type { Stage } from "@llm-seo-lab/shared";
import {
  recommendAction,
  applyRecommendationAction,
  markRepublishedAction,
  startMeasuringAction,
  markMeasuredAction,
  analyzeAction,
  abandonAction,
  nextIterationAction,
} from "./actions.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stageBadgeClass(stage: string): string {
  if (stage === "ABANDONED") return "badge bad";
  if (stage === "ANALYZED") return "badge good";
  if (stage === "DRAFT") return "badge";
  return "badge warn";
}

interface StageButton {
  to: Stage;
  label: string;
  action: (formData: FormData) => Promise<void>;
  variant?: "primary" | "danger" | "warn";
}

function buttonsFor(current: Stage): StageButton[] {
  const allowed = new Set(getAllowedTransitions(current));
  const all: StageButton[] = [
    { to: "RECOMMENDED", label: current === "DRAFT" ? "Recommend" : "Next iteration · Recommend", action: current === "ANALYZED" ? nextIterationAction : recommendAction, variant: "primary" },
    { to: "APPLIED", label: "Mark applied", action: applyRecommendationAction, variant: "primary" },
    { to: "REPUBLISHED", label: "Mark republished", action: markRepublishedAction, variant: "primary" },
    { to: "MEASURING", label: "Start measuring", action: startMeasuringAction, variant: "primary" },
    { to: "MEASURED", label: "Mark measured", action: markMeasuredAction, variant: "primary" },
    { to: "ANALYZED", label: "Analyze", action: analyzeAction, variant: "primary" },
    { to: "ABANDONED", label: "Abandon", action: abandonAction, variant: "danger" },
  ];
  return all.filter((b) => allowed.has(b.to));
}

export default async function UseCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const sp = await searchParams;

  if (isSupabaseMode()) {
    const u = await getCurrentUserAsync();
    if (!u) redirect("/login");
  }

  let bundle;
  try {
    bundle = await getUseCaseBundle(id);
  } catch (e) {
    const msg = (e as Error).message;
    if (/not.?found/i.test(msg) || /no rows/i.test(msg)) notFound();
    return (
      <>
        <h2 className="h1">Use case</h2>
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not load:</strong> {msg}
        </div>
        <p>
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
      </>
    );
  }

  const uc = bundle.use_case;
  const events = bundle.events ?? [];
  const recs = (bundle.recommendations ?? []).filter((r) => r.iteration === uc.current_iteration);
  const apps = (bundle.applications ?? []).filter((a) => a.iteration === uc.current_iteration);
  const meas = (bundle.measurements ?? []).filter((m) => m.iteration === uc.current_iteration);
  const analyses = (bundle.analyses ?? []).filter((a) => a.iteration === uc.current_iteration);
  const buttons = buttonsFor(uc.current_stage);

  return (
    <>
      <p className="subtle">
        <Link href="/dashboard">← Dashboard</Link>
      </p>

      <h2 className="h1">{uc.title}</h2>
      <p className="subtle">
        <a href={uc.url} target="_blank" rel="noreferrer">{uc.url}</a>
      </p>

      <div className="panel">
        <dl className="kv">
          <dt>Substrate</dt>
          <dd><span className="badge">{uc.substrate}</span></dd>
          <dt>Current stage</dt>
          <dd><span className={stageBadgeClass(uc.current_stage)}>{uc.current_stage}</span></dd>
          <dt>Iteration</dt>
          <dd>{uc.current_iteration}</dd>
          <dt>Topic</dt>
          <dd>{uc.topic}</dd>
          {uc.target_audience && (<>
            <dt>Audience</dt><dd>{uc.target_audience}</dd>
          </>)}
          <dt>Created</dt>
          <dd className="subtle">{new Date(uc.created_at).toLocaleString()}</dd>
        </dl>
      </div>

      {sp.ok && (
        <div className="panel" style={{ borderColor: "var(--good)" }}>
          <strong>OK:</strong> {sp.ok}
        </div>
      )}
      {sp.error && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Action failed:</strong> {sp.error}
        </div>
      )}

      <div className="panel">
        <h3 className="h1" style={{ fontSize: 16 }}>Next action</h3>
        {buttons.length === 0 ? (
          <p className="subtle">
            No transitions available from <code>{uc.current_stage}</code>.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {buttons.map((b) => (
              <form key={b.to} action={b.action}>
                <input type="hidden" name="use_case_id" value={uc.id} />
                <input type="hidden" name="from_stage" value={uc.current_stage} />
                <input type="hidden" name="iteration" value={String(uc.current_iteration)} />
                <button
                  type="submit"
                  className={`btn ${b.variant === "danger" ? "danger" : b.variant === "warn" ? "warn" : "primary"}`}
                >
                  {b.label}
                </button>
              </form>
            ))}
            {(uc.current_stage === "MEASURING" || uc.current_stage === "REPUBLISHED" || uc.current_stage === "MEASURED") && (
              <Link
                href={`/use-cases/${encodeURIComponent(uc.id)}/measurements/new`}
                className="btn"
              >
                + Add measurement
              </Link>
            )}
          </div>
        )}
        {uc.current_stage === "RECOMMENDED" && recs.length > 0 && (
          <p className="subtle" style={{ marginTop: 12 }}>
            "Mark applied" requires choosing a recommendation below.
          </p>
        )}
      </div>

      {recs.length > 0 && (
        <div className="panel">
          <h3 className="h1" style={{ fontSize: 16 }}>
            Recommendations · iteration {uc.current_iteration}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Principle</th>
                <th>Knob</th>
                <th>Diff summary</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={r.id}>
                  <td><span className="badge tier1">{r.triz_principle}</span></td>
                  <td><code>{r.knob}</code></td>
                  <td>{r.diff_summary.slice(0, 140)}{r.diff_summary.length > 140 ? "…" : ""}</td>
                  <td>{r.applicability_score.toFixed(2)}</td>
                  <td>
                    {uc.current_stage === "RECOMMENDED" && (
                      <form action={applyRecommendationAction}>
                        <input type="hidden" name="use_case_id" value={uc.id} />
                        <input type="hidden" name="from_stage" value={uc.current_stage} />
                        <input type="hidden" name="iteration" value={String(uc.current_iteration)} />
                        <input type="hidden" name="recommendation_id" value={r.id} />
                        <button type="submit" className="btn primary">Apply this</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apps.length > 0 && (
        <div className="panel">
          <h3 className="h1" style={{ fontSize: 16 }}>Applied artifacts</h3>
          <ul>
            {apps.map((a) => (
              <li key={a.id}>
                <code>{a.artifact_kind}</code> ·{" "}
                <span className="subtle">{new Date(a.applied_at).toLocaleString()}</span>
                <div className="subtle" style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 4 }}>
                  {a.artifact_summary.slice(0, 600)}
                  {a.artifact_summary.length > 600 ? "…" : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meas.length > 0 && (
        <div className="panel">
          <h3 className="h1" style={{ fontSize: 16 }}>
            Measurements · iteration {uc.current_iteration}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Engine</th>
                <th>Cited?</th>
                <th>Position</th>
                <th>Authority</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {meas.map((m) => (
                <tr key={m.id}>
                  <td>{m.engine}</td>
                  <td>
                    <span className={m.citation_present ? "badge good" : "badge"}>
                      {m.citation_present ? "yes" : "no"}
                    </span>
                  </td>
                  <td>{m.citation_position ?? "—"}</td>
                  <td>{m.source_authority ?? "—"}</td>
                  <td className="subtle">
                    {new Date(m.observed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analyses.length > 0 && (
        <div className="panel">
          <h3 className="h1" style={{ fontSize: 16 }}>
            Analysis · iteration {uc.current_iteration}
          </h3>
          {analyses.map((a) => (
            <div key={a.id}>
              <p>
                <strong>Verdict:</strong>{" "}
                <span className={a.verdict === "improved" ? "badge good" : a.verdict === "regressed" ? "badge bad" : "badge warn"}>
                  {a.verdict}
                </span>
              </p>
              {a.next_iteration_suggestion && (
                <p>
                  <strong>Next:</strong> {a.next_iteration_suggestion}
                </p>
              )}
              {a.triz_principles_cited && a.triz_principles_cited.length > 0 && (
                <p className="subtle">
                  TRIZ: {a.triz_principles_cited.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3 className="h1" style={{ fontSize: 16 }}>Stage history</h3>
        {events.length === 0 ? (
          <p className="subtle">No transitions yet.</p>
        ) : (
          <ul className="timeline">
            {events.slice(0, 30).map((e) => (
              <li key={e.id}>
                <span className={stageBadgeClass(e.to_stage)}>
                  {e.from_stage ? `${e.from_stage} → ${e.to_stage}` : e.to_stage}
                </span>{" "}
                <span className="subtle">
                  · iter {e.iteration} · {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
