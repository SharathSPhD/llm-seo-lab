import type { AeoError, Result } from "@llm-seo-lab/shared";

export interface ToolDescriptor<I, O> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  handler: (input: I, ctx: ToolContext) => Promise<Result<O>>;
}

export interface ToolContext {
  workers: {
    claude: ClaudeWorker;
    playwright: PlaywrightWorker;
    fs: FileSystemWatcher;
  };
  rateLimit: RateLimiter;
  now: () => Date;
  cwd: string;
}

export interface ClaudeWorker {
  invoke(prompt: string, opts?: { timeoutMs?: number }): Promise<Result<string>>;
  stats(): { inflight: number; queue_depth: number };
}

export interface PlaywrightWorker {
  query(engine: string, question: string): Promise<Result<{ cited_urls: string[]; snippet?: string }>>;
  sessionsAlive(): number;
}

export interface FileSystemWatcher {
  watch(path: string, cb: (evt: { type: "add" | "change" | "remove"; path: string }) => void): () => void;
}

export interface RateLimiter {
  take(key: string, n?: number): Promise<Result<void>>;
}

export type { AeoError, Result };
