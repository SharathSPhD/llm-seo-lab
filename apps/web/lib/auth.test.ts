import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAuthState, getCurrentUser, getCurrentUserAsync, isAuthEnabled } from "./auth.ts";

describe("auth (feature-flag shim)", () => {
  it("is disabled by default and returns the local synthetic user", () => {
    const env = {} as NodeJS.ProcessEnv;
    assert.equal(isAuthEnabled(env), false);
    const user = getCurrentUser(env);
    assert.ok(user);
    assert.equal(user!.source, "local");
  });

  it("returns no sync user once the flag is on (Supabase is async)", () => {
    const env = { LLM_SEO_LAB_AUTH_ENABLED: "1" } as unknown as NodeJS.ProcessEnv;
    assert.equal(isAuthEnabled(env), true);
    assert.equal(getCurrentUser(env), null);
  });

  it("getAuthState bundles enabled flag with the resolved user", () => {
    const off = getAuthState({} as NodeJS.ProcessEnv);
    assert.equal(off.enabled, false);
    assert.equal(off.user!.id, "local-dev");
    const on = getAuthState({ LLM_SEO_LAB_AUTH_ENABLED: "true" } as unknown as NodeJS.ProcessEnv);
    assert.equal(on.enabled, true);
    assert.equal(on.user, null);
  });
});

describe("auth (async / Supabase path)", () => {
  it("returns the local user when the flag is off (sync mirrors async)", async () => {
    const u = await getCurrentUserAsync({} as NodeJS.ProcessEnv);
    assert.ok(u);
    assert.equal(u!.source, "local");
  });

  it("returns null when the flag is on but Supabase env is missing", async () => {
    const u = await getCurrentUserAsync({
      LLM_SEO_LAB_AUTH_ENABLED: "1",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(u, null);
  });
});
