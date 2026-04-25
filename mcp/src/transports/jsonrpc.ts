import type { ToolRegistry } from "../registry.ts";
import type { ToolContext } from "../types.ts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export async function dispatch(
  req: JsonRpcRequest,
  registry: ToolRegistry,
  ctx: ToolContext,
): Promise<JsonRpcResponse> {
  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: req.id,
      result: {
        tools: registry.list().map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }
  if (req.method === "tools/call") {
    const name = req.params?.name;
    if (!name) {
      return { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: "missing tool name" } };
    }
    const tool = registry.get(name);
    if (!tool) {
      return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `unknown tool: ${name}` } };
    }
    try {
      const r = await tool.handler(req.params?.arguments ?? {}, ctx);
      if (r.ok) {
        return { jsonrpc: "2.0", id: req.id, result: { ok: true, value: r.value } };
      }
      return { jsonrpc: "2.0", id: req.id, result: { ok: false, error: r.error } };
    } catch (e) {
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32603, message: (e as Error).message },
      };
    }
  }
  if (req.method === "ping") {
    return { jsonrpc: "2.0", id: req.id, result: { pong: true } };
  }
  return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `unknown method: ${req.method}` } };
}
