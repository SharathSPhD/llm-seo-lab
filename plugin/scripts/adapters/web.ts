/**
 * Web substrate adapter — for pages owned at the URL level (e.g.
 * www.technektar.dev). Output is a unified diff that is human-applied
 * via `gh pr checkout` + `git apply`, then a regular PR. The adapter
 * never auto-publishes; it surfaces a paste-or-apply diff and a checklist.
 *
 * Voice profile: clinical-and-cited (R2 P6) — short paragraphs, citation
 * blocks before claims, never speculative.
 */

import type {
  AdapterUseCase,
  ArtifactPayload,
  CharterPrinciple,
  RecommendationDraft,
  RecommendationRow,
  SubstrateAdapter,
} from "@llm-seo-lab/shared";

const VOICE_PROFILE = "clinical-and-cited";

const KNOBS: Record<CharterPrinciple, string> = {
  "atomic-snippet-density": "json_ld_faqpage",
  "semantic-anchor-stability": "h2_h3_canonical_anchors",
  "q-shaped-subhead-lattice": "h2_subhead_questions",
  "cross-engine-intermediary": "outbound_authority_link_block",
  "inverted-retrieval-target": "answer_first_lede",
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
    "FAQPage JSON-LD gives engines a citation-shaped target with explicit Question/Answer pairs and source attribution.",
  "semantic-anchor-stability":
    "Stable canonical heading anchors let engines re-cite the same fragment across iterations without re-resolving.",
  "q-shaped-subhead-lattice":
    "Subheads phrased as the visitor's question raise semantic similarity against engine-side prompt embeddings.",
  "cross-engine-intermediary":
    "An outbound authority link block gives Perplexity-class engines a citation chain they will reuse on subsequent answers.",
  "inverted-retrieval-target":
    "Putting the citable answer in the first 200 chars inverts the page so retrievers extract it before the supporting prose.",
};

export function recommend(
  uc: AdapterUseCase,
  principle: CharterPrinciple,
): RecommendationDraft {
  const knob = KNOBS[principle];
  return {
    triz_principle: principle,
    applicability_score: 0.7,
    knob,
    diff_summary: `Apply ${principle} via ${knob} on ${uc.url} (web substrate, voice=${VOICE_PROFILE}).`,
    payload: {
      stub: false,
      principle,
      knob,
      substrate: "web" as const,
      voice_profile: VOICE_PROFILE,
      url: uc.url,
      iteration: uc.iteration,
    },
    rationale: RATIONALES[principle],
    expected_engines: ENGINES[principle],
    voice_profile: VOICE_PROFILE,
  };
}

/**
 * Build a per-principle unified diff. Real-world use will wire this to
 * the page's actual HTML/MDX source via Claude in R5; for R4 the diff is
 * a deterministic, principle-keyed stub that a human can review and
 * inflate with the actual page source.
 */
function diffFor(principle: CharterPrinciple, uc: AdapterUseCase, knob: string): string {
  const path = "page.html";
  switch (principle) {
    case "atomic-snippet-density":
      return [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@`,
        `+<script type="application/ld+json">`,
        `+{`,
        `+  "@context": "https://schema.org",`,
        `+  "@type": "FAQPage",`,
        `+  "mainEntity": [`,
        `+    { "@type": "Question", "name": "What is ${uc.topic}?", "acceptedAnswer": { "@type": "Answer", "text": "<short atomic answer here>" } }`,
        `+  ]`,
        `+}`,
        `+</script>`,
        ``,
      ].join("\n");
    case "semantic-anchor-stability":
      return [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@`,
        `-<h2>Section</h2>`,
        `+<h2 id="${slug(uc.topic)}-overview">Section</h2>`,
        ``,
      ].join("\n");
    case "q-shaped-subhead-lattice":
      return [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@`,
        `-<h2>Why this matters</h2>`,
        `+<h2>What is ${uc.topic} and why does it matter?</h2>`,
        ``,
      ].join("\n");
    case "cross-engine-intermediary":
      return [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@`,
        `+<aside class="authority-block">`,
        `+  <p>For background, see established sources on ${uc.topic}:</p>`,
        `+  <ul><li><a href="https://en.wikipedia.org/wiki/${slug(uc.topic)}">Wikipedia: ${uc.topic}</a></li></ul>`,
        `+</aside>`,
        ``,
      ].join("\n");
    case "inverted-retrieval-target":
      return [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@`,
        `+<p class="lede"><strong>${uc.topic}:</strong> <answer in &lt;200 chars&gt;</p>`,
        ``,
      ].join("\n");
  }
  // Exhaustiveness fallback (TS will narrow above; this keeps runtime safe).
  return `--- a/${path}\n+++ b/${path}\n@@\n+<!-- ${principle} via ${knob} -->\n`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function applyArtifact(rec: RecommendationRow, uc: AdapterUseCase): ArtifactPayload {
  const principle = rec.triz_principle as CharterPrinciple;
  const diff = diffFor(principle, uc, rec.knob);
  return {
    recommendation_id: rec.id,
    artifact_kind: "pr_diff",
    primary: diff,
    ancillary: { knob: rec.knob, voice_profile: VOICE_PROFILE },
    human_steps: [
      "Open the repo backing the page in your editor.",
      "Apply the diff (`git apply -p0 < /tmp/diff.patch` or paste into your editor).",
      "Inflate the placeholder text with real, citable content.",
      "Push the branch, open a PR, and click 'Mark applied' in the dashboard.",
    ],
  };
}

export const webAdapter: SubstrateAdapter = {
  substrate: "web",
  voiceProfile: VOICE_PROFILE,
  recommend,
  applyArtifact,
};
