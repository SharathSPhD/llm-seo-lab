/**
 * /use-cases/new — create-use-case wizard.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 *
 * Single-screen form with substrate auto-detect + manual override. Server
 * action `createUseCaseAction` validates, inserts via Supabase RLS, and
 * redirects to the freshly-created use case's stage panel.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseMode } from "../../../lib/supabase/env.ts";
import { getCurrentUserAsync } from "../../../lib/auth.ts";
import { createUseCaseAction } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function NewUseCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; url?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const supabaseMode = isSupabaseMode();
  if (supabaseMode) {
    const user = await getCurrentUserAsync();
    if (!user) redirect("/login");
  }

  return (
    <>
      <h2 className="h1">New use case</h2>
      <p className="subtle">
        Pin a single page (web URL, Substack post, or YouTube video) and start
        the citation-pull loop.
      </p>

      {params.error && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not create:</strong> {params.error}
        </div>
      )}

      <form action={createUseCaseAction} className="panel">
        <label>
          URL
          <input
            name="url"
            type="url"
            required
            defaultValue={params.url ?? ""}
            placeholder="https://www.technektar.dev"
          />
          <span className="subtle">
            Substack and YouTube URLs are auto-detected; everything else
            defaults to <code>web</code>.
          </span>
        </label>

        <label>
          Substrate (override)
          <select name="substrate" defaultValue="auto">
            <option value="auto">Auto-detect from URL</option>
            <option value="web">web</option>
            <option value="substack">substack</option>
            <option value="youtube">youtube</option>
          </select>
        </label>

        <label>
          Title
          <input
            name="title"
            type="text"
            required
            placeholder="technektar.dev landing page"
          />
        </label>

        <label>
          Topic
          <input
            name="topic"
            type="text"
            required
            placeholder="AI engineer portfolio: context engineering"
          />
          <span className="subtle">
            Two-to-six words. Drives the cross-engine intermediary anchor.
          </span>
        </label>

        <label>
          Target audience (optional)
          <input
            name="target_audience"
            type="text"
            placeholder="Hiring managers and senior AI engineers"
          />
        </label>

        <label>
          Notes (optional)
          <textarea
            name="notes"
            rows={3}
            placeholder="Anything the recommender should know — competing pages, prior tactics tried, etc."
          />
        </label>

        <div className="row" style={{ display: "flex", gap: "1rem" }}>
          <button type="submit" className="btn primary">
            Create
          </button>
          <Link href="/dashboard" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
