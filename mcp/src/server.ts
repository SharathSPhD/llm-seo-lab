import { ToolRegistry } from "./registry.ts";
import { TokenBucket } from "./middleware/rate_limit.ts";
import { ClaudeCliPool } from "./workers/claude.ts";
import { PlaywrightSessionPool } from "./workers/playwright.ts";
import { NodeFsWatcher } from "./workers/fs_watcher.ts";
import { registerAllTools } from "./tools/index.ts";
import { startStdioTransport } from "./transports/stdio.ts";
import { startHttpTransport } from "./transports/http.ts";
import type { ToolContext } from "./types.ts";

export interface ServerOpts {
  cwd?: string;
  httpPort?: number;
  enableStdio?: boolean;
  rateLimit?: { capacity: number; refillPerMinute: number };
}

export async function startServer(opts: ServerOpts = {}): Promise<{
  registry: ToolRegistry;
  ctx: ToolContext;
  http?: import("./transports/http.ts").HttpTransportHandle;
  stdio?: { stop: () => void };
}> {
  const cwd = opts.cwd ?? process.cwd();
  const registry = new ToolRegistry();
  const ctx: ToolContext = {
    workers: {
      claude: new ClaudeCliPool({ maxConcurrent: 3 }),
      playwright: new PlaywrightSessionPool(() => ({
        alive: false,
        async query() { return { cited_urls: [] }; },
      })),
      fs: new NodeFsWatcher(),
    },
    rateLimit: new TokenBucket(opts.rateLimit ?? { capacity: 30, refillPerMinute: 30 }),
    now: () => new Date(),
    cwd,
  };
  registerAllTools(ctx, registry);

  let http: Awaited<ReturnType<typeof startHttpTransport>> | undefined;
  if (opts.httpPort !== undefined) {
    http = await startHttpTransport(opts.httpPort, registry, ctx);
  }
  let stdio: { stop: () => void } | undefined;
  if (opts.enableStdio !== false && process.stdin.isTTY === false && opts.httpPort === undefined) {
    stdio = startStdioTransport(process.stdin, process.stdout, registry, ctx);
  }

  return { registry, ctx, ...(http ? { http } : {}), ...(stdio ? { stdio } : {}) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const portArg = process.argv.find((a) => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1]!, 10) : undefined;
  const useStdio = process.argv.includes("--stdio");
  startServer({ ...(port !== undefined ? { httpPort: port } : {}), enableStdio: useStdio })
    .then((s) => {
      const ports = s.http?.port ?? "n/a";
      const transports = [s.http ? "http" : null, s.stdio ? "stdio" : null].filter(Boolean).join(",");
      process.stderr.write(`[mcp] llm-seo-lab MCP server up — transports=${transports || "none"} httpPort=${ports} tools=${s.registry.size()}\n`);
    })
    .catch((e) => { process.stderr.write(`[mcp] failed: ${(e as Error).stack}\n`); process.exit(1); });
}
