import Link from "next/link";

export interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/" },
  { label: "Sites", href: "/sites" },
  { label: "Health", href: "/health" },
];

export default function Nav(): React.JSX.Element {
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
    </nav>
  );
}
