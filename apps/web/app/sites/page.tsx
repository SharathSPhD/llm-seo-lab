import Link from "next/link";
import { listSites } from "../../lib/actions/sites.ts";

export const dynamic = "force-dynamic";

export default async function SitesPage(): Promise<React.JSX.Element> {
  let sites: Awaited<ReturnType<typeof listSites>>["sites"] = [];
  let error: string | undefined;
  try {
    const r = await listSites();
    sites = r.sites;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h2 className="h1">Sites</h2>
      <p className="subtle">All sites with a configured <code>.llm-seo-lab/config.yaml</code>.</p>

      {error ? (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>MCP unavailable:</strong> {error}
        </div>
      ) : sites.length === 0 ? (
        <div className="panel">
          <p>
            No sites yet. Run <code>/aeo:bootstrap</code> in your Cursor workspace to register
            this repo.
          </p>
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>URL</th>
                <th>Tier</th>
                <th>Substrate</th>
                <th>Engines</th>
                <th>Topics</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.site_id}>
                  <td>
                    <Link href={`/sites/${encodeURIComponent(s.site_id)}`}>{s.site_id}</Link>
                  </td>
                  <td>
                    <a href={s.site_url} target="_blank" rel="noreferrer">
                      {s.site_url}
                    </a>
                  </td>
                  <td>
                    <span className="badge">{s.tier}</span>
                  </td>
                  <td>
                    <span className="badge">{s.action_substrate}</span>
                  </td>
                  <td>{s.engines_count}</td>
                  <td>{s.topics_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
