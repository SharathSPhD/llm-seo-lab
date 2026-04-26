/**
 * Substack substrate adapter — for posts the user can edit and republish
 * but cannot diff at the URL level. Output is paste-ready Markdown plus
 * a structural diff-report (which subhead changes, which link blocks to
 * add) that the user pastes into the Substack editor.
 *
 * Voice profile: conversational-and-anecdotal (R2 P6) — first-person,
 * narrative, lower citation density than `web`.
 */

import type {
  AdapterUseCase,
  ArtifactPayload,
  CharterPrinciple,
  RecommendationDraft,
  RecommendationRow,
  SubstrateAdapter,
} from "@llm-seo-lab/shared";

const VOICE_PROFILE = "conversational-and-anecdotal";

const KNOBS: Record<CharterPrinciple, string> = {
  "atomic-snippet-density": "lede_rewrite",
  "semantic-anchor-stability": "subhead_restructure",
  "q-shaped-subhead-lattice": "subhead_restructure",
  "cross-engine-intermediary": "link_block_addition",
  "inverted-retrieval-target": "lede_rewrite",
};

const ENGINES: Record<CharterPrinciple, string[]> = {
  "atomic-snippet-density": ["chatgpt", "perplexity", "google_aio"],
  "semantic-anchor-stability": ["chatgpt", "perplexity"],
  "q-shaped-subhead-lattice": ["chatgpt", "google_aio", "claude_ai"],
  "cross-engine-intermediary": ["perplexity", "chatgpt", "gemini"],
  "inverted-retrieval-target": ["chatgpt", "perplexity", "google_aio"],
};

const RATIONALES: Record<CharterPrinciple, string> = {
  "atomic-snippet-density":
    "A bolded Q→A lede in the first paragraph gives engines a citation-shaped opening Substack will preserve through republish.",
  "semantic-anchor-stability":
    "Stable subhead wording across iterations lets engines re-cite the same section even after Substack regenerates the canonical URL.",
  "q-shaped-subhead-lattice":
    "Subheads phrased as the reader's question increase semantic match against engine-side prompts; preserves Substack's narrative voice.",
  "cross-engine-intermediary":
    "An inline link block to high-authority sources gives Perplexity-class engines a citation chain to reuse.",
  "inverted-retrieval-target":
    "Substack's preview card pulls the first paragraph; putting the citable answer there gives engines (and the share preview) the citable string up front.",
};

export function recommend(
  uc: AdapterUseCase,
  principle: CharterPrinciple,
): RecommendationDraft {
  const knob = KNOBS[principle];
  return {
    triz_principle: principle,
    applicability_score: 0.65,
    knob,
    diff_summary: `Apply ${principle} via ${knob} on the Substack post (voice=${VOICE_PROFILE}).`,
    payload: {
      stub: false,
      principle,
      knob,
      substrate: "substack" as const,
      voice_profile: VOICE_PROFILE,
      url: uc.url,
      iteration: uc.iteration,
    },
    rationale: RATIONALES[principle],
    expected_engines: ENGINES[principle],
    voice_profile: VOICE_PROFILE,
  };
}

function markdownFor(principle: CharterPrinciple, uc: AdapterUseCase): string {
  switch (principle) {
    case "atomic-snippet-density":
      return [
        `> **Q: What is ${uc.topic}?**`,
        `>`,
        `> A: <one-sentence atomic answer here, ≤200 chars>.`,
        ``,
        `_(I keep coming back to this question myself, so here's the shortest honest answer I can give.)_`,
      ].join("\n");
    case "semantic-anchor-stability":
      return [
        `## What is ${uc.topic}? (overview)`,
        ``,
        `_(Use this exact subhead next iteration too — engines re-cite the same wording.)_`,
      ].join("\n");
    case "q-shaped-subhead-lattice":
      return [
        `## What problem does ${uc.topic} actually solve?`,
        ``,
        `## Why doesn't the obvious answer work?`,
        ``,
        `## What does the right answer look like in practice?`,
      ].join("\n");
    case "cross-engine-intermediary":
      return [
        `**Background reading on ${uc.topic}:**`,
        ``,
        `- [Wikipedia: ${uc.topic}](https://en.wikipedia.org/wiki/${encodeURIComponent(uc.topic)})`,
        `- [Original paper / canonical reference](<paste-canonical-url>)`,
        ``,
        `_(Substack readers expect inline links — keep this as a short list, not a sidebar.)_`,
      ].join("\n");
    case "inverted-retrieval-target":
      return [
        `**${uc.topic} — the short answer:**`,
        ``,
        `<one-paragraph citable answer here, ≤200 chars including the period.>`,
        ``,
        `_(The rest of the post explains why; this paragraph is what engines and the share-preview will quote.)_`,
      ].join("\n");
  }
  return `<!-- ${principle} placeholder -->`;
}

export function applyArtifact(rec: RecommendationRow, uc: AdapterUseCase): ArtifactPayload {
  const principle = rec.triz_principle as CharterPrinciple;
  const md = markdownFor(principle, uc);
  return {
    recommendation_id: rec.id,
    artifact_kind: "paste_markdown",
    primary: md,
    ancillary: { knob: rec.knob, voice_profile: VOICE_PROFILE },
    human_steps: [
      "Open the Substack post in the editor.",
      `Locate the ${rec.knob} location (lede / subhead / inline block).`,
      "Paste the markdown; preserve your conversational voice — fill in the angle-bracket placeholders.",
      "Republish; click 'Mark applied' in the dashboard once Substack confirms the new revision is live.",
    ],
  };
}

export const substackAdapter: SubstrateAdapter = {
  substrate: "substack",
  voiceProfile: VOICE_PROFILE,
  recommend,
  applyArtifact,
};
