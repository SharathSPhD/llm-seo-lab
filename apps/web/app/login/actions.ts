"use server";

/**
 * Server actions for /login.
 *
 * Spec: docs/v0.3.0/spec.md §9.
 *
 *   - `signInWithEmail` calls Supabase `signInWithOtp()` and redirects to
 *     `/login?sent=1` (or `?error=...`).
 *   - `signOut` clears the Supabase session cookie and redirects to
 *     `/login`.
 *
 * These run on the server inside Next.js form actions; they do NOT use
 * the browser SDK because the magic-link emailRedirectTo URL is computed
 * from request headers.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerClient } from "../../lib/supabase/server.ts";
import { isSupabaseMode } from "../../lib/supabase/env.ts";

export async function signInWithEmail(formData: FormData): Promise<void> {
  if (!isSupabaseMode()) {
    redirect("/dashboard");
  }
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    redirect("/login?error=invalid_email");
  }
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3030";
  const callback = `${proto}://${host}/auth/callback`;
  const sb = await getServerClient();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback },
  });
  if (error) {
    const msg = encodeURIComponent(error.message);
    redirect(`/login?error=${msg}`);
  }
  redirect("/login?sent=1");
}

export async function signOut(): Promise<void> {
  if (!isSupabaseMode()) {
    redirect("/login");
  }
  const sb = await getServerClient();
  await sb.auth.signOut();
  redirect("/login");
}
