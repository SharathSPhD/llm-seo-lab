import { listPrs } from "../../../../lib/actions/prs.ts";
import PrQueueWidget from "../../../../components/widgets/pr-queue.tsx";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PrsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const site_id = decodeURIComponent(slug);

  let initial = { open: [], merged: [], closed_unmerged: [] } as Awaited<ReturnType<typeof listPrs>>;
  let error: string | undefined;
  try {
    initial = await listPrs(site_id);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h2 className="h1">{site_id} · PR queue</h2>
      <p className="subtle">
        AEO fix PRs the daemon has opened against this site. Live updates stream from the cli-worker
        WebSocket.
      </p>
      {error ? (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Could not load PRs:</strong> {error}
        </div>
      ) : (
        <PrQueueWidget initial={initial} />
      )}
    </>
  );
}
