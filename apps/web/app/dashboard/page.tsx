/**
 * /dashboard — list of the signed-in user's use cases.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 *
 *   - Server component, RLS-bound to the current user's session.
 *   - Lists every UseCase with current_stage chip, current iteration,
 *     last-event timestamp, and an "Add use case" CTA.
 *   - Falls back to an explanatory empty-state when the user has never
 *     created a use case.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseMode } from "../../lib/supabase/env.ts";
import { getCurrentUserAsync } from "../../lib/auth.ts";
import { listUseCases } from "../../lib/actions/use-cases.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stageBadgeClass(stage: string): string {
  if (stage === "ABANDONED") return "badge bad";
  if (stage === "ANALYZED") return "badge good";
  if (stage === "DRAFT") return "badge";
  return "badge warn";
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const supabaseMode = isSupabaseMode();
  if (supabaseMode) {
    const user = await getCurrentUserAsync();
    if (!user) redirect("/login");
  }

  let rows: Awaited<ReturnType<typeof listUseCases>>["use_cases"] = [];
  let error: string | undefined;
  try {
    const r = await listUseCases();
    rows = r.use_cases;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h2 className="h1">Dashboard</h2>
          <p className="subtle">
            Citation-pull use cases. Each row tracks a single page across
            iterations.
          </p>
        </div>
        <Link href="/use-cases/new" className="btn primary">
          + Add use case
        </Link>
      </div>

      {!supabaseMode && (
        <div className="panel" style={{ borderColor: "var(--warn)" }}>
          <strong>Local mode.</strong> Auth is off; you&apos;re signed in as{" "}
          <code>local-dev</code>. Set <code>LLM_SEO_LAB_AUTH_ENABLED=1</code>{" "}
          + Supabase env vars to enable multi-user mode.
        </div>
      )}

      {error ? (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not load use cases:</strong> {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="panel">
          <p>
            <strong>No use cases yet.</strong> Click <em>Add use case</em>{" "}
            above to create one for a web page, Substack post, or YouTube
            video.
          </p>
          <p className="subtle">
            Once created, the v0.3.0 state machine takes you through{" "}
            <code>RECOMMENDED → APPLIED → REPUBLISHED → MEASURING → MEASURED → ANALYZED</code>{" "}
            with a button per transition.
          </p>
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>URL</th>
                <th>Substrate</th>
                <th>Stage</th>
                <th>Iter.</th>
                <th>Last event</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((uc) => (
                <tr key={uc.id}>
                  <td>
                    <Link href={`/use-cases/${encodeURIComponent(uc.id)}`}>{uc.title}</Link>
                  </td>
                  <td>
                    <a href={uc.url} target="_blank" rel="noreferrer">
                      {uc.url.length > 48 ? uc.url.slice(0, 45) + "…" : uc.url}
                    </a>
                  </td>
                  <td>
                    <span className="badge">{uc.substrate}</span>
                  </td>
                  <td>
                    <span className={stageBadgeClass(uc.current_stage)}>
                      {uc.current_stage}
                    </span>
                  </td>
                  <td>{uc.current_iteration}</td>
                  <td className="subtle">
                    {uc.last_event_at
                      ? new Date(uc.last_event_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
