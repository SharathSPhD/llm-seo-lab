"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrSummary, PrState } from "@llm-seo-lab/shared";
import type { PrQueueView } from "../../lib/actions/prs.ts";

function badgeClass(state: PrState): string {
  switch (state) {
    case "open":
      return "badge warn";
    case "merged":
      return "badge good";
    case "closed_unmerged":
      return "badge bad";
    default: {
      const _exhaustive: never = state;
      void _exhaustive;
      return "badge";
    }
  }
}

export interface PrQueueWidgetProps {
  initial: PrQueueView;
  ws_url?: string;
}

interface DaemonEventLike {
  type: string;
  job?: { site_id: string; result?: { pr_id?: string; pr_url?: string }; status?: string };
}

export default function PrQueueWidget({ initial, ws_url }: PrQueueWidgetProps): React.JSX.Element {
  const [view, setView] = useState<PrQueueView>(initial);
  const [liveEvents, setLiveEvents] = useState<number>(0);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("closed");

  const url = ws_url ?? process.env["NEXT_PUBLIC_LLM_SEO_LAB_WS_URL"] ?? "ws://localhost:7372";

  useEffect(() => {
    if (!url || typeof WebSocket === "undefined") return;
    let stopped = false;
    setWsState("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => {
      if (!stopped) setWsState("open");
    };
    ws.onclose = () => {
      if (!stopped) setWsState("closed");
    };
    ws.onerror = () => {
      if (!stopped) setWsState("closed");
    };
    ws.onmessage = (msg) => {
      try {
        const evt = JSON.parse(String(msg.data)) as DaemonEventLike;
        setLiveEvents((n) => n + 1);
        if (evt.type === "job.succeeded" && evt.job?.result?.pr_id && evt.job?.result?.pr_url) {
          const newPr: PrSummary = {
            pr_number: Number(String(evt.job.result.pr_id).replace(/^pr:/, "")) || 0,
            pr_url: evt.job.result.pr_url,
            branch: "",
            state: "open",
            brief_id: "live",
            opened_at: new Date().toISOString(),
            age_days: 0,
            labels: ["aeo-fix"],
          };
          setView((prev) => ({ ...prev, open: [newPr, ...prev.open] }));
        }
      } catch {
        /* ignore non-JSON frames */
      }
    };
    return () => {
      stopped = true;
      try { ws.close(); } catch { /* socket already closing */ }
    };
  }, [url]);

  const all = useMemo(
    () => [
      { label: "Open", prs: view.open, state: "open" as PrState },
      { label: "Merged", prs: view.merged, state: "merged" as PrState },
      { label: "Closed unmerged", prs: view.closed_unmerged, state: "closed_unmerged" as PrState },
    ],
    [view],
  );

  return (
    <div>
      <p className="subtle">
        Live updates: <span className={wsState === "open" ? "badge good" : "badge"}>{wsState}</span>{" "}
        · received <code>{liveEvents}</code> events
      </p>
      {all.map(({ label, prs, state }) => (
        <div className="panel" key={label}>
          <h3 className="h1" style={{ fontSize: 14 }}>
            {label} <span className={badgeClass(state)}>{prs.length}</span>
          </h3>
          {prs.length === 0 ? (
            <p className="subtle">No {label.toLowerCase()} PRs.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Branch</th>
                  <th>Brief</th>
                  <th>Opened</th>
                  <th>Age</th>
                  <th>Labels</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((p) => (
                  <tr key={`${p.pr_number}-${p.opened_at}`}>
                    <td>
                      <a href={p.pr_url} target="_blank" rel="noreferrer">
                        #{p.pr_number}
                      </a>
                    </td>
                    <td>
                      <code>{p.branch}</code>
                    </td>
                    <td>
                      <code>{p.brief_id}</code>
                    </td>
                    <td>{p.opened_at.slice(0, 10)}</td>
                    <td>{p.age_days.toFixed(1)}d</td>
                    <td>
                      {p.labels.map((l) => (
                        <span key={l} className="badge" style={{ marginRight: 4 }}>
                          {l}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
