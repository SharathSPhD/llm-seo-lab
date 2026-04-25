/**
 * Minimal JSON-RPC client for the llm-seo-lab MCP server over HTTP.
 *
 * The runner injects an instance of this; tests inject a fake. We do not
 * use stdio here because the daemon talks to a long-lived HTTP MCP server
 * (started independently or by the daemon itself). Stdio is reserved for
 * the Cursor plugin invocation path.
 */
export interface McpClient {
  call(tool: string, input: unknown): Promise<unknown>;
}

export class HttpMcpClient implements McpClient {
  private readonly endpoint: string;
  private id = 0;

  constructor(opts: { endpoint?: string } = {}) {
    this.endpoint = opts.endpoint ?? "http://127.0.0.1:7301/rpc";
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
    const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }
}
