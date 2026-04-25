import { ok, err } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";
import { errInternal, makeError } from "../errors.ts";
import type { PlaywrightWorker } from "../types.ts";

export interface PlaywrightSession {
  alive: boolean;
  query: (engine: string, q: string) => Promise<{ cited_urls: string[]; snippet?: string }>;
}

/**
 * v0.1.0 Playwright pool indirection. The actual browser is owned by the
 * cursor-ide-browser MCP using the user's logged-in session. This pool
 * keeps a session map per engine and routes queries through the injected
 * session adapter so we can mock it in tests and swap implementations.
 */
export class PlaywrightSessionPool implements PlaywrightWorker {
  private sessions = new Map<string, PlaywrightSession>();
  private readonly factory: (engine: string) => PlaywrightSession;

  constructor(factory: (engine: string) => PlaywrightSession) {
    this.factory = factory;
  }

  async query(engine: string, question: string): Promise<Result<{ cited_urls: string[]; snippet?: string }>> {
    let s = this.sessions.get(engine);
    if (!s || !s.alive) {
      s = this.factory(engine);
      this.sessions.set(engine, s);
    }
    if (!s.alive) {
      return err(
        makeError(
          "PLAYWRIGHT_AUTH_EXPIRED",
          `${engine} browser session is logged out`,
          `Open ${engine} in your browser via the cursor-ide-browser MCP and re-authenticate, then retry`,
        ),
      );
    }
    try {
      const r = await s.query(engine, question);
      return ok(r);
    } catch (e) {
      return err(errInternal(`playwright query failed: ${(e as Error).message}`,
        "Capture a manual screenshot via /aeo:ingest-screenshot as a fallback"));
    }
  }

  sessionsAlive(): number {
    return [...this.sessions.values()].filter((s) => s.alive).length;
  }
}
