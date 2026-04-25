import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitSubstrate } from "./git.ts";

interface Call {
  cmd: string;
  args: string[];
  cwd: string;
  stdin?: string;
}

function fakeExec(responses: Array<{ code: number; stdout?: string; stderr?: string }>): {
  exec: (cmd: string, args: string[], cwd: string, stdin?: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  calls: Call[];
} {
  const calls: Call[] = [];
  let i = 0;
  return {
    calls,
    async exec(cmd, args, cwd, stdin) {
      const call: Call = { cmd, args, cwd };
      if (stdin !== undefined) call.stdin = stdin;
      calls.push(call);
      const r = responses[i] ?? { code: 0 };
      i += 1;
      return { code: r.code, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
    },
  };
}

describe("GitSubstrate.publish", () => {
  it("happy path: checkout, apply, commit, push, gh pr create", async () => {
    const f = fakeExec([
      { code: 0 },
      { code: 0 },
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: "https://github.com/SharathSPhD/llm-seo-lab/pull/42\n" },
    ]);
    const sub = new GitSubstrate({ repo_path: "/tmp/r", exec: f.exec });
    const res = await sub.publish({
      site_id: "s1",
      branch_name: "aeo-fix/2026-04-25",
      patch_unified_diff: "diff --git a/x b/x\n",
      pr_title: "Add Tier-1 quotation block",
      pr_body: "predicted_lift_pp=8\nreference: GEO §3.2",
      labels: ["aeo-fix", "automated"],
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.pr_id, "pr:42");
      assert.equal(res.value.pr_url, "https://github.com/SharathSPhD/llm-seo-lab/pull/42");
      assert.equal(res.value.branch, "aeo-fix/2026-04-25");
    }
    assert.equal(f.calls[0]!.cmd, "git");
    assert.deepEqual(f.calls[0]!.args, ["checkout", "-b", "aeo-fix/2026-04-25"]);
    assert.equal(f.calls[1]!.stdin, "diff --git a/x b/x\n");
    assert.equal(f.calls[4]!.cmd, "gh");
    assert.ok(f.calls[4]!.args.includes("--label"));
  });

  it("returns GH_CLI_FAILED when gh pr create fails", async () => {
    const f = fakeExec([
      { code: 0 },
      { code: 0 },
      { code: 0 },
      { code: 0 },
      { code: 1, stderr: "not authenticated" },
    ]);
    const sub = new GitSubstrate({ repo_path: "/tmp/r", exec: f.exec });
    const res = await sub.publish({
      site_id: "s1",
      branch_name: "br",
      patch_unified_diff: "diff",
      pr_title: "t",
      pr_body: "b",
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, "GH_CLI_FAILED");
      assert.match(res.error.message, /gh pr create failed/);
    }
  });

  it("returns GH_CLI_FAILED when git apply fails", async () => {
    const f = fakeExec([
      { code: 0 },
      { code: 1, stderr: "patch does not apply" },
    ]);
    const sub = new GitSubstrate({ repo_path: "/tmp/r", exec: f.exec });
    const res = await sub.publish({
      site_id: "s1",
      branch_name: "br",
      patch_unified_diff: "diff",
      pr_title: "t",
      pr_body: "b",
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error.message, /git apply failed/);
    }
  });
});
