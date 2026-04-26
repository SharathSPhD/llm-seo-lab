/**
 * /use-cases/[id]/measurements/new — user-reported observation form.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 *
 * The user pastes one engine observation per submit (engine, prompt,
 * observed answer, citation flag, optional position + authority +
 * notes). The plugin never crawls AI engines — this form is the source
 * of truth.
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { isSupabaseMode } from "../../../../../lib/supabase/env.ts";
import { getCurrentUserAsync } from "../../../../../lib/auth.ts";
import { getUseCaseBundle } from "../../../../../lib/actions/use-cases.ts";
import { recordMeasurementAction } from "./actions.ts";

export const dynamic = "force-dynamic";

const ENGINES = [
  "ChatGPT",
  "Perplexity",
  "Google AIO",
  "Claude.ai",
  "Gemini",
  "You.com",
  "Other",
];

export default async function NewMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const sp = await searchParams;

  if (isSupabaseMode()) {
    const u = await getCurrentUserAsync();
    if (!u) redirect("/login");
  }

  let bundle;
  try {
    bundle = await getUseCaseBundle(id);
  } catch {
    notFound();
  }
  const uc = bundle.use_case;

  return (
    <>
      <p className="subtle">
        <Link href={`/use-cases/${encodeURIComponent(id)}`}>← Back to use case</Link>
      </p>
      <h2 className="h1">New measurement</h2>
      <p className="subtle">
        Citation observation for <strong>{uc.title}</strong> · iteration {uc.current_iteration}.
      </p>

      <div className="panel">
        <p className="subtle">
          Tip: ask the engine a real user question. Keep the prompt
          consistent across engines if you want comparable iterations.
          Three engines × five iterations is enough for a directional
          A/B-within-site signal.
        </p>
      </div>

      {sp.error && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not save:</strong> {sp.error}
        </div>
      )}

      <form action={recordMeasurementAction} className="panel">
        <input type="hidden" name="use_case_id" value={uc.id} />
        <input type="hidden" name="iteration" value={String(uc.current_iteration)} />

        <label>
          Engine
          <select name="engine" defaultValue="ChatGPT" required>
            {ENGINES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>

        <label>
          Prompt
          <textarea name="prompt" required rows={3} placeholder="What I asked the engine, verbatim." />
        </label>

        <label>
          Observed answer
          <textarea name="observed_answer" required rows={6} placeholder="Paste the engine's reply, including any citation lines." />
        </label>

        <label>
          <input type="checkbox" name="citation_present" value="1" />
          The page (or its content) was cited
        </label>

        <label>
          Citation position (1 = first cited source)
          <input type="number" name="citation_position" min={1} step={1} placeholder="e.g. 2" />
        </label>

        <label>
          Source authority (optional)
          <input type="text" name="source_authority" placeholder="own_site / wikipedia / reddit / other" />
        </label>

        <label>
          Notes (optional)
          <textarea name="notes" rows={2} placeholder="Free text. Tone, accuracy, follow-up prompts you tried." />
        </label>

        <label>
          Screenshot path (optional, local path)
          <input type="text" name="screenshot_path" placeholder="screenshots/u1-iter2-perplexity.png" />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary">Save measurement</button>
          <Link href={`/use-cases/${encodeURIComponent(uc.id)}`} className="btn">Cancel</Link>
        </div>
      </form>
    </>
  );
}
