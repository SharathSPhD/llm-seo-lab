import Link from "next/link";
import { isSupabaseMode } from "../lib/supabase/env.ts";
import { getCurrentUserAsync } from "../lib/auth.ts";
import { signOut } from "../app/login/actions.ts";

export interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Sites (v0.2.0)", href: "/sites" },
  { label: "Health", href: "/health" },
  { label: "Overview", href: "/" },
];

export default async function Nav(): Promise<React.JSX.Element> {
  const supabaseMode = isSupabaseMode();
  const user = await getCurrentUserAsync();

  return (
    <nav className="nav" aria-label="Primary">
      <h1>llm-seo-lab</h1>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        {user ? (
          <>
            <div className="subtle" style={{ marginBottom: 8 }}>
              Signed in as
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              {user.email || user.display_name}
              <br />
              <span className="subtle">({user.source})</span>
            </div>
            {supabaseMode && user.source === "supabase" ? (
              <form action={signOut}>
                <button type="submit" className="btn link" style={{ fontSize: 12 }}>
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="btn link" style={{ fontSize: 12 }}>
                Login page
              </Link>
            )}
          </>
        ) : (
          <Link href="/login" className="btn primary" style={{ fontSize: 12 }}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
