import { resolve } from "node:path";
import { JobQueue } from "./queue.ts";
import { TierRateLimiter } from "./rate_limit.ts";
import { WsPublisher } from "./ws.ts";
import { HealthServer } from "./http/health.ts";
import { SubstrateRegistry } from "./substrates/loader.ts";
import { GitSubstrate } from "./substrates/git.ts";
import { HttpMcpClient, type McpClient } from "./mcp_client.ts";
import { runLoopOnce } from "./runners/loop.ts";
import { gracefulShutdown } from "./shutdown.ts";
import type { DaemonConfig, DaemonEvent, DaemonHealth, JobRecord, JobKind } from "./types.ts";
import type { SiteConfig } from "@llm-seo-lab/shared";

export interface DaemonHandles {
  start(): Promise<void>;
  stop(): Promise<{ drained: boolean; waited_ms: number }>;
  health(): DaemonHealth;
  enqueue(input: { site_id: string; kind: JobKind; payload?: Record<string, unknown> }): JobRecord;
  ports(): { ws: number; http: number };
}

export interface DaemonDeps {
  config: DaemonConfig;
  mcp?: McpClient;
  now?: () => number;
}

/**
 * The daemon ties together: queue, rate limiter, substrate registry, MCP
 * client, runner, WS publisher, health server, and shutdown handler.
 *
 * `start()` only sets up sockets and the loop; signal handlers are wired by
 * the CLI entry (`cli.ts`) so test code can drive the daemon without claiming
 * SIGTERM globally.
 */
export function createDaemon(deps: DaemonDeps): DaemonHandles {
  const cfg = deps.config;
  const now = deps.now ?? Date.now;
  const startedAt = now();

  const queue = new JobQueue({ journal_path: resolve(cfg.data_dir, "queue.jsonl"), now });
  const limiter = new TierRateLimiter({ now });
  const substrates = new SubstrateRegistry();
  const ws = new WsPublisher();
  const sitesById = new Map<string, SiteConfig>();
  for (const s of cfg.site_configs) sitesById.set(s.site_id, s);

  for (const site of cfg.site_configs) {
    if (site.action_substrate === "git") {
      substrates.register("git", () => new GitSubstrate({ repo_path: site.repo_path }));
    }
  }

  const mcp = deps.mcp ?? new HttpMcpClient();

  let running = 0;
  let completed = 0;
  let failed = 0;
  let draining = false;
  let stopRequested = false;
  let healthPort = 0;
  let wsPort = 0;
  let tickHandle: NodeJS.Timeout | undefined;

  const health = (): DaemonHealth => ({
    status: stopRequested ? "draining" : "ok",
    uptime_ms: now() - startedAt,
    queue_depth: queue.depth(),
    jobs_running: running,
    jobs_completed: completed,
    jobs_failed: failed,
    claude_workers: 0,
    playwright_sessions: 0,
    ws_subscribers: ws.subscriberCount(),
  });

  const httpHealth = new HealthServer({ health });

  async function processOne(job: JobRecord): Promise<void> {
    const site = sitesById.get(job.site_id);
    if (site) {
      const action = jobKindToRateLimitAction(job.kind);
      if (action) {
        const tk = limiter.take({ site_id: site.site_id, tier: site.tier, action });
        if (!tk.ok) {
          queue.update(job.id, {
            status: "queued",
            error: { code: tk.error.code, message: tk.error.message },
          });
          return;
        }
      }
    }

    queue.update(job.id, { status: "running", started_at: now(), attempt: job.attempt + 1 });
    ws.publish({ type: "job.started", job: queue.get(job.id)! });
    running += 1;
    try {
      let result: Record<string, unknown> = {};
      if (job.kind === "loop") {
        const r = await runLoopOnce(job, {
          mcp,
          emitProgress: (step, data) => {
            const ev: DaemonEvent =
              data === undefined
                ? { type: "job.progress", job_id: job.id, site_id: job.site_id, step }
                : { type: "job.progress", job_id: job.id, site_id: job.site_id, step, data };
            ws.publish(ev);
          },
        });
        result = r as unknown as Record<string, unknown>;
      } else {
        result = { kind: job.kind, note: "stub runner; v0.1.0 ships loop only" };
      }
      const finished = queue.update(job.id, { status: "succeeded", finished_at: now(), result })!;
      completed += 1;
      ws.publish({ type: "job.succeeded", job: finished });
    } catch (e) {
      const message = (e as Error).message;
      const finished = queue.update(job.id, { status: "failed", finished_at: now(), error: { code: "INTERNAL", message } })!;
      failed += 1;
      ws.publish({ type: "job.failed", job: finished });
    } finally {
      running -= 1;
    }
  }

  async function tick(): Promise<void> {
    if (draining || stopRequested) return;
    if (running >= cfg.max_concurrent_jobs) return;
    const next = queue.next();
    if (!next) return;
    void processOne(next);
  }

  return {
    async start() {
      wsPort = await ws.listen(cfg.ws_port);
      healthPort = await httpHealth.listen(cfg.http_port);
      tickHandle = setInterval(() => { void tick(); }, 50);
    },
    async stop() {
      stopRequested = true;
      draining = true;
      if (tickHandle) clearInterval(tickHandle);
      const r = await gracefulShutdown({
        queue,
        drainTimeoutMs: cfg.shutdown_grace_ms,
        isIdle: () => running === 0,
        closeFns: [() => ws.close(), () => httpHealth.close()],
      });
      return r;
    },
    enqueue(input) {
      const job = queue.enqueue(input);
      ws.publish({ type: "job.enqueued", job });
      return job;
    },
    health,
    ports: () => ({ ws: wsPort, http: healthPort }),
  };
}

function jobKindToRateLimitAction(kind: JobKind): "audit_page_per_minute" | "oracle_query_per_minute" | "open_pr_per_minute" | undefined {
  switch (kind) {
    case "audit": return "audit_page_per_minute";
    case "track": return "oracle_query_per_minute";
    case "fix": return "open_pr_per_minute";
    case "loop": return "audit_page_per_minute";
    case "compete": return "oracle_query_per_minute";
    default: return undefined;
  }
}
