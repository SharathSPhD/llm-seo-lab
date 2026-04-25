/**
 * Live integration test for the AEO ↔ Pratyakṣa contract.
 *
 * The cli-worker loop runner relies on three pratyaksha behaviours:
 *
 *   1. `set_sakshi(content)` accepts the AEO invariant string and acks ok.
 *   2. `context_insert` of an older, lower-precision recommendation lands
 *      in the Avacchedaka store keyed by AEO-shaped qualificand
 *      (`<site_id>::<page_url>`) + qualifier (tactic) + condition
 *      (`tier=...`).
 *   3. `sublate_with_evidence` against that older id with strictly
 *      higher precision succeeds, and `context_retrieve` for the same
 *      bucket then surfaces only the newer element — the older one is
 *      retrieval-invisible. This is the witness + sublation gate that
 *      the loop's Buddhi step depends on.
 *
 * If those contracts ever drift in pratyaksha, the AEO Buddhi gate
 * silently goes wrong: stale recommendations get re-emitted, audit
 * trails fork, and the "never overwrite a prior recommendation —
 * sublate it" invariant is breached. This test is the tripwire.
 *
 * The test spawns the real Python pratyaksha server vendored at
 * `tools/pratyaksha/mcp/server.py` via `uv run --no-project`. It's a
 * true cross-process, cross-language integration test. Skips cleanly
 * when uv is not on PATH or the submodule has not been initialised, so
 * minimal CI runners can still pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SERVER_PATH = join(REPO_ROOT, "tools", "pratyaksha", "mcp", "server.py");
const SERVER_DIR = dirname(SERVER_PATH);

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: { structuredContent?: Record<string, unknown>; isError?: boolean; content?: unknown };
  error?: { code: number; message: string };
}

class PratyakshaSession {
  private readonly proc: ChildProcessWithoutNullStreams;
  private buf = "";
  private nextId = 1;
  private readonly pending = new Map<number, (r: JsonRpcResponse) => void>();
  private readonly stderrTail: string[] = [];
  private closed = false;

  constructor(env: NodeJS.ProcessEnv) {
    this.proc = spawn("uv", ["run", "--no-project", "server.py"], {
      cwd: SERVER_DIR,
      env,
    });
    this.proc.stdout.on("data", (b: Buffer) => this.handleStdout(b));
    this.proc.stderr.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      this.stderrTail.push(s);
      if (this.stderrTail.length > 50) this.stderrTail.shift();
    });
    this.proc.on("close", () => { this.closed = true; });
  }

  private handleStdout(b: Buffer): void {
    this.buf += b.toString("utf8");
    while (true) {
      const nl = this.buf.indexOf("\n");
      if (nl < 0) break;
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let parsed: JsonRpcResponse;
      try { parsed = JSON.parse(line) as JsonRpcResponse; } catch { continue; }
      if (typeof parsed.id !== "number") continue;
      const cb = this.pending.get(parsed.id);
      if (cb) {
        this.pending.delete(parsed.id);
        cb(parsed);
      }
    }
  }

  /**
   * Send a JSON-RPC request and resolve when the response with the matching id arrives.
   * Rejects with a clear stderr-tail-anchored message if the child closes first.
   */
  private request(method: string, params: unknown): Promise<JsonRpcResponse> {
    if (this.closed) return Promise.reject(new Error("pratyaksha child already closed"));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`pratyaksha ${method} timed out; stderr tail=${this.stderrTail.join("").slice(-300)}`));
      }, 30_000);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.proc.stdin.write(payload);
    });
  }

  /** Notifications carry no id and expect no response. */
  private notify(method: string, params: unknown): void {
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    this.proc.stdin.write(payload);
  }

  async initialize(): Promise<void> {
    const init = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "aeo-pratyaksha-int-test", version: "0.2.0" },
    });
    if (init.error) {
      throw new Error(`pratyaksha initialize failed: ${init.error.message}; stderr tail=${this.stderrTail.join("").slice(-300)}`);
    }
    this.notify("notifications/initialized", {});
  }

  async callTool<T extends Record<string, unknown>>(name: string, args: unknown): Promise<T> {
    const r = await this.request("tools/call", { name, arguments: { args } });
    if (r.error) throw new Error(`pratyaksha ${name}: ${r.error.message}`);
    const result = r.result;
    if (!result) throw new Error(`pratyaksha ${name}: empty result`);
    if (result.isError) {
      throw new Error(`pratyaksha ${name}: tool error (${JSON.stringify(result.structuredContent ?? {})})`);
    }
    return (result.structuredContent ?? {}) as T;
  }

  close(): void {
    this.closed = true;
    this.proc.kill("SIGTERM");
  }
}

function uvAvailable(): boolean {
  try {
    const r = spawnSync("uv", ["--version"], { encoding: "utf8" });
    return r.status === 0;
  } catch {
    return false;
  }
}

test("pratyaksha integration: witness + sublation path matches AEO contract", async (t) => {
  if (!existsSync(SERVER_PATH)) {
    t.skip(`pratyaksha server not found at ${SERVER_PATH}; submodule not initialised. Run: git submodule update --init tools/pratyaksha`);
    return;
  }
  if (!uvAvailable()) {
    t.skip("uv not on PATH; skipping live pratyaksha integration test (install with: curl -LsSf https://astral.sh/uv/install.sh | sh)");
    return;
  }

  const cacheDir = mkdtempSync(join(tmpdir(), "aeo-pratyaksha-int-"));
  const env = { ...process.env, PRATYAKSHA_CACHE_DIR: cacheDir, PRATYAKSHA_LOG_LEVEL: "WARNING" };
  const session = new PratyakshaSession(env);

  try {
    await session.initialize();

    const sakshi = await session.callTool<{ ok: boolean; system_message?: string }>("set_sakshi", {
      content:
        "AEO closed-loop invariants (R3 verdict): " +
        "subscription-only Claude CLI; audit precedes brief; brief precedes PR; " +
        "no synthetic citations are ever emitted; " +
        "never overwrite a prior recommendation -- sublate it with evidence; " +
        "the witness invariant is itself immune to compaction.",
    });
    assert.equal(sakshi.ok, true, `set_sakshi should accept the AEO invariant: ${JSON.stringify(sakshi)}`);

    const qualificand = "aeo_int::https://aeo-int.example/p1";
    const qualifier = "cite_sources";
    const condition = "tier=tier1";

    const ins1 = await session.callTool<{ ok: boolean }>("context_insert", {
      id: "old_brief_int_001",
      content: "freshness | tier=tier2 | lift=2pp | stale advice from a prior run; weak GEO citation",
      precision: 0.1,
      qualificand,
      qualifier,
      condition,
      provenance: "aeo:integration:setup",
    });
    assert.equal(ins1.ok, true, "context_insert should accept the older low-precision brief");

    const ret_before = await session.callTool<{ count: number }>("context_retrieve", {
      qualificand,
      qualifier,
      condition,
      precision_threshold: 0.05,
    });
    assert.equal(ret_before.count, 1, "exactly one element visible before sublation");

    const sub = await session.callTool<{ ok: boolean; newer_id?: string; error?: string }>("sublate_with_evidence", {
      older_id: "old_brief_int_001",
      newer_content:
        "cite_sources | tier=tier1 | lift=14pp | a much higher-precision recommendation: " +
        "cite primary GEO sources (GEO §3.1) for the headline claim and add a methodology callout",
      newer_precision: 0.7,
      qualificand,
      qualifier,
      condition,
      provenance: "aeo:integration:supersede",
    });
    assert.equal(sub.ok, true, `sublate_with_evidence should succeed with strictly higher precision: ${JSON.stringify(sub)}`);
    assert.ok(sub.newer_id, "sublate_with_evidence should return the newer element id");

    const ret_after = await session.callTool<{ count: number; elements: { id: string }[] }>("context_retrieve", {
      qualificand,
      qualifier,
      condition,
      precision_threshold: 0.05,
    });
    assert.equal(ret_after.count, 1, "after sublation, only the newer element is retrieval-visible");
    assert.notEqual(ret_after.elements[0]!.id, "old_brief_int_001", "sublated older element must NOT surface");
    assert.equal(ret_after.elements[0]!.id, sub.newer_id, "the visible element is the new one created by sublation");

    const sub_weak = await session.callTool<{ ok: boolean; error?: string }>("sublate_with_evidence", {
      older_id: sub.newer_id,
      newer_content: "weaker rewrite with the same predicted lift",
      newer_precision: 0.7,
      qualificand,
      qualifier,
      condition,
      provenance: "aeo:integration:should-reject",
    });
    assert.equal(sub_weak.ok, false, "non-strict precision improvement must be rejected by sublate_with_evidence");

    const got = await session.callTool<{ sakshi: string | null }>("get_sakshi", {});
    assert.ok(got.sakshi !== null, "AEO Sākṣī invariant must persist within the session");
    assert.match(got.sakshi!, /AEO closed-loop invariants/);
    assert.match(got.sakshi!, /sublate it with evidence/);
  } finally {
    session.close();
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
