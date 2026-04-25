export type PrState = "open" | "merged" | "closed_unmerged";

export interface PrSummary {
  pr_number: number;
  pr_url: string;
  branch: string;
  state: PrState;
  brief_id: string;
  opened_at: string;
  merged_at?: string;
  closed_at?: string;
  age_days: number;
  labels: string[];
}
