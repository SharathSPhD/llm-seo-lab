/**
 * Minimal JSON-RPC client for the llm-seo-lab MCP server over HTTP.
 *
 * The runner injects an instance of this; tests inject a fake. We do not
 * use stdio here because the daemon talks to a long-lived HTTP MCP server
 * (started independently or by the daemon itself). Stdio is reserved for
 * the Cursor plugin invocation path.
 *
 * `call()` unwraps the MCP `{ok, value}` tool envelope: callers always
 * receive the bare value on success. Tool-level errors (`{ok: false}`)
 * surface as a thrown `McpToolError` carrying the original `AeoError` code,
 * so the runner can decide whether to retry, back off, or fail fast.
 */
export interface McpClient {
  call(tool: string, input: unknown): Promise<unknown>;
}

export class McpToolError extends Error {
  readonly code: string;
  readonly actionable_next_step: string;
  readonly retry_after_seconds?: number;
  constructor(tool: string, e: { code: string; message: string; actionable_next_step?: string; retry_after_seconds?: number }) {
    super(`${tool}: ${e.message}`);
    this.name = "McpToolError";
    this.code = e.code;
    this.actionable_next_step = e.actionable_next_step ?? "";
    if (e.retry_after_seconds !== undefined) this.retry_after_seconds = e.retry_after_seconds;
  }
}

interface ToolEnvelopeOk<T> { ok: true; value: T }
interface ToolEnvelopeErr {
  ok: false;
  error: { code: string; message: string; actionable_next_step?: string; retry_after_seconds?: number };
}

export class HttpMcpClient implements McpClient {
  private readonly endpoint: string;
  private id = 0;

  constructor(opts: { endpoint?: string } = {}) {
    this.endpoint = opts.endpoint ?? process.env["LLM_SEO_LAB_MCP_URL"] ?? "http://127.0.0.1:7301/rpc";
  }

  async call(tool: string, input: unknown): Promise<unknown> {
    this.id += 1;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: this.id,
      method: "tools/call",
      params: { name: tool, arguments: input },
    });
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      throw new Error(`MCP HTTP ${res.status} for ${tool}`);
    }
    const json = (await res.json()) as {
      result?: ToolEnvelopeOk<unknown> | ToolEnvelopeErr | unknown;
      error?: { code: number; message: string };
    };
    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }
    if (json.result === undefined) {
      throw new Error(`MCP tool ${tool} returned no result`);
    }
    const env = json.result as Partial<ToolEnvelopeOk<unknown> & ToolEnvelopeErr>;
    if (env && typeof env === "object" && "ok" in env) {
      const e = env as ToolEnvelopeOk<unknown> | ToolEnvelopeErr;
      if (e.ok) return e.value;
      throw new McpToolError(tool, e.error);
    }
    return json.result;
  }
}
