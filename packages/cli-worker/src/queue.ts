import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import type { JobKind, JobRecord, JobStatus } from "./types.ts";

export interface QueueOpts {
  journal_path: string;
  now?: () => number;
  id?: () => string;
}

/**
 * Append-only JSONL job journal with an in-memory index.
 *
 * Persistence model: every state transition is appended as a single JSON line.
 * On startup, we replay the file to rebuild the in-memory map (last write wins
 * per id). The compact() helper rewrites the file from the index when it grows.
 *
 * This is deliberately a single-file local store. The daemon owns it; the
 * dashboard reads results out of `.llm-seo-lab/results/` and `audits/` instead
 * of touching the journal.
 */
export class JobQueue {
  private readonly journal: string;
  private readonly nowFn: () => number;
  private readonly idFn: () => string;
  private readonly index = new Map<string, JobRecord>();

  constructor(opts: QueueOpts) {
    this.journal = opts.journal_path;
    this.nowFn = opts.now ?? Date.now;
    this.idFn = opts.id ?? defaultIdGen();
    mkdirSync(dirname(this.journal), { recursive: true });
    this.replay();
  }

  enqueue(input: { site_id: string; kind: JobKind; payload?: Record<string, unknown> }): JobRecord {
    const job: JobRecord = {
      id: this.idFn(),
      site_id: input.site_id,
      kind: input.kind,
      status: "queued",
      enqueued_at: this.nowFn(),
      attempt: 0,
      payload: input.payload ?? {},
    };
    this.persist(job);
    return job;
  }

  next(): JobRecord | undefined {
    for (const job of this.index.values()) {
      if (job.status === "queued") return job;
    }
    return undefined;
  }

  update(id: string, patch: Partial<JobRecord> & { status?: JobStatus }): JobRecord | undefined {
    const cur = this.index.get(id);
    if (!cur) return undefined;
    const next: JobRecord = { ...cur, ...patch };
    this.persist(next);
    return next;
  }

  get(id: string): JobRecord | undefined {
    return this.index.get(id);
  }

  list(filter?: { status?: JobStatus; site_id?: string }): JobRecord[] {
    return [...this.index.values()].filter((j) => {
      if (filter?.status && j.status !== filter.status) return false;
      if (filter?.site_id && j.site_id !== filter.site_id) return false;
      return true;
    });
  }

  depth(): number {
    return this.list({ status: "queued" }).length + this.list({ status: "running" }).length;
  }

  /**
   * Rewrite the journal file to compact terminal jobs older than the cutoff.
   * Active jobs (queued/running) and recent terminal jobs are preserved.
   */
  compact(opts: { keep_terminal_after?: number } = {}): number {
    const cutoff = opts.keep_terminal_after ?? this.nowFn() - 7 * 24 * 60 * 60 * 1000;
    const before = this.index.size;
    for (const [id, job] of this.index) {
      const isTerminal = job.status === "succeeded" || job.status === "failed" || job.status === "cancelled";
      if (isTerminal && (job.finished_at ?? 0) < cutoff) {
        this.index.delete(id);
      }
    }
    const tmp = `${this.journal}.compact`;
    const lines = [...this.index.values()].map((j) => JSON.stringify(j));
    writeFileSync(tmp, lines.length === 0 ? "" : lines.join("\n") + "\n");
    renameSync(tmp, this.journal);
    return before - this.index.size;
  }

  private replay(): void {
    if (!existsSync(this.journal)) return;
    const raw = readFileSync(this.journal, "utf8");
    if (raw.length === 0) return;
    for (const line of raw.split("\n")) {
      if (line.length === 0) continue;
      try {
        const j = JSON.parse(line) as JobRecord;
        this.index.set(j.id, j);
      } catch {
        // Skip malformed lines to preserve forward progress; they remain in
        // the file for forensic inspection until next compact().
      }
    }
  }

  private persist(job: JobRecord): void {
    this.index.set(job.id, job);
    appendFileSync(this.journal, JSON.stringify(job) + "\n");
  }
}

function defaultIdGen(): () => string {
  let seq = 0;
  return () => {
    seq += 1;
    return `j_${Date.now().toString(36)}_${seq.toString(36)}`;
  };
}
