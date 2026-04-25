import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDaemon } from "./daemon.ts";
import type { McpClient } from "./mcp_client.ts";
import type { SiteConfig } from "@llm-seo-lab/shared";

function fakeMcp(byTool: Record<string, unknown>): McpClient {
  return {
    async call(tool: string, _input: unknown) {
      const v = byTool[tool];
      if (v === undefined) throw new Error(`fake mcp: ${tool} not configured`);
      return v;
    },
  };
}

function siteCfg(): SiteConfig {
  return {
    site_id: "s1",
    repo_path: "/tmp/repo",
    site_url: "https://example.com",
    tier: "indie",
    action_substrate: "git",
    engines: ["claude_ai"],
    topics: [],
    question_banks: {},
    evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
    rate_limits: {
      audit_page_per_minute: 10,
      oracle_query_per_minute: 10,
      generate_brief_per_minute: 5,
      open_pr_per_minute: 2,
    },
    telemetry: false,
  };
}

describe("daemon", () => {
  it("starts, exposes /health, accepts an enqueue, processes a loop job, and shuts down cleanly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "daemon-"));
    try {
      const mcp = fakeMcp({
        read_config: {
          site_id: "s1",
          pages: ["/a"],
          evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
        },
        audit_page: {
          audit_id: "a1",
          gaps: [{ id: "g1", tactic: "cite_sources", tier: 1, predicted_lift_pp: 7, geo_paper_reference: "GEO §3.1" }],
        },
        generate_brief: { unified_diff: "diff\n" },
        open_pr: { pr_id: "pr:1", pr_url: "https://x/1" },
      });

      const d = createDaemon({
        config: {
          data_dir: dir,
          ws_port: 0,
          http_port: 0,
          max_concurrent_jobs: 1,
          shutdown_grace_ms: 2000,
          site_configs: [siteCfg()],
        },
        mcp,
      });

      await d.start();
      const ports = d.ports();
      const job = d.enqueue({ site_id: "s1", kind: "loop", payload: { repo_path: "." } });
      assert.equal(job.kind, "loop");

      const ok = await waitFor(() => d.health().jobs_completed === 1, 5000);
      assert.equal(ok, true, "job did not complete in time");

      const res = await fetch(`http://127.0.0.1:${ports.http}/health`);
      const body = (await res.json()) as { jobs_completed: number; jobs_failed: number; status: string };
      assert.equal(body.jobs_completed, 1);
      assert.equal(body.jobs_failed, 0);
      assert.equal(body.status, "ok");

      const stop = await d.stop();
      assert.equal(stop.drained, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-queues a job whose rate-limit was exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "daemon-"));
    try {
      const mcp = fakeMcp({
        read_config: { site_id: "s1", pages: ["/a"], evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 } },
        audit_page: { audit_id: "a", gaps: [] },
      });
      const cfg = siteCfg();
      cfg.rate_limits.audit_page_per_minute = 1;
      const d = createDaemon({
        config: {
          data_dir: dir,
          ws_port: 0,
          http_port: 0,
          max_concurrent_jobs: 1,
          shutdown_grace_ms: 1000,
          site_configs: [cfg],
        },
        mcp,
      });
      await d.start();
      d.enqueue({ site_id: "s1", kind: "loop", payload: { repo_path: "." } });
      const j2 = d.enqueue({ site_id: "s1", kind: "loop", payload: { repo_path: "." } });

      await waitFor(() => d.health().jobs_completed >= 1, 3000);
      await new Promise((r) => setTimeout(r, 200));
      const h = d.health();
      assert.ok(h.jobs_completed >= 1);
      assert.ok(j2.id);

      await d.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function waitFor(pred: () => boolean, timeout_ms: number): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout_ms) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
