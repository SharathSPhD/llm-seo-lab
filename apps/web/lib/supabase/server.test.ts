/**
 * Unit tests for the server-side Supabase client factories.
 *
 * The live RLS deny-test lives at `infra/supabase/tests/rls.test.sql`
 * and is run with `psql` against a Supabase project. These tests cover
 * just the factory's env-handling and cookie-store integration.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSupabaseEnv, tryReadSupabaseEnv, isSupabaseMode, SupabaseEnvError } from "./env.ts";
import { createServerClient, createServiceRoleClient, type CookieStoreLike } from "./server.ts";

describe("supabase env", () => {
  it("throws SupabaseEnvError when required vars are missing", () => {
    assert.throws(
      () => readSupabaseEnv({ LLM_SEO_LAB_AUTH_ENABLED: "1" } as unknown as NodeJS.ProcessEnv),
      SupabaseEnvError,
    );
  });

  it("returns env when all vars are set", () => {
    const env = readSupabaseEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(env.url, "https://x.supabase.co");
    assert.equal(env.anonKey, "anon");
    assert.equal(env.serviceRoleKey, "service");
  });

  it("tryReadSupabaseEnv returns null on missing vars instead of throwing", () => {
    const env = tryReadSupabaseEnv({} as NodeJS.ProcessEnv);
    assert.equal(env, null);
  });

  it("accepts NEXT_PUBLIC_* fallback names", () => {
    const env = readSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://y.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(env.url, "https://y.supabase.co");
    assert.equal(env.anonKey, "anon-public");
    assert.equal(env.serviceRoleKey, null);
  });

  it("isSupabaseMode reflects the auth flag", () => {
    assert.equal(isSupabaseMode({} as NodeJS.ProcessEnv), false);
    assert.equal(isSupabaseMode({ LLM_SEO_LAB_AUTH_ENABLED: "1" } as unknown as NodeJS.ProcessEnv), true);
    assert.equal(isSupabaseMode({ LLM_SEO_LAB_AUTH_ENABLED: "true" } as unknown as NodeJS.ProcessEnv), true);
  });
});

describe("supabase server client factories", () => {
  it("createServerClient builds a client with a cookie-store-bound storage adapter", () => {
    const cookies = new Map<string, string>();
    const store: CookieStoreLike = {
      get(name) {
        const v = cookies.get(name);
        return v !== undefined ? { value: v } : undefined;
      },
      set({ name, value }) {
        cookies.set(name, value);
      },
    };
    const client = createServerClient(store, {
      url: "https://x.supabase.co",
      anonKey: "anon",
      serviceRoleKey: null,
    });
    assert.ok(client);
    assert.equal(typeof client.from, "function");
  });

  it("createServiceRoleClient throws when service-role key is missing", () => {
    assert.throws(
      () =>
        createServiceRoleClient({
          url: "https://x.supabase.co",
          anonKey: "anon",
          serviceRoleKey: null,
        }),
      /SUPABASE_SERVICE_ROLE_KEY missing/,
    );
  });

  it("createServiceRoleClient builds a client when key is present", () => {
    const client = createServiceRoleClient({
      url: "https://x.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service",
    });
    assert.ok(client);
    assert.equal(typeof client.from, "function");
  });
});
