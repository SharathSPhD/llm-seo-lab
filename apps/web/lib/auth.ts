/**
 * Auth bridge.
 *
 * v0.2.0 shipped this as a feature-flag shim that returned a synthetic
 * `local-dev` user when `LLM_SEO_LAB_AUTH_ENABLED` was off. v0.3.0
 * keeps that shim intact (so the v0.2.0 widgets that import `AuthUser`
 * compile unchanged) and *adds* a Supabase-backed path:
 *
 *   - `LLM_SEO_LAB_AUTH_ENABLED=0` (default) → synthetic local user.
 *   - `LLM_SEO_LAB_AUTH_ENABLED=1` + Supabase env → real session.
 *
 * The "real session" path is async and lives in
 * `getCurrentUserAsync()`. The legacy `getCurrentUser()` stays sync and
 * still drives the v0.2.0 archive routes.
 */

import { isSupabaseMode, tryReadSupabaseEnv } from "./supabase/env.ts";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  source: "local" | "clerk" | "auth0" | "supabase";
}

export interface AuthState {
  enabled: boolean;
  user: AuthUser | null;
}

const LOCAL_USER: AuthUser = {
  id: "local-dev",
  email: "local@llm-seo-lab.dev",
  display_name: "Local",
  source: "local",
};

export function isAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSupabaseMode(env);
}

export function getCurrentUser(env: NodeJS.ProcessEnv = process.env): AuthUser | null {
  if (!isAuthEnabled(env)) return LOCAL_USER;
  return null;
}

export function getAuthState(env: NodeJS.ProcessEnv = process.env): AuthState {
  return { enabled: isAuthEnabled(env), user: getCurrentUser(env) };
}

/**
 * Async path used by the v0.3.0 dashboard. Returns the real Supabase
 * session user when auth is on, or the local user otherwise. Returns
 * null when auth is on but the session is not signed in or the env is
 * incomplete (the dashboard root page treats this as "redirect to
 * /login").
 */
export async function getCurrentUserAsync(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AuthUser | null> {
  if (!isAuthEnabled(env)) return LOCAL_USER;
  const supabaseEnv = tryReadSupabaseEnv(env);
  if (!supabaseEnv) return null;
  try {
    const { getServerClient } = await import("./supabase/server.ts");
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const u = data.user;
    return {
      id: u.id,
      email: u.email ?? "",
      display_name: (u.user_metadata?.["display_name"] as string | undefined) ?? u.email ?? u.id,
      source: "supabase",
    };
  } catch {
    return null;
  }
}
