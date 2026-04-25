import type { Readable, Writable } from "node:stream";
import { dispatch } from "./jsonrpc.ts";
import type { JsonRpcRequest } from "./jsonrpc.ts";
import type { ToolRegistry } from "../registry.ts";
import type { ToolContext } from "../types.ts";

export function startStdioTransport(
  input: Readable,
  output: Writable,
  registry: ToolRegistry,
  ctx: ToolContext,
): { stop: () => void } {
  let buf = "";
  const handler = (chunk: Buffer | string): void => {
    buf += String(chunk);
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      void (async (): Promise<void> => {
        let req: JsonRpcRequest;
        try {
          req = JSON.parse(line) as JsonRpcRequest;
        } catch (e) {
          output.write(JSON.stringify({
            jsonrpc: "2.0", id: null,
            error: { code: -32700, message: `parse error: ${(e as Error).message}` },
          }) + "\n");
          return;
        }
        const resp = await dispatch(req, registry, ctx);
        output.write(JSON.stringify(resp) + "\n");
      })();
    }
  };
  input.on("data", handler);
  return { stop: () => { input.off("data", handler); } };
}
