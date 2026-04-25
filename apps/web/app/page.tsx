import Link from "next/link";

export const dynamic = "force-static";

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <h2 className="h1">Closed-loop AEO/LLM-SEO citation engineering</h2>
      <p className="subtle">
        Audit your site, draft the fix as a PR, measure the lift after merge —
        powered by your Claude Code CLI subscription.
      </p>

      <div className="panel">
        <h3 className="h1" style={{ fontSize: 16 }}>Get started</h3>
        <ol>
          <li>
            Open a workspace in Cursor and run <code>/aeo:bootstrap</code> to create{" "}
            <code>.llm-seo-lab/config.yaml</code>.
          </li>
          <li>
            Start the daemon: <code>npm run start --workspace=@llm-seo-lab/cli-worker</code>.
          </li>
          <li>
            Visit <Link href="/sites">Sites</Link> to see audits, PRs, and citation trends.
          </li>
          <li>
            Verify the daemon is up at <Link href="/health">/health</Link>.
          </li>
        </ol>
      </div>
    </>
  );
}
