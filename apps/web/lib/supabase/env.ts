/**
 * Centralised env-var access for the Supabase server / browser clients.
 *
 * Spec ref: docs/v0.3.0/spec.md §10.
 *
 * The dashboard runs in three modes:
 *
 *   1. supabase mode (LLM_SEO_LAB_AUTH_ENABLED=1, full env present):
 *      magic-link auth, RLS-protected reads, service-role MCP writes.
 *
 *   2. local mode (LLM_SEO_LAB_AUTH_ENABLED=0 or unset): the v0.2.0
 *      `local-dev` user from `apps/web/lib/auth.ts` is returned and
 *      the new use-case routes show a banner. No Supabase required.
 *
 *   3. partial mode (the flag is on but env is missing): we surface a
 *      readable error so the dashboard fails loudly at boot rather
 *      than silently rejecting login.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string | null;
}

export class SupabaseEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Supabase mode requested (LLM_SEO_LAB_AUTH_ENABLED=1) but env is incomplete. Missing: ${missing.join(
        ", ",
      )}. See docs/v0.3.0/spec.md §10 for required env vars.`,
    );
    this.name = "SupabaseEnvError";
  }
}

export function isSupabaseMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env["LLM_SEO_LAB_AUTH_ENABLED"];
  return flag === "1" || flag === "true";
}

export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv {
  const missing: string[] = [];
  const url = env["SUPABASE_URL"] ?? env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = env["SUPABASE_ANON_KEY"] ?? env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"] ?? null;
  if (!url) missing.push("SUPABASE_URL");
  if (!anonKey) missing.push("SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    throw new SupabaseEnvError(missing);
  }
  return { url: url!, anonKey: anonKey!, serviceRoleKey };
}

export function tryReadSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv | null {
  try {
    return readSupabaseEnv(env);
  } catch {
    return null;
  }
}
