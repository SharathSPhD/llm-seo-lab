/**
 * Server-side Supabase client factories.
 *
 * Spec: docs/v0.3.0/spec.md §6.
 *
 *   - `getServerClient()` is the per-request, RLS-bound client used in
 *     React Server Components and Server Actions. It reads/writes the
 *     auth cookie via Next.js `cookies()`.
 *
 *   - `getServiceRoleClient()` is the admin client used only when
 *     spinning up internal scripts (e.g. seed-loader). MCP runs in a
 *     separate process and constructs its own service-role client.
 *
 * We do not import `next/headers` at module top-level so this file can
 * also be imported by `node:test` unit tests that pass a synthetic
 * cookie store.
 */

import { createServerClient as createSsrServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv, type SupabaseEnv } from "./env.ts";
import type { Database } from "./types.ts";

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set?(opts: { name: string; value: string } & CookieOptions): void;
}

export function createServerClient(
  cookieStore: CookieStoreLike,
  env?: SupabaseEnv,
) {
  const e = env ?? readSupabaseEnv();
  return createSsrServerClient<Database>(e.url, e.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set?.({ name, value, ...options });
        } catch {
          // Server Components cannot set cookies; that's fine — the
          // refresh path runs in middleware/server actions where
          // `cookies()` is mutable.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set?.({ name, value: "", ...options });
        } catch {
          // see above
        }
      },
    },
  });
}

/**
 * Get the live Next.js cookie store-bound server client. Lazy-imports
 * `next/headers` so non-Next callers (tests, scripts) can use
 * `createServerClient` directly.
 */
export async function getServerClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(cookieStore as unknown as CookieStoreLike);
}

export function createServiceRoleClient(env?: SupabaseEnv) {
  const e = env ?? readSupabaseEnv();
  if (!e.serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY missing. Set it in the dashboard server env (never expose to the browser).",
    );
  }
  return createClient<Database>(e.url, e.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
