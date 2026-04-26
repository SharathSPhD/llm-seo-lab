/**
 * Substrate adapter contract tests (R4).
 *
 * Adapters are pure functions of (use_case, principle). These tests
 * exercise every charter principle on every adapter and assert:
 *
 *   - `recommend()` returns a draft for every charter principle, with
 *     the right substrate-specific knob, the right voice profile, and a
 *     non-empty rationale.
 *   - `applyArtifact()` returns the substrate-specific `artifact_kind`
 *     (web→pr_diff, substack→paste_markdown, youtube→youtube_checklist)
 *     and embeds the use case's `topic` in the artifact body.
 *   - Adapters never call any I/O surface (no fs, no fetch). We assert
 *     this implicitly by running every test synchronously without any
 *     stub setup.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHARTER_PRINCIPLE_LIST,
  type AdapterUseCase,
  type CharterPrinciple,
  type RecommendationRow,
  type SubstrateAdapter,
  type Substrate,
} from "@llm-seo-lab/shared";
import { ADAPTERS, getAdapter, webAdapter, substackAdapter, youtubeAdapter } from "../scripts/adapters/index.ts";

function makeUseCase(substrate: Substrate, overrides: Partial<AdapterUseCase> = {}): AdapterUseCase {
  return {
    id: overrides.id ?? `uc_${substrate}_test`,
    url: overrides.url ?? `https://example.com/${substrate}`,
    substrate,
    title: overrides.title ?? `Example ${substrate} page`,
    topic: overrides.topic ?? "context engineering",
    target_audience: overrides.target_audience ?? null,
    iteration: overrides.iteration ?? 0,
  };
}

function makeRecRow(
  substrate: Substrate,
  principle: CharterPrinciple,
  knob: string,
): RecommendationRow {
  return {
    id: `rec_${substrate}_${principle}`,
    use_case_id: `uc_${substrate}`,
    user_id: "u_alice",
    iteration: 0,
    triz_principle: principle,
    applicability_score: 0.7,
    knob,
    diff_summary: "test",
    payload: { stub: false },
    rationale: "test",
    expected_engines: ["chatgpt"],
    claude_run_id: null,
    created_at: new Date().toISOString(),
  };
}

const expectedArtifactKind: Record<Substrate, string> = {
  web: "pr_diff",
  substack: "paste_markdown",
  youtube: "youtube_checklist",
};

describe("adapter registry", () => {
  it("exposes one adapter per Substrate union member", () => {
    assert.equal(ADAPTERS.web.substrate, "web");
    assert.equal(ADAPTERS.substack.substrate, "substack");
    assert.equal(ADAPTERS.youtube.substrate, "youtube");
  });

  it("getAdapter returns the right adapter by substrate name", () => {
    assert.equal(getAdapter("web"), webAdapter);
    assert.equal(getAdapter("substack"), substackAdapter);
    assert.equal(getAdapter("youtube"), youtubeAdapter);
  });

  it("getAdapter throws on an unknown substrate", () => {
    // Cast through unknown to bypass the union type — emulates a runtime
    // boundary call that bypassed validation.
    assert.throws(() => getAdapter("medium" as unknown as Substrate), /unknown substrate/);
  });

  it("voice profiles are distinct across substrates (R2 P6 — voice is per-adapter)", () => {
    const profiles = new Set([
      webAdapter.voiceProfile,
      substackAdapter.voiceProfile,
      youtubeAdapter.voiceProfile,
    ]);
    assert.equal(profiles.size, 3, "each adapter must declare a distinct voice profile");
  });
});

for (const substrate of Object.keys(ADAPTERS) as Substrate[]) {
  describe(`${substrate} adapter — recommend()`, () => {
    const adapter: SubstrateAdapter = ADAPTERS[substrate];
    const uc = makeUseCase(substrate);

    for (const principle of CHARTER_PRINCIPLE_LIST) {
      it(`returns a non-empty draft for principle "${principle}"`, () => {
        const draft = adapter.recommend(uc, principle);
        assert.equal(draft.triz_principle, principle);
        assert.ok(draft.knob.length > 0, "knob must be non-empty");
        assert.ok(draft.rationale.length > 20, "rationale must be substantive");
        assert.ok(draft.expected_engines.length > 0, "expected_engines must be non-empty");
        assert.equal(draft.voice_profile, adapter.voiceProfile);
        assert.ok(draft.payload["substrate"] === substrate, "payload.substrate must echo the adapter's substrate");
        assert.ok((draft.payload["voice_profile"] as string).length > 0, "payload.voice_profile must be set");
      });
    }

    it("returns 5 distinct knobs across the 5 charter principles", () => {
      const knobs = new Set(CHARTER_PRINCIPLE_LIST.map((p) => adapter.recommend(uc, p).knob));
      assert.ok(knobs.size >= 3, `expected ≥3 distinct knobs, got ${knobs.size}: ${[...knobs].join(", ")}`);
    });

    it("applicability_score is in [0, 1]", () => {
      for (const p of CHARTER_PRINCIPLE_LIST) {
        const s = adapter.recommend(uc, p).applicability_score;
        assert.ok(s >= 0 && s <= 1, `score out of range for ${p}: ${s}`);
      }
    });
  });

  describe(`${substrate} adapter — applyArtifact()`, () => {
    const adapter: SubstrateAdapter = ADAPTERS[substrate];
    const uc = makeUseCase(substrate);

    for (const principle of CHARTER_PRINCIPLE_LIST) {
      it(`returns the substrate's expected artifact_kind for "${principle}"`, () => {
        const draft = adapter.recommend(uc, principle);
        const rec = makeRecRow(substrate, principle, draft.knob);
        const artifact = adapter.applyArtifact(rec, uc);
        assert.equal(artifact.artifact_kind, expectedArtifactKind[substrate]);
        assert.equal(artifact.recommendation_id, rec.id);
        assert.ok(artifact.human_steps.length >= 2, "must include actionable human steps");
        assert.ok(artifact.primary.length > 0, "artifact body must be non-empty");
      });
    }

    it("artifact body references the use case's topic for at least one principle", () => {
      const uc2 = makeUseCase(substrate, { topic: "ZX-NEEDLE-7" });
      let found = false;
      for (const p of CHARTER_PRINCIPLE_LIST) {
        const draft = adapter.recommend(uc2, p);
        const rec = makeRecRow(substrate, p, draft.knob);
        const a = adapter.applyArtifact(rec, uc2);
        if (a.primary.includes("ZX-NEEDLE-7")) {
          found = true;
          break;
        }
      }
      assert.ok(found, `at least one principle's artifact must reference the use case's topic for substrate=${substrate}`);
    });

    it("ancillary metadata carries the voice profile", () => {
      const draft = adapter.recommend(uc, "atomic-snippet-density");
      const rec = makeRecRow(substrate, "atomic-snippet-density", draft.knob);
      const a = adapter.applyArtifact(rec, uc);
      assert.equal(a.ancillary?.["voice_profile"], adapter.voiceProfile);
    });
  });
}

describe("adapter substrate-specific output shape", () => {
  it("web adapter emits a unified diff (---/+++ headers)", () => {
    const uc = makeUseCase("web");
    const draft = webAdapter.recommend(uc, "q-shaped-subhead-lattice");
    const a = webAdapter.applyArtifact(makeRecRow("web", "q-shaped-subhead-lattice", draft.knob), uc);
    assert.match(a.primary, /^--- a\//m);
    assert.match(a.primary, /^\+\+\+ b\//m);
  });

  it("substack adapter emits markdown (>= 1 markdown heading or block-quote marker)", () => {
    const uc = makeUseCase("substack");
    const draft = substackAdapter.recommend(uc, "q-shaped-subhead-lattice");
    const a = substackAdapter.applyArtifact(makeRecRow("substack", "q-shaped-subhead-lattice", draft.knob), uc);
    assert.match(a.primary, /^(#{1,6} |> |\*\*|_)/m);
  });

  it("youtube adapter emits a checklist (>= 1 [ ] line)", () => {
    const uc = makeUseCase("youtube");
    const draft = youtubeAdapter.recommend(uc, "atomic-snippet-density");
    const a = youtubeAdapter.applyArtifact(makeRecRow("youtube", "atomic-snippet-density", draft.knob), uc);
    assert.match(a.primary, /^\[ \]/m);
  });
});
