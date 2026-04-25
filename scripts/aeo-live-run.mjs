#!/usr/bin/env node
/**
 * scripts/aeo-live-run.mjs
 *
 * One-shot end-to-end execution of the AEO closed loop against a real
 * customer site. Used for Phase R5 evidence and as the canonical
 * reproduction recipe for live-run demos.
 *
 * What it does:
 *
 *   1. Connects to the running llm-seo-lab MCP HTTP server
 *      (default `http://127.0.0.1:7301/rpc`, override with
 *       `LLM_SEO_LAB_MCP_URL`).
 *   2. Builds a synthetic `JobRecord` of kind `loop` for the site_id
 *      passed on the command line (`--site sharathsphd-githubio`).
 *   3. Optionally constructs a `StdioPratyakshaClient` against the
 *      vendored `tools/pratyaksha` MCP server (skipped when the
 *      submodule is missing or `uv` is not available — the loop then
 *      degrades to NoopPratyakshaClient).
 *   4. Calls `runLoopOnce` directly — no intermediate daemon.
 *      Streams every progress event to stdout as a JSON line so
 *      the transcript can be replayed.
 *   5. Persists the full transcript + final result as
 *      `docs/use-cases/<run_id>/transcript.jsonl` and `result.json`,
 *      and prints the resulting PR URL on stdout.
 *
 * Why this exists:
 *
 *   The architecture review demanded evidence that the loop has
 *   actually been executed against a real site (not just unit-tested
 *   with mocks). This script is that evidence path. It also doubles
 *   as the reference implementation other surface areas (CLI
 *   commands, dashboard "Run loop" button) can copy from.
 *
 * Safety:
 *
 *   This will open a real PR. The site_id you pass must point at a
 *   repo you have write access to. Use `--dry-run` to skip the final
 *   `open_pr` call (Manas + Buddhi still execute, but no PR opens).
 */

import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const args = parseArgs(process.argv.slice(2));
const siteId = args["--site"] ?? "sharathsphd-githubio";
const runId = args["--run-id"] ?? `${siteId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outDir = resolve(repoRoot, "docs", "use-cases", runId);
mkdirSync(outDir, { recursive: true });

const transcriptPath = resolve(outDir, "transcript.jsonl");
const resultPath = resolve(outDir, "result.json");
const errorPath = resolve(outDir, "error.json");

function appendLine(obj) {
  appendFileSync(transcriptPath, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
}

function child(cmd, argv, opts = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stdout = ""; let stderr = "";
    p.stdout.on("data", (d) => { stdout += String(d); });
    p.stderr.on("data", (d) => { stderr += String(d); });
    p.on("close", (code) => res({ stdout, stderr, code: code ?? 1 }));
    p.on("error", (e) => res({ stdout: "", stderr: String(e), code: 127 }));
  });
}

(async () => {
  appendLine({ event: "live_run.start", site_id: siteId, run_id: runId });

  const tsxImport = (relPath) =>
    import(resolve(repoRoot, relPath)).catch((e) => {
      appendLine({ event: "live_run.import_failed", path: relPath, error: String(e) });
      throw e;
    });

  const { HttpMcpClient, McpToolError } = await tsxImport("packages/cli-worker/src/mcp_client.ts");
  const { runLoopOnce } = await tsxImport("packages/cli-worker/src/runners/loop.ts");
  const { NoopPratyakshaClient, StdioPratyakshaClient } = await tsxImport("packages/cli-worker/src/pratyaksha_client.ts");

  const mcpUrl = process.env["LLM_SEO_LAB_MCP_URL"] ?? "http://127.0.0.1:7301/rpc";
  const mcp = new HttpMcpClient({ endpoint: mcpUrl });

  const ping = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }),
  }).catch((e) => ({ ok: false, error: String(e) }));
  if (!ping || ping.ok !== true) {
    const msg = `MCP server unreachable at ${mcpUrl}. Start it with:\n  node --experimental-strip-types --no-warnings ${repoRoot}/mcp/bin/llm-seo-lab-mcp.mjs --port=7301 --data-dir=${repoRoot}/data`;
    appendLine({ event: "live_run.mcp_unreachable", error: msg });
    writeFileSync(errorPath, JSON.stringify({ error: msg }, null, 2));
    console.error(msg);
    process.exit(2);
  }
  appendLine({ event: "live_run.mcp_reachable", endpoint: mcpUrl });

  const pratyakshaServerPath = resolve(repoRoot, "tools", "pratyaksha", "mcp", "server.py");
  let pratyaksha = new NoopPratyakshaClient();
  if (existsSync(pratyakshaServerPath)) {
    const uvAvailable = (await child("uv", ["--version"])).code === 0;
    if (uvAvailable) {
      pratyaksha = new StdioPratyakshaClient({ serverPath: pratyakshaServerPath });
      appendLine({ event: "live_run.pratyaksha_enabled", server: pratyakshaServerPath, available: pratyaksha.available });
    } else {
      appendLine({ event: "live_run.pratyaksha_skipped", reason: "uv not on PATH" });
    }
  } else {
    appendLine({ event: "live_run.pratyaksha_skipped", reason: "submodule missing", path: pratyakshaServerPath });
  }

  const job = {
    id: `live-${runId}`,
    site_id: siteId,
    kind: "loop",
    status: "running",
    enqueued_at: Date.now(),
    started_at: Date.now(),
    attempt: 1,
    payload: { site_id: siteId, dry_run: !!args["--dry-run"] },
  };
  appendLine({ event: "live_run.job", job });

  let result;
  try {
    result = await runLoopOnce(job, {
      mcp,
      pratyaksha,
      emitProgress: (step, data) => appendLine({ event: "loop.progress", step, data: data ?? {} }),
    });
  } catch (e) {
    const error = e instanceof McpToolError
      ? { name: "McpToolError", code: e.code, message: e.message, fix: e.actionable_next_step }
      : { name: e?.name ?? "Error", message: String(e?.message ?? e), stack: e?.stack };
    appendLine({ event: "live_run.failed", error });
    writeFileSync(errorPath, JSON.stringify(error, null, 2));
    console.error("[live-run] FAILED:", error.message);
    process.exit(1);
  }

  appendLine({ event: "live_run.result", result });
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ run_id: runId, ...result }, null, 2));
  if (result.pr_url) console.log(`\nPR: ${result.pr_url}`);
})();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq !== -1) {
      out[tok.slice(0, eq)] = tok.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[tok] = next;
        i += 1;
      } else {
        out[tok] = true;
      }
    }
  }
  return out;
}
