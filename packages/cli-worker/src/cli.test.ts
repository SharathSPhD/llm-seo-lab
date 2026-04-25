import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { loadDaemonConfig, main } from "./cli.ts";

class Capture extends Writable {
  buf = "";
  override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (err?: Error | null) => void): void {
    this.buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    cb();
  }
}

describe("loadDaemonConfig", () => {
  it("uses defaults when no flags or file are provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-"));
    try {
      const cfg = loadDaemonConfig(["--data-dir", dir]);
      assert.equal(cfg.data_dir, dir);
      assert.equal(cfg.ws_port, 7302);
      assert.equal(cfg.http_port, 7303);
      assert.equal(cfg.max_concurrent_jobs, 2);
      assert.deepEqual(cfg.site_configs, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads site_configs from --config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-"));
    try {
      const cfgPath = join(dir, "daemon.json");
      writeFileSync(cfgPath, JSON.stringify({
        site_configs: [{
          site_id: "s1",
          repo_path: dir,
          site_url: "https://x",
          tier: "indie",
          action_substrate: "git",
          engines: ["claude_ai"],
          topics: [],
          question_banks: {},
          evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
          rate_limits: { audit_page_per_minute: 10, oracle_query_per_minute: 10, generate_brief_per_minute: 5, open_pr_per_minute: 2 },
          telemetry: false,
        }],
      }));
      const cfg = loadDaemonConfig(["--data-dir", dir, "--config", cfgPath]);
      assert.equal(cfg.site_configs.length, 1);
      assert.equal(cfg.site_configs[0]!.site_id, "s1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("cli main()", () => {
  it("prints version", async () => {
    const out = new Capture();
    const code = await main({ argv: ["version"], stdout: out });
    assert.equal(code, 0);
    assert.equal(out.buf.trim(), "0.1.0-alpha.1");
  });

  it("prints usage and exits 1 on unknown verb", async () => {
    const errOut = new Capture();
    const code = await main({ argv: ["nope"], stderr: errOut });
    assert.equal(code, 1);
    assert.match(errOut.buf, /Usage:/);
  });
});
