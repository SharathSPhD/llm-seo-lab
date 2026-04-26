import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserAsync } from "../lib/auth.ts";
import { isSupabaseMode } from "../lib/supabase/env.ts";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.JSX.Element> {
  const supabaseMode = isSupabaseMode();
  const user = await getCurrentUserAsync();
  if (user) {
    redirect("/dashboard");
  }
  if (supabaseMode) {
    redirect("/login");
  }

  return (
    <>
      <h2 className="h1">Citation-pull engineering for AI search</h2>
      <p className="subtle">
        TRIZ + attractor-flow + Pratyakṣa, applied to any web page,
        Substack post, or YouTube video. Multi-stage, human-gated.
      </p>

      <div className="panel">
        <h3 className="h1" style={{ fontSize: 16 }}>v0.3.0 — Citation pull</h3>
        <ol>
          <li>
            <Link href="/login">Sign in</Link> (or run in local mode).
          </li>
          <li>
            <Link href="/dashboard">Open the dashboard</Link>.
          </li>
          <li>
            Add a use case (web URL, Substack post, or YouTube video).
          </li>
          <li>
            Walk it through <code>RECOMMENDED → APPLIED → REPUBLISHED → MEASURING → MEASURED → ANALYZED</code>{" "}
            with a button per stage. Claude Code CLI runs in the background
            via MCP.
          </li>
        </ol>
      </div>

      <div className="panel">
        <h3 className="h1" style={{ fontSize: 16 }}>v0.2.0 — Closed-loop AEO (still here)</h3>
        <p>
          The competitor-gap audit/PR/measure loop ships unchanged. See the{" "}
          <Link href="/sites">Sites</Link> tab.
        </p>
      </div>
    </>
  );
}
