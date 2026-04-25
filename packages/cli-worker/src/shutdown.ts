import type { JobQueue } from "./queue.ts";

export interface ShutdownOpts {
  queue: JobQueue;
  closeFns: Array<() => Promise<void> | void>;
  drainTimeoutMs: number;
  isIdle: () => boolean;
  now?: () => number;
}

/**
 * Graceful drain:
 * 1. Stop pulling new jobs (caller flips a `draining` flag before invoking).
 * 2. Wait for `isIdle()` (no running jobs) up to `drainTimeoutMs`.
 * 3. Close the WS publisher, the health server, and any other registered closers.
 * The queue is journal-backed so any in-flight job that does not complete will
 * be picked up on next start.
 */
export async function gracefulShutdown(opts: ShutdownOpts): Promise<{ drained: boolean; waited_ms: number }> {
  const start = (opts.now ?? Date.now)();
  const deadline = start + opts.drainTimeoutMs;
  let drained = opts.isIdle();
  while (!drained && (opts.now ?? Date.now)() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
    drained = opts.isIdle();
  }
  await Promise.allSettled(opts.closeFns.map((fn) => Promise.resolve(fn())));
  const waited_ms = (opts.now ?? Date.now)() - start;
  opts.queue.compact();
  return { drained, waited_ms };
}
