/**
 * /auth/callback — Supabase magic-link landing route.
 *
 * Supabase appends `?code=...` (PKCE flow). We exchange that for a
 * session, set the session cookies, and redirect to /dashboard. On any
 * failure we send the user back to /login with the error in the query
 * string.
 *
 * Spec: docs/v0.3.0/spec.md §9.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "../../../lib/supabase/server.ts";
import { isSupabaseMode } from "../../../lib/supabase/env.ts";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isSupabaseMode()) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  try {
    const sb = await getServerClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      const msg = encodeURIComponent(error.message);
      return NextResponse.redirect(new URL(`/login?error=${msg}`, request.url));
    }
  } catch (e) {
    const msg = encodeURIComponent((e as Error).message);
    return NextResponse.redirect(new URL(`/login?error=${msg}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
