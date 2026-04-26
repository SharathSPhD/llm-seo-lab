"use server";

/**
 * Stage-panel server actions.
 *
 * Spec: docs/v0.3.0/spec.md §6, §8.
 *
 * Each action is bound to one button on the use-case stage panel. They
 * all share the same hidden inputs (`use_case_id`, `from_stage`,
 * `iteration`) so the form layer is uniform; the action knows which
 * target stage it implements.
 *
 * Recommendations / analyses are produced via MCP (Claude CLI runs);
 * pure stage transitions go straight through `transitionStage` (which
 * still goes through MCP `record_use_case_event` so RLS + validation
 * happens server-side in a single place).
 *
 * Errors are surfaced back to the user via `?error=...` on the page URL,
 * successes via `?ok=...`. We do NOT throw in the form-action handler —
 * Next.js would render a generic 500 page, which is worse UX than a
 * focused error banner.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  applyRecommendation,
  generateRecommendations,
  runAnalysis,
  transitionStage,
} from "../../../lib/actions/use-cases.ts";
import { getCurrentUserAsync } from "../../../lib/auth.ts";
import type { Stage } from "@llm-seo-lab/shared";

interface BaseInputs {
  use_case_id: string;
  from_stage: Stage;
  iteration: number;
  user_id: string;
}

async function readBase(formData: FormData): Promise<BaseInputs | { error: string; redirect_to: string }> {
  const use_case_id = String(formData.get("use_case_id") ?? "").trim();
  const from_stage = String(formData.get("from_stage") ?? "").trim() as Stage;
  const iter_raw = String(formData.get("iteration") ?? "0");
  const iteration = Number.isFinite(Number(iter_raw)) ? Number(iter_raw) : 0;
  if (!use_case_id) {
    return { error: "missing_use_case_id", redirect_to: "/dashboard" };
  }
  const user = await getCurrentUserAsync();
  if (!user) {
    return { error: "not_signed_in", redirect_to: "/login" };
  }
  return { use_case_id, from_stage, iteration, user_id: user.id };
}

function detailUrl(id: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/use-cases/${encodeURIComponent(id)}?${q.toString()}`;
}

async function refresh(use_case_id: string): Promise<void> {
  revalidatePath(`/use-cases/${use_case_id}`);
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// DRAFT -> RECOMMENDED  (also called via "Recommend" again from RECOMMENDED)
// ---------------------------------------------------------------------------

export async function recommendAction(formData: FormData): Promise<void> {
  const base = await readBase(formData);
  if ("error" in base) redirect(base.redirect_to);
  try {
    await generateRecommendations(
      {
        use_case_id: base.use_case_id,
        user_id: base.user_id,
        iteration: base.iteration,
      },
      base.from_stage,
    );
  } catch (e) {
    redirect(detailUrl(base.use_case_id, { error: (e as Error).message }));
  }
  await refresh(base.use_case_id);
  redirect(detailUrl(base.use_case_id, { ok: "recommendations_generated" }));
}

// ANALYZED -> RECOMMENDED  (next iteration)
export async function nextIterationAction(formData: FormData): Promise<void> {
  const base = await readBase(formData);
  if ("error" in base) redirect(base.redirect_to);
  try {
    // Bump the iteration counter when we move on from ANALYZED.
    const nextIter = base.iteration + 1;
    await generateRecommendations(
      {
        use_case_id: base.use_case_id,
        user_id: base.user_id,
        iteration: nextIter,
      },
      base.from_stage,
    );
  } catch (e) {
    redirect(detailUrl(base.use_case_id, { error: (e as Error).message }));
  }
  await refresh(base.use_case_id);
  redirect(detailUrl(base.use_case_id, { ok: "next_iteration_started" }));
}

// ---------------------------------------------------------------------------
// RECOMMENDED -> APPLIED
// ---------------------------------------------------------------------------

export async function applyRecommendationAction(formData: FormData): Promise<void> {
  const base = await readBase(formData);
  if ("error" in base) redirect(base.redirect_to);
  const recommendation_id = String(formData.get("recommendation_id") ?? "").trim();
  if (!recommendation_id) {
    redirect(detailUrl(base.use_case_id, { error: "missing_recommendation_id" }));
  }
  try {
    await applyRecommendation(
      {
        use_case_id: base.use_case_id,
        user_id: base.user_id,
        recommendation_id,
        iteration: base.iteration,
      },
      base.from_stage,
    );
  } catch (e) {
    redirect(detailUrl(base.use_case_id, { error: (e as Error).message }));
  }
  await refresh(base.use_case_id);
  redirect(detailUrl(base.use_case_id, { ok: "artifact_applied" }));
}

// ---------------------------------------------------------------------------
// Pure stage transitions
// ---------------------------------------------------------------------------

async function pureTransition(
  formData: FormData,
  to: Stage,
  okMsg: string,
): Promise<void> {
  const base = await readBase(formData);
  if ("error" in base) redirect(base.redirect_to);
  try {
    await transitionStage({
      use_case_id: base.use_case_id,
      user_id: base.user_id,
      from_stage: base.from_stage,
      to_stage: to,
      iteration: base.iteration,
    });
  } catch (e) {
    redirect(detailUrl(base.use_case_id, { error: (e as Error).message }));
  }
  await refresh(base.use_case_id);
  redirect(detailUrl(base.use_case_id, { ok: okMsg }));
}

export async function markRepublishedAction(formData: FormData): Promise<void> {
  await pureTransition(formData, "REPUBLISHED", "marked_republished");
}

export async function startMeasuringAction(formData: FormData): Promise<void> {
  await pureTransition(formData, "MEASURING", "measuring_started");
}

export async function markMeasuredAction(formData: FormData): Promise<void> {
  await pureTransition(formData, "MEASURED", "marked_measured");
}

export async function abandonAction(formData: FormData): Promise<void> {
  await pureTransition(formData, "ABANDONED", "abandoned");
}

// ---------------------------------------------------------------------------
// MEASURED -> ANALYZED
// ---------------------------------------------------------------------------

export async function analyzeAction(formData: FormData): Promise<void> {
  const base = await readBase(formData);
  if ("error" in base) redirect(base.redirect_to);
  try {
    await runAnalysis(
      {
        use_case_id: base.use_case_id,
        user_id: base.user_id,
        iteration: base.iteration,
      },
      base.from_stage,
    );
  } catch (e) {
    redirect(detailUrl(base.use_case_id, { error: (e as Error).message }));
  }
  await refresh(base.use_case_id);
  redirect(detailUrl(base.use_case_id, { ok: "analysis_complete" }));
}
