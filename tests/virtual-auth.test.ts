import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// The Next server-only boundary remains enforced in production. Node test runner has no RSC condition.
require.cache[require.resolve("server-only")] = { exports: {} } as NodeModule;

test("verified A/B identities use Auth GET and RPC requests carry publishable key and only the user JWT", async () => {
  const auth = await import("../src/lib/virtual-auth");
  const api = await import("../src/lib/virtual-api");
  const original = globalThis.fetch,
    env = {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_PUBLISHABLE_KEY,
    };
  process.env.SUPABASE_URL = "https://auth-unit.example.test";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake_unit_only";
  const calls: {
    path: string;
    method: string;
    auth: string | null;
    body: unknown;
  }[] = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers),
      path = new URL(String(input)).pathname;
    assert.equal(headers.get("apikey"), "sb_publishable_fake_unit_only");
    assert.equal(init?.cache, "no-store");
    const token = headers.get("Authorization");
    calls.push({
      path,
      method: init?.method ?? "GET",
      auth: token,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (path === "/auth/v1/user")
      return token === "Bearer expired" || token === "Bearer forged-admin"
        ? Response.json({}, { status: 401 })
        : Response.json({
            id:
              token === "Bearer user-a"
                ? "00000000-0000-4000-8000-000000000001"
                : "00000000-0000-4000-8000-000000000002",
          });
    if (path.endsWith("virtual_wallet_apply"))
      return Response.json("00000000-0000-4000-8000-000000000003");
    return Response.json(
      { code: "PGRST202", message: "secret-db-details" },
      { status: 404 },
    );
  };
  try {
    const a = await auth.verifyAccess("user-a"),
      b = await auth.verifyAccess("user-b");
    assert.notEqual(a?.user.id, b?.user.id);
    assert.equal(await auth.verifyAccess("expired"), null);
    assert.equal(await auth.verifyAccess("forged-admin"), null);
    assert.ok(
      calls
        .slice(0, 4)
        .every(
          (call) => call.method === "GET" && call.path === "/auth/v1/user",
        ),
    );
    const key = "00000000-0000-4000-8000-000000000099",
      id = "00000000-0000-4000-8000-000000000011";
    const request = {
      kind: "DEPOSIT",
      occurred_at: "2026-01-01T00:00:00Z",
      amount: "12345678901234567890.123456789012345678",
    };
    await api.applyOperation(a!.token, id, request, key);
    await api.applyOperation(a!.token, id, request, key);
    assert.deepEqual(calls.at(-1), calls.at(-2));
    assert.equal(calls.at(-1)?.auth, "Bearer user-a");
    assert.deepEqual(calls.at(-1)?.body, {
      p_wallet_id: id,
      p_request: request,
      p_key: key,
    });
    await assert.rejects(
      () => api.walletMarket(a!.token),
      (error) =>
        /ativada/.test(auth.safeError(error)) &&
        !auth.safeError(error).includes("secret-db-details"),
    );
    assert.deepEqual(auth.cookieOptions, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_accidental_admin";
    assert.throws(() => auth.virtualConfig());
  } finally {
    globalThis.fetch = original;
    if (env.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = env.key;
  }
});
