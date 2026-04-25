/**
 * Auth shim. v0.1.0 ships with auth disabled and exposes a stable interface
 * so future Clerk (or other) integration is a drop-in swap.
 *
 * Toggle by setting `LLM_SEO_LAB_AUTH_ENABLED=1`. With the flag off (the
 * default), `getCurrentUser` returns a synthetic local user so the dashboard
 * works on `localhost` without sign-in.
 */

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  source: "local" | "clerk" | "auth0";
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
  const flag = env["LLM_SEO_LAB_AUTH_ENABLED"];
  return flag === "1" || flag === "true";
}

export function getCurrentUser(env: NodeJS.ProcessEnv = process.env): AuthUser | null {
  if (!isAuthEnabled(env)) return LOCAL_USER;
  return null;
}

export function getAuthState(env: NodeJS.ProcessEnv = process.env): AuthState {
  return { enabled: isAuthEnabled(env), user: getCurrentUser(env) };
}
