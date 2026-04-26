/**
 * /login — Supabase magic-link sign-in.
 *
 * v0.3.0 R6 — replaces the local-dev-only auth flow when
 * LLM_SEO_LAB_AUTH_ENABLED=1. We render a single-input email form; on
 * submit a server action calls supabase.auth.signInWithOtp() and Supabase
 * emails the user a magic-link that lands on `/auth/callback`.
 *
 * In local mode (auth flag off) we still render this page but it shows
 * a banner explaining that the local synthetic user is already signed in
 * and links straight to /dashboard.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseMode } from "../../lib/supabase/env.ts";
import { signInWithEmail, signOut } from "./actions.ts";
import { getCurrentUserAsync } from "../../lib/auth.ts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;
  const supabaseMode = isSupabaseMode();

  if (!supabaseMode) {
    return (
      <>
        <h2 className="h1">Sign in</h2>
        <div className="panel">
          <p>
            <strong>Local mode.</strong> Auth is disabled
            (<code>LLM_SEO_LAB_AUTH_ENABLED=0</code>). The dashboard runs as the
            synthetic user <code>local-dev</code>.
          </p>
          <p>
            <Link href="/dashboard">Go to dashboard →</Link>
          </p>
        </div>
      </>
    );
  }

  // If already signed in, jump straight to /dashboard.
  const user = await getCurrentUserAsync();
  if (user && user.source === "supabase") {
    redirect("/dashboard");
  }

  return (
    <>
      <h2 className="h1">Sign in</h2>
      <p className="subtle">
        We will email you a magic-link. Click it once and you&apos;re in — no password.
      </p>

      {sent && (
        <div className="panel" style={{ borderColor: "var(--good)" }}>
          <strong>Check your email.</strong> A magic-link is on its way. The link
          expires in 60 minutes.
        </div>
      )}

      {error && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Sign-in failed:</strong> {error}
        </div>
      )}

      <form action={signInWithEmail} className="panel">
        <label htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className="btn primary">
          Send magic link
        </button>
      </form>

      <div className="panel">
        <p className="subtle">
          Already signed in but stuck? <Link href="/login">Refresh</Link>{" "}
          or{" "}
          <form action={signOut} style={{ display: "inline" }}>
            <button type="submit" className="btn link">
              sign out
            </button>
          </form>
          .
        </p>
      </div>
    </>
  );
}
