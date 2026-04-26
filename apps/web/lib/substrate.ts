/**
 * Substrate auto-detection.
 *
 * Spec: docs/v0.3.0/spec.md §1, §8 — the new-use-case wizard auto-detects
 * the substrate from a URL but always lets the user override.
 *
 *   - YouTube: youtube.com/watch?v=… or youtu.be/<id>
 *   - Substack: <slug>.substack.com or substack.com/p/<slug>
 *   - Web: anything else
 *
 * Pure function so it can be reused by server actions, the wizard form,
 * and seed scripts (R7) without crossing process boundaries.
 */

import type { Substrate } from "@llm-seo-lab/shared";

export interface SubstrateDetection {
  substrate: Substrate;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const SUBSTACK_HOST_SUFFIX = ".substack.com";
const SUBSTACK_BARE_HOST = "substack.com";

export function detectSubstrate(rawUrl: string): SubstrateDetection {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return { substrate: "web", confidence: "low", reason: "empty url; defaulted to web" };
  }
  let host: string;
  try {
    const u = new URL(trimmed);
    host = u.hostname.toLowerCase();
  } catch {
    return { substrate: "web", confidence: "low", reason: "url did not parse; defaulted to web" };
  }
  if (YOUTUBE_HOSTS.has(host)) {
    return { substrate: "youtube", confidence: "high", reason: `host=${host}` };
  }
  if (host.endsWith(SUBSTACK_HOST_SUFFIX) || host === SUBSTACK_BARE_HOST) {
    return { substrate: "substack", confidence: "high", reason: `host=${host}` };
  }
  return { substrate: "web", confidence: "high", reason: `host=${host} not in known platform list` };
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
