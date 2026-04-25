import { resolve } from "node:path";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { createDaemon } from "./daemon.ts";
import type { DaemonConfig } from "./types.ts";
import type { SiteConfig } from "@llm-seo-lab/shared";

interface Cli {
  argv: string[];
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  /**
   * If true, `daemon start` returns as soon as the daemon's sockets are
   * listening (instead of blocking until SIGTERM). The caller is then
   * responsible for stopping the daemon via SIGTERM/SIGINT — used only by
   * tests that want to probe startup without owning the process lifetime.
   */
  exitAfterStart?: boolean;
}

async function waitForShutdown(d: { stop: () => Promise<unknown> }): Promise<void> {
  await new Promise<void>((resolve) => {
    let stopping = false;
    const onSignal = (sig: NodeJS.Signals): void => {
      if (stopping) return;
      stopping = true;
      void d.stop().finally(() => resolve());
      process.stderr.write(`[cli-worker] received ${sig}; draining…\n`);
    };
    process.once("SIGTERM", () => onSignal("SIGTERM"));
    process.once("SIGINT", () => onSignal("SIGINT"));
  });
}

export async function main(cli: Cli): Promise<number> {
  const out = cli.stdout ?? process.stdout;
  const errOut = cli.stderr ?? process.stderr;
  const [verb, sub, ...rest] = cli.argv;
  if (!verb) return usage(errOut);

  if (verb === "daemon" && sub === "start") {
    const cfg = loadDaemonConfig(rest);
    const d = createDaemon({ config: cfg });
    await d.start();
    out.write(JSON.stringify({ status: "started", ports: d.ports() }) + "\n");
    if ((cli as { exitAfterStart?: boolean }).exitAfterStart) return 0;
    await waitForShutdown(d);
    return 0;
  }

  if (verb === "version") {
    out.write("0.1.0-alpha.1\n");
    return 0;
  }

  return usage(errOut);
}

function usage(stream: NodeJS.WritableStream): number {
  stream.write(
    [
      "Usage:",
      "  llm-seo-lab daemon start [--data-dir DIR] [--ws-port N] [--http-port N] [--config FILE]",
      "  llm-seo-lab version",
      "",
    ].join("\n"),
  );
  return 1;
}

export function loadDaemonConfig(rest: string[]): DaemonConfig {
  const flags = parseFlags(rest);
  const data_dir = flags.get("data-dir") ?? resolve(process.env["HOME"] ?? ".", ".llm-seo-lab");
  mkdirSync(data_dir, { recursive: true });
  const ws_port = Number(flags.get("ws-port") ?? "7302");
  const http_port = Number(flags.get("http-port") ?? "7303");
  const max_concurrent_jobs = Number(flags.get("concurrency") ?? "2");
  const shutdown_grace_ms = Number(flags.get("shutdown-grace-ms") ?? "30000");
  const cfgPath = flags.get("config") ?? resolve(data_dir, "daemon.json");
  let site_configs: SiteConfig[] = [];
  if (existsSync(cfgPath)) {
    const raw = readFileSync(cfgPath, "utf8");
    const parsed = JSON.parse(raw) as { site_configs?: SiteConfig[] };
    site_configs = parsed.site_configs ?? [];
  }
  return { data_dir, ws_port, http_port, max_concurrent_jobs, shutdown_grace_ms, site_configs };
}

function parseFlags(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i]!;
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        m.set(key, next);
        i += 1;
      } else {
        m.set(key, "true");
      }
    }
  }
  return m;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main({ argv: process.argv.slice(2) }).then((code) => process.exit(code));
}
