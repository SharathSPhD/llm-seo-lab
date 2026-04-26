/**
 * Browser-side Supabase client.
 *
 * Spec: docs/v0.3.0/spec.md §6, §10.
 *
 * Used by client components that need a live session subscription
 * (e.g. magic-link callback, sign-out button). RLS is enforced by the
 * server in every server action; this client is intentionally a thin
 * wrapper so that we never read cross-user data on the client.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.ts";

export interface BrowserSupabaseEnv {
  url: string;
  anonKey: string;
}

export function readBrowserEnv(): BrowserSupabaseEnv {
  // In Next.js, only NEXT_PUBLIC_* vars are inlined into the browser
  // bundle. We accept either prefix so the env file can be shared with
  // server-side code that uses the unprefixed variant.
  const url =
    (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_SUPABASE_URL"] : undefined) ??
    (typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined);
  const anonKey =
    (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] : undefined) ??
    (typeof process !== "undefined" ? process.env["SUPABASE_ANON_KEY"] : undefined);
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in apps/web/.env.local",
    );
  }
  return { url, anonKey };
}

export function getBrowserClient(env: BrowserSupabaseEnv = readBrowserEnv()) {
  return createBrowserClient<Database>(env.url, env.anonKey);
}
