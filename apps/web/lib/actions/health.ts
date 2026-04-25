/**
 * Polls the cli-worker daemon's HTTP /health endpoint. We do this server-side
 * so the dashboard can render a green/red badge without relying on client-side
 * CORS configuration on the daemon.
 */

export interface DaemonHealthDto {
  status: "ok" | "draining" | "starting" | "down";
  uptime_ms?: number;
  queue_depth?: number;
  jobs_running?: number;
  jobs_completed?: number;
  jobs_failed?: number;
  claude_workers?: number;
  playwright_sessions?: number;
  ws_subscribers?: number;
  fetched_at: string;
  error?: string;
}

export interface HealthDeps {
  url?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_HEALTH_URL =
  process.env["LLM_SEO_LAB_HEALTH_URL"] ?? "http://localhost:7373/health";

export async function getDaemonHealth(deps: HealthDeps = {}): Promise<DaemonHealthDto> {
  const url = deps.url ?? DEFAULT_HEALTH_URL;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 1500);
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      return { status: "down", fetched_at: fetchedAt, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as Omit<DaemonHealthDto, "fetched_at">;
    return { ...body, fetched_at: fetchedAt };
  } catch (e) {
    return { status: "down", fetched_at: fetchedAt, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}
