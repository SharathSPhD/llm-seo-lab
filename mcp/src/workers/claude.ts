import { ok, err } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";
import { errInternal, errQuota } from "../errors.ts";
import type { ClaudeWorker } from "../types.ts";
import { spawn } from "node:child_process";

export interface ClaudePoolOpts {
  maxConcurrent: number;
  command?: string;
  args?: string[];
  spawner?: typeof spawn;
}

interface QueueItem {
  prompt: string;
  timeoutMs: number;
  resolve: (r: Result<string>) => void;
}

export class ClaudeCliPool implements ClaudeWorker {
  private inflight = 0;
  private queue: QueueItem[] = [];
  private readonly maxConcurrent: number;
  private readonly command: string;
  private readonly args: string[];
  private readonly spawner: typeof spawn;

  constructor(opts: ClaudePoolOpts) {
    this.maxConcurrent = opts.maxConcurrent;
    this.command = opts.command ?? "claude";
    this.args = opts.args ?? ["--print"];
    this.spawner = opts.spawner ?? spawn;
  }

  invoke(prompt: string, opts?: { timeoutMs?: number }): Promise<Result<string>> {
    return new Promise((resolve) => {
      const item: QueueItem = { prompt, timeoutMs: opts?.timeoutMs ?? 120_000, resolve };
      this.queue.push(item);
      this.drain();
    });
  }

  private drain(): void {
    while (this.inflight < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.inflight++;
      this.run(item);
    }
  }

  private run(item: QueueItem): void {
    let proc;
    try {
      proc = this.spawner(this.command, this.args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      this.inflight--;
      item.resolve(err(errInternal(`failed to spawn ${this.command}: ${(e as Error).message}`,
        "Verify Claude CLI is installed and on PATH")));
      this.drain();
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, item.timeoutMs);
    proc.stdout!.on("data", (d) => { stdout += String(d); });
    proc.stderr!.on("data", (d) => { stderr += String(d); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      this.inflight--;
      if (code === 0) {
        item.resolve(ok(stdout));
      } else {
        const isQuota = /quota|rate.?limit|429/i.test(stderr);
        item.resolve(isQuota
          ? err(errQuota(60))
          : err(errInternal(`Claude CLI exited ${code}: ${stderr.slice(0, 500)}`,
              "Re-authenticate Claude CLI: `claude login`")));
      }
      this.drain();
    });
    proc.stdin!.end(item.prompt);
  }

  stats(): { inflight: number; queue_depth: number } {
    return { inflight: this.inflight, queue_depth: this.queue.length };
  }
}
