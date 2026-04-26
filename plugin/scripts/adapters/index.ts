/**
 * Substrate adapter registry — single point of dispatch consumed by
 * `mcp/src/tools/v030.ts` (`pull_recommend` and `pull_apply_artifact`)
 * and by adapter unit tests.
 *
 * Adding a new substrate (e.g. `linkedin`, `medium`):
 *   1. Create `plugin/scripts/adapters/<name>.ts` exporting an
 *      object that satisfies `SubstrateAdapter`.
 *   2. Extend the `Substrate` union in `packages/shared/src/types/v030.ts`.
 *   3. Add it to `ADAPTERS` below.
 *   4. Add a row to `infra/supabase/migrations/...` if the substrate enum
 *      is enforced at the DB layer.
 */

import type {
  Substrate,
  SubstrateAdapter,
} from "@llm-seo-lab/shared";
import { webAdapter } from "./web.ts";
import { substackAdapter } from "./substack.ts";
import { youtubeAdapter } from "./youtube.ts";

export const ADAPTERS: Record<Substrate, SubstrateAdapter> = {
  web: webAdapter,
  substack: substackAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(substrate: Substrate): SubstrateAdapter {
  const a = ADAPTERS[substrate];
  if (!a) {
    throw new Error(`unknown substrate: ${substrate}`);
  }
  return a;
}

export { webAdapter, substackAdapter, youtubeAdapter };
