#!/usr/bin/env node
/**
 * Invoked by the Cursor `on-pr-merge` hook (see plugin/hooks/on-pr-merge.json).
 *
 * Translates the merge event into a daemon job: a `track` job that fires after
 * pr_policy.measurement_window_days. We do this by enqueuing a job with
 * payload {pr_id, scheduled_for_ms, repo}; the daemon's runner respects the
 * scheduled_for_ms field and defers execution until then.
 */

import { JobQueue } from "../queue.ts";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

interface ParsedArgs {
  pr_id: string;
  repo: string;
  merged_at: string;
  data_dir?: string;
  measurement_window_days?: number;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i]!;
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        map.set(key, next);
        i += 1;
      } else {
        map.set(key, "true");
      }
    }
  }
  const pr_id = map.get("pr-id");
  const repo = map.get("repo");
  const merged_at = map.get("merged-at");
  if (!pr_id || !repo || !merged_at) {
    throw new Error("schedule-measurement requires --pr-id, --repo, --merged-at");
  }
  const out: ParsedArgs = { pr_id, repo, merged_at };
  const dataDir = map.get("data-dir");
  if (dataDir !== undefined) out.data_dir = dataDir;
  const win = map.get("window");
  if (win !== undefined) out.measurement_window_days = Number(win);
  return out;
}

export function scheduleMeasurement(args: ParsedArgs, opts: { now?: () => number; queue?: JobQueue } = {}): {
  job_id: string;
  scheduled_for_ms: number;
} {
  const dataDir = args.data_dir ?? `${process.env["HOME"] ?? "."}/.llm-seo-lab`;
  mkdirSync(dataDir, { recursive: true });
  const queue = opts.queue ?? new JobQueue({ journal_path: resolve(dataDir, "queue.jsonl") });
  const window_ms = (args.measurement_window_days ?? 14) * 24 * 60 * 60 * 1000;
  void (opts.now ?? Date.now)();
  const merged = Date.parse(args.merged_at);
  if (Number.isNaN(merged)) throw new Error(`invalid merged-at timestamp: ${args.merged_at}`);
  const scheduled_for_ms = merged + window_ms;
  const job = queue.enqueue({
    site_id: args.repo,
    kind: "track",
    payload: {
      pr_id: args.pr_id,
      repo: args.repo,
      merged_at: args.merged_at,
      scheduled_for_ms,
      reason: "post_merge_measurement",
    },
  });
  return { job_id: job.id, scheduled_for_ms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const { job_id, scheduled_for_ms } = scheduleMeasurement(args);
    const iso = new Date(scheduled_for_ms).toISOString();
    process.stdout.write(JSON.stringify({ job_id, scheduled_for: iso }) + "\n");
  } catch (e) {
    process.stderr.write(`schedule-measurement failed: ${(e as Error).message}\n`);
    process.exit(1);
  }
}

void dirname;
