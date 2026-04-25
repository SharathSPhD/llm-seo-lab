/**
 * Pratyakṣa MCP client for the cli-worker daemon.
 *
 * The pratyaksha server is a Python FastMCP stdio server vendored at
 * `tools/pratyaksha/mcp/server.py`. The daemon shells out to `uv run
 * --no-project server.py`, performs the MCP `initialize` handshake, and
 * issues `tools/call` requests over stdin/stdout.
 *
 * The R3 verdict (`docs/decisions/2026-04-26-pratyaksha-integration.md`)
 * is to ADOPT three pratyaksha tools at the loop layer:
 *
 *   - `set_sakshi`              — pin AEO invariants
 *   - `detect_conflict`         — Buddhi gate against prior recommendations
 *   - `sublate_with_evidence`   — preserve audit trail when superseding
 *
 * Plus two Avacchedaka-store helpers that Sublation rides on:
 *
 *   - `context_insert`          — record a new recommendation
 *   - `context_retrieve`        — fetch prior recommendations by qualificand
 *
 * Pratyaksha tools take a single `args` parameter that wraps the actual
 * Pydantic input model. We hide that wrapping behind this client so callers
 * pass the bare object.
 *
 * Fail-open: if pratyaksha is not installed (uv missing, submodule missing,
 * Python missing), the loop should continue with a `NoopPratyakshaClient`
 * that simply returns "no conflict" / "no prior recommendations" — same
 * convention as the SessionStart hook. The daemon picks the right client at
 * startup based on what's available; tests inject a fake.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export interface PratyakshaClient {
  setSakshi(input: { content: string }): Promise<{ ok: boolean; tokens?: number }>;
  contextInsert(input: ContextInsertInput): Promise<{ ok: boolean; element_id?: string }>;
  contextRetrieve(input: ContextRetrieveInput): Promise<{ ok: boolean; elements: ContextElement[] }>;
  detectConflict(input: ContextRetrieveInput): Promise<{ ok: boolean; conflict_pairs: ConflictPair[] }>;
  sublateWithEvidence(input: SublateWithEvidenceInput): Promise<{
    ok: boolean;
    already_sublated?: boolean;
    error?: string;
  }>;
  readonly available: boolean;
}

export interface ContextInsertInput {
  id: string;
  content: string;
  precision: number;
  qualificand: string;
  qualifier: string;
  condition: string;
  relation?: string;
  provenance?: string;
  overwrite?: boolean;
}

export interface ContextRetrieveInput {
  qualificand: string;
  condition?: string;
  qualifier?: string;
  precision_threshold?: number;
  max_elements?: number;
}

export interface ContextElement {
  id: string;
  content: string;
  precision: number;
  avacchedaka: { qualificand: string; qualifier: string; condition: string; relation: string };
  sublated_by?: string | null;
}

export interface ConflictPair {
  a_id: string;
  b_id: string;
  a_precision: number;
  b_precision: number;
  jaccard: number;
}

export interface SublateWithEvidenceInput {
  older_id: string;
  newer_content: string;
  newer_precision: number;
  qualificand: string;
  qualifier: string;
  condition: string;
  provenance?: string;
}

/**
 * Returns sensible defaults when pratyaksha is not available; never throws.
 * The loop runner uses these defaults to skip the Buddhi gate without
 * bringing the entire pipeline down.
 */
export class NoopPratyakshaClient implements PratyakshaClient {
  readonly available = false;
  async setSakshi() { return { ok: true, tokens: 0 }; }
  async contextInsert() { return { ok: true }; }
  async contextRetrieve() { return { ok: true, elements: [] }; }
  async detectConflict() { return { ok: true, conflict_pairs: [] }; }
  async sublateWithEvidence() { return { ok: true }; }
}

interface JsonRpcResponse {
  id?: number;
  result?: { structuredContent?: Record<string, unknown>; isError?: boolean };
  error?: { code: number; message: string };
}

/**
 * Single-shot stdio MCP client. Each call spawns a fresh `uv run server.py`
 * process, performs the handshake, issues one `tools/call`, then closes.
 * The pratyaksha server is per-session state, so this does mean the state
 * is reset between calls — which is exactly what we want at the daemon
 * level, since each loop iteration is independent and the session-level
 * state is owned by the SessionStart hook.
 *
 * For the loop's Buddhi gate we keep the lifetime of one call short
 * (`detect_conflict` against the current page's qualificand bucket).
 * Persistent state is held in `data/sites/<site_id>/pratyaksha-store.jsonl`
 * by the loop runner, not in the pratyaksha process.
 */
export class StdioPratyakshaClient implements PratyakshaClient {
  readonly available: boolean;
  private readonly serverPath: string;
  private readonly cwd: string;
  private readonly uvBin: string;
  private nextId = 0;

  constructor(opts: { serverPath: string; uvBin?: string } = { serverPath: "" }) {
    this.serverPath = opts.serverPath;
    this.uvBin = opts.uvBin ?? "uv";
    const exists = opts.serverPath ? existsSync(opts.serverPath) : false;
    this.available = exists;
    const idx = opts.serverPath.lastIndexOf("/");
    this.cwd = idx >= 0 ? opts.serverPath.slice(0, idx) : ".";
  }

  async setSakshi(input: { content: string }) {
    return this.call<{ ok: boolean; tokens?: number }>("set_sakshi", input);
  }
  async contextInsert(input: ContextInsertInput) {
    return this.call<{ ok: boolean; element_id?: string }>("context_insert", input);
  }
  async contextRetrieve(input: ContextRetrieveInput) {
    const r = await this.call<{ ok: boolean; elements?: ContextElement[] }>("context_retrieve", input);
    return { ok: r.ok, elements: r.elements ?? [] };
  }
  async detectConflict(input: ContextRetrieveInput) {
    const r = await this.call<{ ok: boolean; conflict_pairs?: ConflictPair[] }>("detect_conflict", input);
    return { ok: r.ok, conflict_pairs: r.conflict_pairs ?? [] };
  }
  async sublateWithEvidence(input: SublateWithEvidenceInput) {
    return this.call<{ ok: boolean; already_sublated?: boolean; error?: string }>(
      "sublate_with_evidence",
      input,
    );
  }

  private async call<T>(toolName: string, args: unknown): Promise<T> {
    if (!this.available) {
      return { ok: true } as unknown as T;
    }
    this.nextId += 1;
    const id = this.nextId;
    const requests = [
      {
        jsonrpc: "2.0", id: id - 1 + 1000, method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "aeo-cli-worker", version: "0.2.0" },
        },
      },
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      {
        jsonrpc: "2.0", id, method: "tools/call",
        params: { name: toolName, arguments: { args } },
      },
    ];
    const stdinPayload = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
    const stdout = await runOnce(this.uvBin, ["run", "--no-project", basename(this.serverPath)], this.cwd, stdinPayload, 30_000);
    const value = parseToolResponse<T>(stdout, id, toolName);
    return value;
  }
}

function basename(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function parseToolResponse<T>(stdout: string, expectedId: number, toolName: string): T {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    let parsed: JsonRpcResponse;
    try { parsed = JSON.parse(line) as JsonRpcResponse; } catch { continue; }
    if (parsed.id !== expectedId) continue;
    if (parsed.error) {
      throw new Error(`pratyaksha ${toolName}: ${parsed.error.message}`);
    }
    const result = parsed.result;
    if (!result) {
      throw new Error(`pratyaksha ${toolName}: empty result`);
    }
    if (result.isError) {
      throw new Error(`pratyaksha ${toolName}: tool error (${JSON.stringify(result.structuredContent ?? {})})`);
    }
    return (result.structuredContent ?? {}) as T;
  }
  throw new Error(`pratyaksha ${toolName}: no response with id ${expectedId} in stdout`);
}

function runOnce(
  cmd: string,
  args: string[],
  cwd: string,
  stdin: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);
    proc.stdout.on("data", (b: Buffer) => { stdout += b.toString("utf8"); });
    proc.stderr.on("data", (b: Buffer) => { stderr += b.toString("utf8"); });
    proc.on("error", (e) => { clearTimeout(timer); rejectP(new Error(`spawn ${cmd}: ${e.message}`)); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        rejectP(new Error(`pratyaksha child timed out after ${timeoutMs}ms; stderr tail=${stderr.slice(-200)}`));
        return;
      }
      if (code !== 0 && stdout.length === 0) {
        rejectP(new Error(`pratyaksha child exited ${code}; stderr=${stderr.slice(-500)}`));
        return;
      }
      resolveP(stdout);
    });
    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

/**
 * Pick a pratyaksha client based on what's available. Used by the daemon at
 * startup. Tests construct fakes directly.
 */
export function makePratyakshaClient(opts: { serverPath?: string } = {}): PratyakshaClient {
  const path = opts.serverPath ?? process.env["AEO_PRATYAKSHA_SERVER"];
  if (!path) return new NoopPratyakshaClient();
  const client = new StdioPratyakshaClient({ serverPath: path });
  return client.available ? client : new NoopPratyakshaClient();
}
