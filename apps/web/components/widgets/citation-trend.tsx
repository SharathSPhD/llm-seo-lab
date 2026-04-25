import type { Engine } from "@llm-seo-lab/shared";
import type { CitationTrendView } from "../../lib/actions/citations.ts";

const ENGINE_COLORS: Record<Engine, string> = {
  claude_ai: "#a78bfa",
  perplexity: "#38bdf8",
  chatgpt: "#10b981",
  gemini: "#f59e0b",
  google_aio: "#ef4444",
};

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 16, right: 24, bottom: 28, left: 36 };

export interface CitationTrendWidgetProps {
  trend: CitationTrendView;
}

export default function CitationTrendWidget({
  trend,
}: CitationTrendWidgetProps): React.JSX.Element {
  const points = trend.points;
  const engines = collectEngines(trend);

  if (points.length === 0) {
    return (
      <div className="panel">
        <p className="subtle">No citation samples yet for topic <code>{trend.topic}</code>.</p>
      </div>
    );
  }

  const xStep = (WIDTH - PAD.left - PAD.right) / Math.max(points.length - 1, 1);
  const yScale = (v: number): number => HEIGHT - PAD.bottom - v * (HEIGHT - PAD.top - PAD.bottom);

  const series = engines.map((engine) => {
    const path = points
      .map((pt, i) => {
        const x = PAD.left + i * xStep;
        const y = yScale(pt.per_engine[engine] ?? 0);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { engine, path, color: ENGINE_COLORS[engine] };
  });

  return (
    <div className="panel">
      <h3 className="h1" style={{ fontSize: 14 }}>
        Citation share — <code>{trend.topic}</code>
      </h3>
      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Citation share trend for topic ${trend.topic}`}
      >
        <line
          x1={PAD.left}
          y1={HEIGHT - PAD.bottom}
          x2={WIDTH - PAD.right}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={yScale(tick)}
              x2={WIDTH - PAD.right}
              y2={yScale(tick)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              opacity={0.5}
            />
            <text x={4} y={yScale(tick) + 4} fill="var(--muted)" fontSize="10">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.engine} d={s.path} fill="none" stroke={s.color} strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ marginTop: 8 }}>
        {series.map((s) => (
          <span
            key={s.engine}
            className="badge"
            style={{ marginRight: 6, borderColor: s.color, color: s.color }}
          >
            {s.engine}
          </span>
        ))}
      </div>
    </div>
  );
}

function collectEngines(trend: CitationTrendView): Engine[] {
  const seen = new Set<Engine>();
  for (const pt of trend.points) {
    for (const e of Object.keys(pt.per_engine) as Engine[]) seen.add(e);
  }
  for (const e of Object.keys(trend.latest.per_engine) as Engine[]) seen.add(e);
  return Array.from(seen);
}
