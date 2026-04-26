"use server";

/**
 * Server action for the user-reported measurement form.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordMeasurement } from "../../../../../lib/actions/use-cases.ts";
import { getCurrentUserAsync } from "../../../../../lib/auth.ts";

function backWith(use_case_id: string, error: string): never {
  const q = new URLSearchParams({ error });
  redirect(`/use-cases/${encodeURIComponent(use_case_id)}/measurements/new?${q.toString()}`);
}

export async function recordMeasurementAction(formData: FormData): Promise<void> {
  const use_case_id = String(formData.get("use_case_id") ?? "").trim();
  if (!use_case_id) redirect("/dashboard");

  const user = await getCurrentUserAsync();
  if (!user) redirect("/login");

  const iter_raw = String(formData.get("iteration") ?? "0");
  const iteration = Number.isFinite(Number(iter_raw)) ? Number(iter_raw) : 0;
  const engine = String(formData.get("engine") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const observed_answer = String(formData.get("observed_answer") ?? "").trim();
  const citation_present = formData.get("citation_present") === "1";
  const pos_raw = String(formData.get("citation_position") ?? "").trim();
  const citation_position = pos_raw ? Number(pos_raw) : null;
  const source_authority = String(formData.get("source_authority") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const screenshot_path = String(formData.get("screenshot_path") ?? "").trim() || null;

  if (!engine) backWith(use_case_id, "engine_required");
  if (!prompt) backWith(use_case_id, "prompt_required");
  if (!observed_answer) backWith(use_case_id, "answer_required");
  if (citation_position !== null && !Number.isFinite(citation_position)) {
    backWith(use_case_id, "citation_position_invalid");
  }

  try {
    await recordMeasurement({
      use_case_id,
      user_id: user.id,
      iteration,
      engine,
      prompt,
      observed_answer,
      citation_present,
      citation_position,
      source_authority,
      notes,
      screenshot_path,
    });
  } catch (e) {
    backWith(use_case_id, (e as Error).message);
  }

  revalidatePath(`/use-cases/${use_case_id}`);
  redirect(`/use-cases/${encodeURIComponent(use_case_id)}?ok=measurement_recorded`);
}
