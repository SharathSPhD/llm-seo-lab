import Link from "next/link";
import { readSiteConfig } from "../../../lib/actions/sites.ts";
import { getLatestAudit } from "../../../lib/actions/audits.ts";
import SiteSummaryWidget from "../../../components/widgets/site-summary.tsx";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SiteDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const site_id = decodeURIComponent(slug);

  let cfgErr: string | undefined;
  let auditErr: string | undefined;
  const [cfg, audit] = await Promise.all([
    readSiteConfig(site_id).catch((e) => {
      cfgErr = (e as Error).message;
      return null;
    }),
    getLatestAudit(site_id).catch((e) => {
      auditErr = (e as Error).message;
      return null;
    }),
  ]);

  return (
    <>
      <h2 className="h1">{site_id}</h2>
      {cfg && (
        <p className="subtle">
          <a href={cfg.site_url} target="_blank" rel="noreferrer">
            {cfg.site_url}
          </a>{" "}
          · <span className="badge">{cfg.tier}</span>{" "}
          <span className="badge">{cfg.action_substrate}</span>
        </p>
      )}

      <div style={{ display: "flex", gap: 12, margin: "12px 0" }}>
        <Link className="badge" href={`/sites/${encodeURIComponent(site_id)}/prs`}>
          PR queue
        </Link>
        <Link className="badge" href={`/sites/${encodeURIComponent(site_id)}/citations`}>
          Citations
        </Link>
      </div>

      {cfgErr && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not load config:</strong> {cfgErr}
        </div>
      )}
      {auditErr ? (
        <div className="panel" style={{ borderColor: "var(--warn)" }}>
          <strong>No audit yet:</strong> {auditErr}
          <p className="subtle" style={{ marginTop: 8 }}>
            Run <code>/aeo:audit</code> in your Cursor workspace to populate this view.
          </p>
        </div>
      ) : (
        audit && <SiteSummaryWidget audit={audit} />
      )}
    </>
  );
}
