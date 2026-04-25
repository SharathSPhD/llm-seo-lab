import type { SiteConfig } from "@llm-seo-lab/shared";

export type JobKind = "audit" | "fix" | "track" | "loop" | "compete";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobRecord {
  id: string;
  site_id: string;
  kind: JobKind;
  status: JobStatus;
  enqueued_at: number;
  started_at?: number;
  finished_at?: number;
  attempt: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface DaemonConfig {
  data_dir: string;
  ws_port: number;
  http_port: number;
  max_concurrent_jobs: number;
  shutdown_grace_ms: number;
  site_configs: SiteConfig[];
}

export interface DaemonHealth {
  status: "ok" | "draining" | "starting";
  uptime_ms: number;
  queue_depth: number;
  jobs_running: number;
  jobs_completed: number;
  jobs_failed: number;
  claude_workers: number;
  playwright_sessions: number;
  ws_subscribers: number;
}

export type DaemonEvent =
  | { type: "job.enqueued"; job: JobRecord }
  | { type: "job.started"; job: JobRecord }
  | { type: "job.progress"; job_id: string; site_id: string; step: string; data?: Record<string, unknown> }
  | { type: "job.succeeded"; job: JobRecord }
  | { type: "job.failed"; job: JobRecord }
  | { type: "daemon.health"; health: DaemonHealth };
