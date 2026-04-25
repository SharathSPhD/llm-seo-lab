import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "../components/nav.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "llm-seo-lab",
  description: "Closed-loop autonomous AEO/LLM-SEO citation engineering.",
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
