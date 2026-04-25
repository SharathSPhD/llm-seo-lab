import { getResultsForPr } from "../../../../../lib/actions/citations.ts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; pr: string }>;
}

export default async function ResultsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { slug, pr } = await params;
  const site_id = decodeURIComponent(slug);
  const pr_number = Number(pr);

  if (!Number.isFinite(pr_number)) {
    return (
      <>
        <h2 className="h1">Invalid PR id</h2>
        <p className="subtle">
          PR id must be numeric. Got <code>{pr}</code>.
        </p>
      </>
    );
  }

  let error: string | undefined;
  let deltas: Awaited<ReturnType<typeof getResultsForPr>>["deltas"] = [];
  try {
    const r = await getResultsForPr(site_id, pr_number);
    deltas = r.deltas;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h2 className="h1">
        {site_id} · PR #{pr_number} results
      </h2>
      <p className="subtle">
        Two-proportion z-test against the pre-merge baseline; Bonferroni-adjusted across engines;
        bootstrap 95% CI for Δ citation share.
      </p>

      {error ? (
        <div className="panel" style={{ borderColor: "var(--warn)" }}>
          <strong>No results yet:</strong> {error}
          <p className="subtle" style={{ marginTop: 6 }}>
            Results are computed after the post-merge measurement window
            (default 14 days) by the daemon.
          </p>
        </div>
      ) : deltas.length === 0 ? (
        <div className="panel">
          <p className="subtle">No engines reported deltas for this PR.</p>
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Engine</th>
                <th>Topic</th>
                <th>Pre</th>
                <th>Post</th>
                <th>Δ pp</th>
                <th>z</th>
                <th>p</th>
                <th>p (Bonferroni)</th>
                <th>95% CI</th>
                <th>Cohen h</th>
                <th>Significant</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => (
                <tr key={`${d.engine}-${d.topic}`}>
                  <td>
                    <code>{d.engine}</code>
                  </td>
                  <td>{d.topic}</td>
                  <td>{(d.pre_share * 100).toFixed(1)}%</td>
                  <td>{(d.post_share * 100).toFixed(1)}%</td>
                  <td>{d.delta_pp.toFixed(2)}</td>
                  <td>{d.z_statistic.toFixed(3)}</td>
                  <td>{d.p_value.toFixed(4)}</td>
                  <td>{d.bonferroni_p_value.toFixed(4)}</td>
                  <td>
                    [{d.bootstrap_ci_lower.toFixed(2)}, {d.bootstrap_ci_upper.toFixed(2)}]
                  </td>
                  <td>{d.cohen_h.toFixed(3)}</td>
                  <td>
                    <span className={d.significant ? "badge good" : "badge"}>
                      {d.significant ? "yes" : "no"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
