"use server";

/**
 * Server action for /use-cases/new.
 *
 * Spec: docs/v0.3.0/spec.md §8.
 */

import { redirect } from "next/navigation";
import { createUseCase } from "../../../lib/actions/use-cases.ts";
import { detectSubstrate, isValidUrl } from "../../../lib/substrate.ts";
import { getCurrentUserAsync } from "../../../lib/auth.ts";
import type { Substrate } from "@llm-seo-lab/shared";

const SUBSTRATES: ReadonlySet<Substrate> = new Set([
  "web",
  "substack",
  "youtube",
]);

export async function createUseCaseAction(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "").trim();
  const substrateRaw = String(formData.get("substrate") ?? "auto").trim();
  const title = String(formData.get("title") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const target_audience =
    String(formData.get("target_audience") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const back = (msg: string) => {
    const q = new URLSearchParams({ error: msg });
    if (url) q.set("url", url);
    redirect(`/use-cases/new?${q.toString()}`);
  };

  if (!isValidUrl(url)) {
    back("Invalid URL");
    return;
  }
  if (!title) {
    back("Title is required");
    return;
  }
  if (!topic) {
    back("Topic is required");
    return;
  }

  let substrate: Substrate;
  if (substrateRaw === "auto") {
    substrate = detectSubstrate(url).substrate;
  } else if (SUBSTRATES.has(substrateRaw as Substrate)) {
    substrate = substrateRaw as Substrate;
  } else {
    back("Invalid substrate");
    return;
  }

  const user = await getCurrentUserAsync();
  if (!user) {
    redirect("/login");
  }

  let id: string;
  try {
    const row = await createUseCase({
      user_id: user.id,
      url,
      substrate,
      title,
      topic,
      target_audience,
      notes,
    });
    id = row.id;
  } catch (e) {
    back((e as Error).message);
    return;
  }

  redirect(`/use-cases/${encodeURIComponent(id)}`);
}
