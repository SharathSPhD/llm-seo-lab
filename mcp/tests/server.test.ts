import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.ts";
import { dispatch } from "../src/transports/jsonrpc.ts";

test("server registers all 16 tools (12 core + 4 read-side)", async () => {
  const s = await startServer({ enableStdio: false });
  assert.equal(s.registry.size(), 16);
});

test("ping over jsonrpc returns pong", async () => {
  const s = await startServer({ enableStdio: false });
  const r = await dispatch({ jsonrpc: "2.0", id: 1, method: "ping" }, s.registry, s.ctx);
  assert.deepEqual(r.result, { pong: true });
});

test("tools/list returns the registered tools", async () => {
  const s = await startServer({ enableStdio: false });
  const r = await dispatch({ jsonrpc: "2.0", id: 2, method: "tools/list" }, s.registry, s.ctx);
  const result = r.result as { tools: { name: string }[] };
  const names = result.tools.map((t) => t.name).sort();
  assert.ok(names.includes("audit_page"));
  assert.ok(names.includes("oracle_query"));
  assert.ok(names.includes("compare_competitors"));
  assert.ok(names.includes("list_sites"));
  assert.ok(names.includes("read_latest_audit"));
  assert.ok(names.includes("list_prs"));
  assert.ok(names.includes("read_citation_trend"));
  assert.equal(names.length, 16);
});

test("unknown tool returns -32601", async () => {
  const s = await startServer({ enableStdio: false });
  const r = await dispatch({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "no_such_tool", arguments: {} },
  }, s.registry, s.ctx);
  assert.ok(r.error);
  assert.equal(r.error!.code, -32601);
});

test("HTTP transport round-trips ping and tool call", async () => {
  const s = await startServer({ enableStdio: false, httpPort: 0 });
  const port = s.http!.port;
  try {
    const r1 = await fetch(`http://127.0.0.1:${port}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    const j1 = await r1.json() as { result: { pong: boolean } };
    assert.equal(j1.result.pong, true);

    const r2 = await fetch(`http://127.0.0.1:${port}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "tools/call",
        params: {
          name: "emit_schema",
          arguments: {
            page_type: "Article",
            page_url: "https://example.com/x",
            page_title: "Hello",
            facts: { author_name: "Alex", date_published: "2026-04-25", publisher_name: "Acme" },
          },
        },
      }),
    });
    const j2 = await r2.json() as { result: { ok: boolean; value?: { jsonld: Record<string, unknown> } } };
    assert.equal(j2.result.ok, true);
    assert.equal(j2.result.value!.jsonld["@type"], "Article");
  } finally {
    await s.http!.stop();
  }
});

test("HTTP transport rejects malformed JSON with -32700", async () => {
  const s = await startServer({ enableStdio: false, httpPort: 0 });
  try {
    const r = await fetch(`http://127.0.0.1:${s.http!.port}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(r.status, 400);
    const j = await r.json() as { error: { code: number } };
    assert.equal(j.error.code, -32700);
  } finally {
    await s.http!.stop();
  }
});
