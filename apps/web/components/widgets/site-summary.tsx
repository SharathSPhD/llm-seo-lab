import type { SiteAuditView } from "../../lib/actions/audits.ts";
import type { EvidenceTier } from "@llm-seo-lab/shared";

function tierClass(tier: EvidenceTier): string {
  if (tier === "tier1") return "badge tier1";
  if (tier === "tier2") return "badge warn";
  return "badge";
}

export interface SiteSummaryWidgetProps {
  audit: SiteAuditView;
}

export default function SiteSummaryWidget({
  audit,
}: SiteSummaryWidgetProps): React.JSX.Element {
  return (
    <div className="panel">
      <dl className="kv">
        <dt>Audit run</dt>
        <dd>
          <code>{audit.audit_run_id}</code>
        </dd>
        <dt>Pages audited</dt>
        <dd>{audit.pages_audited}</dd>
        <dt>Total gaps</dt>
        <dd>{audit.total_gaps}</dd>
        <dt>Predicted aggregate lift</dt>
        <dd>{audit.predicted_aggregate_lift_pp.toFixed(1)}pp</dd>
        <dt>Top tactics</dt>
        <dd>
          {audit.top_tactics.slice(0, 3).map((t) => (
            <div key={t.tactic}>
              <code>{t.tactic}</code> · {t.count}× · +{t.aggregate_lift_pp.toFixed(1)}pp
            </div>
          ))}
        </dd>
      </dl>

      {audit.recent_gaps.length > 0 && (
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Tactic</th>
              <th>Tier</th>
              <th>Lift</th>
              <th>Reference</th>
              <th>Page</th>
            </tr>
          </thead>
          <tbody>
            {audit.recent_gaps.slice(0, 8).map((g) => (
              <tr key={g.gap_id}>
                <td>
                  <code>{g.tactic}</code>
                </td>
                <td>
                  <span className={tierClass(g.evidence_tier)}>{g.evidence_tier}</span>
                </td>
                <td>+{g.predicted_lift_pp.toFixed(1)}pp</td>
                <td>{g.geo_paper_reference}</td>
                <td>{g.page_locator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
