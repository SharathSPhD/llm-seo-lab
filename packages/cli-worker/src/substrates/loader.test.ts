import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ok } from "@llm-seo-lab/shared";
import { SubstrateRegistry } from "./loader.ts";
import type { Substrate } from "./types.ts";

describe("SubstrateRegistry", () => {
  it("loads a registered substrate by name", () => {
    const reg = new SubstrateRegistry();
    const factory = (cfg: Record<string, unknown>): Substrate => ({
      name: "git",
      async publish() {
        return ok({ pr_id: "pr:1", pr_url: "https://example/1", branch: String(cfg["branch"] ?? "x") });
      },
    });
    reg.register("git", factory);
    assert.equal(reg.has("git"), true);
    const s = reg.load("git", { branch: "feature/x" });
    assert.equal(s.name, "git");
  });

  it("throws on unknown substrate with a helpful message", () => {
    const reg = new SubstrateRegistry();
    assert.throws(
      () => reg.load("substack", {}),
      /unknown substrate: substack/,
    );
  });

  it("registered() lists all factories", () => {
    const reg = new SubstrateRegistry();
    const noop: Substrate = {
      name: "git",
      async publish() {
        return ok({ pr_id: "x", pr_url: "x", branch: "x" });
      },
    };
    reg.register("git", () => noop);
    assert.deepEqual(reg.registered(), ["git"]);
  });
});
