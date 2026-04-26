/**
 * /use-cases — alias of /dashboard for nav consistency.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function UseCasesIndexPage(): never {
  redirect("/dashboard");
}
