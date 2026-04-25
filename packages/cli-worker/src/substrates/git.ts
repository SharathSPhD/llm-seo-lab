import { spawn } from "node:child_process";
import { err, ok } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";
import type { PublishInput, PublishOutput, Substrate } from "./types.ts";

export interface GitSubstrateOpts {
  repo_path: string;
  base_branch?: string;
  exec?: (cmd: string, args: string[], cwd: string, stdin?: string) => Promise<{ code: number; stdout: string; stderr: string }>;
}

/**
 * Git substrate: stages a unified diff onto a fresh branch and opens a PR via
 * `gh pr create`. The exec hook is injected so tests can drive it without
 * spawning real git/gh binaries.
 */
export class GitSubstrate implements Substrate {
  readonly name = "git" as const;
  private readonly opts: GitSubstrateOpts;
  private readonly exec: NonNullable<GitSubstrateOpts["exec"]>;

  constructor(opts: GitSubstrateOpts) {
    this.opts = opts;
    this.exec = opts.exec ?? defaultExec;
  }

  async publish(input: PublishInput): Promise<Result<PublishOutput>> {
    const cwd = this.opts.repo_path;
    const base = this.opts.base_branch ?? "main";
    const branch = input.branch_name;

    const branchOk = await this.exec("git", ["checkout", "-b", branch], cwd);
    if (branchOk.code !== 0) {
      return err({
        code: "GH_CLI_FAILED",
        message: `git checkout -b ${branch} failed: ${branchOk.stderr.trim()}`,
        actionable_next_step: "Resolve the conflicting branch name or pull latest base, then retry.",
      });
    }

    const apply = await this.exec("git", ["apply", "--index", "-"], cwd, input.patch_unified_diff);
    if (apply.code !== 0) {
      return err({
        code: "GH_CLI_FAILED",
        message: `git apply failed: ${apply.stderr.trim()}`,
        actionable_next_step: "Patch did not apply cleanly. Re-generate the brief on a fresh base.",
      });
    }

    const commit = await this.exec("git", ["commit", "-m", input.pr_title], cwd);
    if (commit.code !== 0) {
      return err({
        code: "GH_CLI_FAILED",
        message: `git commit failed: ${commit.stderr.trim()}`,
        actionable_next_step: "Check git config user.name/email and that there are staged changes.",
      });
    }

    const push = await this.exec("git", ["push", "-u", "origin", branch], cwd);
    if (push.code !== 0) {
      return err({
        code: "GH_CLI_FAILED",
        message: `git push failed: ${push.stderr.trim()}`,
        actionable_next_step: "Verify remote credentials and that the branch is pushable.",
      });
    }

    const ghArgs = [
      "pr",
      "create",
      "--base",
      base,
      "--head",
      branch,
      "--title",
      input.pr_title,
      "--body",
      input.pr_body,
    ];
    for (const label of input.labels ?? ["aeo-fix"]) {
      ghArgs.push("--label", label);
    }
    const create = await this.exec("gh", ghArgs, cwd);
    if (create.code !== 0) {
      return err({
        code: "GH_CLI_FAILED",
        message: `gh pr create failed: ${create.stderr.trim()}`,
        actionable_next_step: "Run `gh auth status` and confirm the aeo-fix label exists on the repo.",
      });
    }

    const url = create.stdout.trim();
    const idMatch = url.match(/\/pull\/(\d+)/);
    return ok({
      pr_id: idMatch ? `pr:${idMatch[1]}` : `pr:${branch}`,
      pr_url: url,
      branch,
    });
  }
}

function defaultExec(
  cmd: string,
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("close", (code) => { resolve({ code: code ?? -1, stdout, stderr }); });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
