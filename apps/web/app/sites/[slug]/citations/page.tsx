import { getCitationTrend } from "../../../../lib/actions/citations.ts";
import { readSiteConfig } from "../../../../lib/actions/sites.ts";
import CitationTrendWidget from "../../../../components/widgets/citation-trend.tsx";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}

export default async function CitationsPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const { topic: topicParam } = await searchParams;
  const site_id = decodeURIComponent(slug);

  let topic = topicParam ?? "";
  let configErr: string | undefined;
  if (!topic) {
    try {
      const cfg = await readSiteConfig(site_id);
      topic = cfg.topics[0] ?? "default";
    } catch (e) {
      configErr = (e as Error).message;
      topic = "default";
    }
  }

  let error: string | undefined;
  let trend = null;
  try {
    trend = await getCitationTrend(site_id, topic);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h2 className="h1">{site_id} · Citations</h2>
      <p className="subtle">
        Topic: <code>{topic}</code>{" "}
        {configErr && <em style={{ color: "var(--warn)" }}>(config unavailable: {configErr})</em>}
      </p>
      {error ? (
        <div className="panel" style={{ borderColor: "var(--warn)" }}>
          <strong>No citation data yet:</strong> {error}
        </div>
      ) : (
        trend && <CitationTrendWidget trend={trend} />
      )}
    </>
  );
}
