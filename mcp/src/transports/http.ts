import { createServer } from "node:http";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dispatch } from "./jsonrpc.ts";
import type { JsonRpcRequest } from "./jsonrpc.ts";
import type { ToolRegistry } from "../registry.ts";
import type { ToolContext } from "../types.ts";

export interface HttpTransportHandle {
  server: Server;
  port: number;
  stop: () => Promise<void>;
}

export async function startHttpTransport(
  port: number,
  registry: ToolRegistry,
  ctx: ToolContext,
): Promise<HttpTransportHandle> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST" || req.url !== "/rpc") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    let body: JsonRpcRequest;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRpcRequest;
    } catch (e) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        jsonrpc: "2.0", id: null,
        error: { code: -32700, message: `parse error: ${(e as Error).message}` },
      }));
      return;
    }
    const resp = await dispatch(body, registry, ctx);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(resp));
  });
  await new Promise<void>((resolveP) => server.listen(port, () => resolveP()));
  const addr = server.address() as AddressInfo;
  return {
    server,
    port: addr.port,
    stop: () => new Promise<void>((resolveP) => server.close(() => resolveP())),
  };
}
