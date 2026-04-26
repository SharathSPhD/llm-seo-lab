import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectSubstrate, isValidUrl } from "./substrate.ts";

describe("substrate auto-detection", () => {
  it("detects YouTube canonical watch URLs", () => {
    const r = detectSubstrate("https://www.youtube.com/watch?v=fM2hpqPx8zg");
    assert.equal(r.substrate, "youtube");
    assert.equal(r.confidence, "high");
  });

  it("detects YouTube short URLs (youtu.be)", () => {
    const r = detectSubstrate("https://youtu.be/fM2hpqPx8zg?si=mAnjJkN4miAhFLem");
    assert.equal(r.substrate, "youtube");
    assert.equal(r.confidence, "high");
  });

  it("detects YouTube Music URLs", () => {
    const r = detectSubstrate("https://music.youtube.com/watch?v=abc");
    assert.equal(r.substrate, "youtube");
  });

  it("detects Substack subdomain posts", () => {
    const r = detectSubstrate(
      "https://technektar.substack.com/p/when-the-context-window-is-big-and?r=7dqlgi",
    );
    assert.equal(r.substrate, "substack");
    assert.equal(r.confidence, "high");
  });

  it("detects bare substack.com URLs", () => {
    const r = detectSubstrate("https://substack.com/p/some-post");
    assert.equal(r.substrate, "substack");
  });

  it("falls back to web for arbitrary domains", () => {
    const r = detectSubstrate("https://www.technektar.dev/posts/2026/something");
    assert.equal(r.substrate, "web");
    assert.equal(r.confidence, "high");
  });

  it("treats malformed URLs as low-confidence web", () => {
    const r = detectSubstrate("not-a-url");
    assert.equal(r.substrate, "web");
    assert.equal(r.confidence, "low");
  });

  it("treats empty input as low-confidence web", () => {
    const r = detectSubstrate("   ");
    assert.equal(r.substrate, "web");
    assert.equal(r.confidence, "low");
  });

  it("isValidUrl accepts http(s) only", () => {
    assert.equal(isValidUrl("https://example.com"), true);
    assert.equal(isValidUrl("http://localhost:3000"), true);
    assert.equal(isValidUrl("ftp://example.com"), false);
    assert.equal(isValidUrl("javascript:alert(1)"), false);
    assert.equal(isValidUrl(""), false);
  });
});
