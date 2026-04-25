import { getDaemonHealth } from "../../lib/actions/health.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HealthPage(): Promise<React.JSX.Element> {
  const h = await getDaemonHealth();
  const ok = h.status === "ok";
  return (
    <>
      <h2 className="h1">Daemon health</h2>
      <p className="subtle">Live HTTP poll of the cli-worker `/health` endpoint.</p>
      <div className="panel">
        <p>
          Status:{" "}
          <span className={ok ? "badge good" : h.status === "draining" ? "badge warn" : "badge bad"}>
            {h.status}
          </span>{" "}
          <span className="subtle">fetched at {h.fetched_at}</span>
        </p>
        {h.error && (
          <p className="subtle" style={{ color: "var(--bad)" }}>
            <code>{h.error}</code>
          </p>
        )}
        <dl className="kv">
          <dt>Uptime</dt>
          <dd>{h.uptime_ms !== undefined ? Math.round(h.uptime_ms / 1000) + "s" : "—"}</dd>
          <dt>Queue depth</dt>
          <dd>{h.queue_depth ?? "—"}</dd>
          <dt>Jobs running / completed / failed</dt>
          <dd>
            {h.jobs_running ?? "—"} / {h.jobs_completed ?? "—"} / {h.jobs_failed ?? "—"}
          </dd>
          <dt>Claude workers</dt>
          <dd>{h.claude_workers ?? "—"}</dd>
          <dt>Playwright sessions</dt>
          <dd>{h.playwright_sessions ?? "—"}</dd>
          <dt>WS subscribers</dt>
          <dd>{h.ws_subscribers ?? "—"}</dd>
        </dl>
      </div>
    </>
  );
}
