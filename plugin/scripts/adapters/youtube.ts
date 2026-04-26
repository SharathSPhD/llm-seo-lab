/**
 * YouTube substrate adapter — for videos where the user controls
 * title / description / tags / chapters / pinned comment / end-card text.
 * Output is a copy-paste checklist mapped to YouTube Studio fields. The
 * adapter never auto-publishes; YouTube's editorial surfaces are
 * mutually exclusive with diff-based application.
 *
 * Voice profile: scripted-and-timestamped (R2 P6) — terse imperative
 * with timestamp anchors, optimised for chapter retrieval and the
 * description's first 200 chars.
 */

import type {
  AdapterUseCase,
  ArtifactPayload,
  CharterPrinciple,
  RecommendationDraft,
  RecommendationRow,
  SubstrateAdapter,
} from "@llm-seo-lab/shared";

const VOICE_PROFILE = "scripted-and-timestamped";

const KNOBS: Record<CharterPrinciple, string> = {
  "atomic-snippet-density": "pinned_comment",
  "semantic-anchor-stability": "chapters",
  "q-shaped-subhead-lattice": "title_rewrite",
  "cross-engine-intermediary": "description_structure",
  "inverted-retrieval-target": "description_structure",
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
    "A pinned comment with a structured Q→A block is treated as a citable atomic snippet by ChatGPT/Perplexity transcript ingestion.",
  "semantic-anchor-stability":
    "Chapter labels are the only stable anchors YouTube exposes to engines; stable wording across iterations keeps citations re-resolvable.",
  "q-shaped-subhead-lattice":
    "Engines will quote the title verbatim when answering; phrasing it as the user's question raises retrieval probability.",
  "cross-engine-intermediary":
    "The description's link block is YouTube's only outbound-citation surface; an authority-link block gives Perplexity a citation chain.",
  "inverted-retrieval-target":
    "Putting the citable answer in the first 200 chars of the description inverts the page so engines extract it before the metadata trail.",
};

export function recommend(
  uc: AdapterUseCase,
  principle: CharterPrinciple,
): RecommendationDraft {
  const knob = KNOBS[principle];
  return {
    triz_principle: principle,
    applicability_score: 0.6,
    knob,
    diff_summary: `Apply ${principle} via ${knob} on the YouTube video (voice=${VOICE_PROFILE}).`,
    payload: {
      stub: false,
      principle,
      knob,
      substrate: "youtube" as const,
      voice_profile: VOICE_PROFILE,
      url: uc.url,
      iteration: uc.iteration,
    },
    rationale: RATIONALES[principle],
    expected_engines: ENGINES[principle],
    voice_profile: VOICE_PROFILE,
  };
}

function checklistFor(principle: CharterPrinciple, uc: AdapterUseCase): string {
  switch (principle) {
    case "atomic-snippet-density":
      return [
        `[ ] Open YouTube Studio → Video → Comments`,
        `[ ] Pin a top comment with this exact structure:`,
        ``,
        `    Q: What is ${uc.topic}?`,
        `    A: <one-sentence atomic answer ≤200 chars>`,
        `    Source: <link to canonical reference>`,
        ``,
        `[ ] Mark this comment as the channel's reply (improves engine ingestion).`,
      ].join("\n");
    case "semantic-anchor-stability":
      return [
        `[ ] YouTube Studio → Video → Description → Chapters`,
        `[ ] Use these exact chapter labels (do NOT change wording across iterations):`,
        ``,
        `    00:00  What is ${uc.topic}?`,
        `    00:30  Why does ${uc.topic} matter?`,
        `    02:00  How ${uc.topic} works in practice`,
        `    05:00  Common pitfalls`,
        `    07:00  Takeaway`,
      ].join("\n");
    case "q-shaped-subhead-lattice":
      return [
        `[ ] Rewrite the video title to a Q-shape that includes the central question.`,
        `[ ] Suggested: "What is ${uc.topic}? — <≤45 chars hook>"`,
        `[ ] Keep the title ≤60 chars total (engines truncate at 60).`,
      ].join("\n");
    case "cross-engine-intermediary":
      return [
        `[ ] Description first 800 chars: structured outbound link block.`,
        ``,
        `    Background reading on ${uc.topic}:`,
        `    • Wikipedia: https://en.wikipedia.org/wiki/${encodeURIComponent(uc.topic)}`,
        `    • Canonical reference: <paste-url>`,
        `    • Related discussion: <paste-reddit-or-hn-url>`,
        ``,
        `[ ] Pin this section above the chapter timestamps.`,
      ].join("\n");
    case "inverted-retrieval-target":
      return [
        `[ ] First 200 chars of the description must be the citable answer.`,
        `[ ] Suggested:`,
        ``,
        `    ${uc.topic}: <one-paragraph citable answer ≤200 chars including the period.>`,
        ``,
        `[ ] Everything else (chapters, links, hashtags) goes BELOW the first paragraph.`,
      ].join("\n");
  }
  return `[ ] (unknown principle: ${principle})`;
}

export function applyArtifact(rec: RecommendationRow, uc: AdapterUseCase): ArtifactPayload {
  const principle = rec.triz_principle as CharterPrinciple;
  const checklist = checklistFor(principle, uc);
  return {
    recommendation_id: rec.id,
    artifact_kind: "youtube_checklist",
    primary: checklist,
    ancillary: { knob: rec.knob, voice_profile: VOICE_PROFILE },
    human_steps: [
      "Open YouTube Studio for the video.",
      "Apply each line of the checklist to the matching field (Title / Description / Chapters / Pinned comment).",
      "Click Save in YouTube Studio.",
      "Click 'Mark applied' in the dashboard once Studio confirms the change is live.",
    ],
  };
}

export const youtubeAdapter: SubstrateAdapter = {
  substrate: "youtube",
  voiceProfile: VOICE_PROFILE,
  recommend,
  applyArtifact,
};
