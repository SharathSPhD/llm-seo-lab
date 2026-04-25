/**
 * Browser/server-shared JSON-RPC client for the llm-seo-lab MCP server.
 *
 * The dashboard does not embed the MCP server in-process; instead it talks to
 * the same MCP HTTP host the cli-worker uses, over JSON-RPC at `POST /rpc`.
 *
 * The MCP server wraps every tool result in a `{ ok, value }` (or
 * `{ ok: false, error }`) envelope. This client unwraps it: callers always
 * receive the bare `value` on success, and a thrown `McpHttpError` on
 * tool-level failure. Transport-level errors (HTTP non-200, JSON-RPC
 * `error`) also throw `McpHttpError`.
 *
 * The client is dependency-free so the same module compiles in Server
 * Components, Server Actions, and edge runtimes alike.
 */

export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

export class McpHttpError extends Error {
  readonly code: number;
  readonly data: unknown;
  constructor(err: McpError) {
    super(err.message);
    this.name = "McpHttpError";
    this.code = err.code;
    this.data = err.data;
  }
}

export interface McpHttpClientOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export const DEFAULT_MCP_ENDPOINT =
  process.env["LLM_SEO_LAB_MCP_URL"] ?? "http://localhost:7301/rpc";

let nextRpcId = 1;

interface ToolEnvelopeOk<T> { ok: true; value: T }
interface ToolEnvelopeErr {
  ok: false;
  error: { code: string; message: string; actionable_next_step?: string };
}

export class McpHttpClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(opts: McpHttpClientOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_MCP_ENDPOINT;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.headers = { "content-type": "application/json", ...(opts.headers ?? {}) };
  }

  async call<T>(tool: string, input: unknown): Promise<T> {
    const id = nextRpcId++;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: tool, arguments: input },
    });
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new McpHttpError({ code: res.status, message: `MCP HTTP ${res.status} for ${tool}` });
    }
    const json = (await res.json()) as {
      result?: ToolEnvelopeOk<T> | ToolEnvelopeErr | T;
      error?: McpError;
    };
    if (json.error) throw new McpHttpError(json.error);
    if (json.result === undefined) {
      throw new McpHttpError({ code: -32603, message: `MCP tool ${tool} returned no result` });
    }
    const env = json.result as unknown;
    if (env && typeof env === "object" && "ok" in (env as Record<string, unknown>)) {
      const e = env as ToolEnvelopeOk<T> | ToolEnvelopeErr;
      if (e.ok) return e.value;
      throw new McpHttpError({
        code: -32000,
        message: `${tool}: ${e.error.message}`,
        data: e.error,
      });
    }
    return env as T;
  }
}
