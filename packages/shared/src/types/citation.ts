export type Engine =
  | "claude_ai"
  | "perplexity"
  | "chatgpt"
  | "gemini"
  | "google_aio";

export type SamplingPath = "claude_cli" | "playwright" | "screenshot";

export interface CitationFlag {
  engine: Engine;
  question: string;
  cited: boolean;
  cited_url?: string;
  cited_snippet?: string;
  sampled_at: string;
  sampling_path: SamplingPath;
}

export interface CitationShareSnapshot {
  topic: string;
  window_start: string;
  window_end: string;
  per_engine: Partial<Record<Engine, { share: number; n_questions: number; n_citations: number }>>;
  samples: CitationFlag[];
}

export interface StatisticalDelta {
  pr_number: number;
  engine: Engine;
  topic: string;
  pre_share: number;
  post_share: number;
  delta_pp: number;
  z_statistic: number;
  p_value: number;
  bonferroni_p_value: number;
  bootstrap_ci_lower: number;
  bootstrap_ci_upper: number;
  cohen_h: number;
  significant: boolean;
}
