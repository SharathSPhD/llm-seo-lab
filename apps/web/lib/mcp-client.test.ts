import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { McpHttpClient, McpHttpError } from "./mcp-client.ts";

function fakeFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (url: string, init?: RequestInit) =>
    handler(String(url), init ?? {})) as unknown as typeof fetch;
}

describe("McpHttpClient", () => {
  it("round-trips a JSON-RPC tools/call envelope and unwraps {ok,value}", async () => {
    let lastBody: unknown;
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch((_url, init) => {
        lastBody = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { ok: true, value: { hello: "world" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    });
    const out = await client.call<{ hello: string }>("ping", { x: 1 });
    assert.deepEqual(out, { hello: "world" });
    const body = lastBody as { jsonrpc: string; method: string; params: { name: string; arguments: unknown } };
    assert.equal(body.jsonrpc, "2.0");
    assert.equal(body.method, "tools/call");
    assert.equal(body.params.name, "ping");
    assert.deepEqual(body.params.arguments, { x: 1 });
  });

  it("returns raw result when server skips the envelope (legacy/non-tool methods)", async () => {
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch(
        () =>
          new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [] } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    });
    const out = await client.call<{ tools: unknown[] }>("tools/list", {});
    assert.deepEqual(out, { tools: [] });
  });

  it("throws McpHttpError when JSON-RPC level error is returned", async () => {
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch(
        () =>
          new Response(
            JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32001, message: "QUOTA_EXCEEDED" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });
    await assert.rejects(
      () => client.call("audit_page", { site_id: "s1" }),
      (err: unknown) => err instanceof McpHttpError && (err as McpHttpError).code === -32001,
    );
  });

  it("throws McpHttpError with tool-level error code when envelope is {ok:false,error}", async () => {
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch(
        () =>
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: {
                ok: false,
                error: {
                  code: "QUOTA_EXCEEDED",
                  message: "rate limited",
                  actionable_next_step: "wait 60s",
                  retry_after_seconds: 60,
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });
    await assert.rejects(
      () => client.call("audit_page", {}),
      (err: unknown) =>
        err instanceof McpHttpError && /audit_page: rate limited/.test((err as Error).message),
    );
  });

  it("throws when HTTP status is not ok", async () => {
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch(() => new Response("nope", { status: 503 })),
    });
    await assert.rejects(
      () => client.call("audit_page", {}),
      (err: unknown) => err instanceof McpHttpError && /MCP HTTP 503/.test((err as Error).message),
    );
  });

  it("throws when result is missing", async () => {
    const client = new McpHttpClient({
      endpoint: "http://x/mcp",
      fetchImpl: fakeFetch(
        () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1 }), { status: 200 }),
      ),
    });
    await assert.rejects(() => client.call("audit_page", {}));
  });
});
