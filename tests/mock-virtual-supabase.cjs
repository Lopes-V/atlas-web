// Isolated browser-test preload. No real accounts, emails, schema or financial arithmetic.
const randomUUID = () => globalThis.crypto.randomUUID();
const fallback = globalThis.fetch;
const sessions = new Map(),
  refreshes = new Map(),
  wallets = new Map(),
  creations = new Map(),
  attempts = new Set();
const assets = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    symbol: "BTCUSDT",
    name: "Bitcoin",
    currency_code: "USDT",
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    symbol: "ETHUSDT",
    name: "Ethereum",
    currency_code: "USDT",
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    symbol: "SOLUSDT",
    name: "Solana",
    currency_code: "USDT",
  },
];
const now = () => new Date().toISOString();
function tokens(user) {
  const access_token = `test-user-jwt-${randomUUID()}`,
    refresh_token = `test-refresh-${randomUUID()}`;
  sessions.set(access_token, user);
  refreshes.set(refresh_token, user);
  return { access_token, refresh_token, expires_in: 3600 };
}
function entry(request, sequence) {
  return {
    id: randomUUID(),
    sequence,
    kind: request.kind,
    occurred_at: request.occurred_at,
    created_at: now(),
    request,
    reversed: false,
    reversal_of: request.reversal_of ?? null,
  };
}
function historyWallet(user) {
  const wallet = {
    id: randomUUID(),
    name: "Histórico de teste",
    base_currency_code: "USDT",
    owner: user.id,
    keys: new Map(),
    operations: [
      entry(
        { kind: "DEPOSIT", occurred_at: "2026-01-01T00:00:00Z", amount: "10" },
        51,
      ),
    ],
    historyFixture: user.mode === "history",
    freshFixture: user.mode === "fresh",
  };
  wallet.older = entry(
    { kind: "DEPOSIT", occurred_at: "2026-01-01T00:00:00Z", amount: "2.12345" },
    1,
  );
  wallets.set(wallet.id, wallet);
}
function state(wallet) {
  const partial = wallet.historyFixture,
    positions =
      partial || wallet.freshFixture
        ? [
            {
              asset_id: assets[0].id,
              symbol: assets[0].symbol,
              name: assets[0].name,
              quantity: "1",
              average_cost: "10",
              cost_basis: "10",
              price: partial ? null : "10",
              observed_at: partial
                ? null
                : new Date(Date.now() - 10000).toISOString(),
              market_value: partial ? null : "10",
              unrealized_pnl: partial ? null : "0",
              unrealized_pnl_pct: partial ? null : "0",
              concentration_pct: partial ? null : "100",
            },
          ]
        : [];
  // Fixed server contract fixtures; accounting is verified against PostgreSQL elsewhere.
  return {
    wallet: { id: wallet.id, name: wallet.name, base_currency_code: "USDT" },
    cash: "0",
    net_contributions: "0",
    realized_pnl: "0",
    fees: "0",
    cost_basis: partial ? "10" : "0",
    positions,
    market_value: partial ? null : wallet.freshFixture ? "10" : "0",
    known_market_value: "0",
    unrealized_pnl: partial ? null : "0",
    valuation_complete: !partial,
    evaluated_at: now(),
    operations: wallet.operations.slice().reverse(),
    operations_total: wallet.historyFixture ? 51 : wallet.operations.length,
    next_before: wallet.historyFixture ? 51 : null,
  };
}
globalThis.fetch = async function (input, init) {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (
    url.hostname !== "atlas-test.supabase.co" ||
    !(
      url.pathname.startsWith("/auth/") ||
      url.pathname.includes("virtual_wallet")
    )
  )
    return fallback(input, init);
  const headers = new Headers(init?.headers),
    key = headers.get("apikey");
  if (key !== "sb_publishable_test_only_never_real")
    return Response.json(
      { message: "Wrong key: individual routes must never use service key" },
      { status: 403 },
    );
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (
    url.pathname === "/auth/v1/signup" &&
    url.searchParams.get("redirect_to") !== "http://127.0.0.1:3102/conta"
  )
    return Response.json({}, { status: 400 });
  if (url.pathname === "/auth/v1/signup")
    return Response.json({ user: { id: randomUUID(), email: body.email } });
  if (url.pathname === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const user = refreshes.get(body.refresh_token);
      if (!user) return Response.json({}, { status: 401 });
      return Response.json(tokens(user));
    }
    const user = {
      id: randomUUID(),
      email: body.email,
      mode: body.email.split("@")[0],
    };
    if (["history", "fresh"].includes(user.mode)) historyWallet(user);
    return Response.json(tokens(user));
  }
  const access = headers.get("Authorization")?.replace(/^Bearer /, ""),
    user = sessions.get(access);
  if (!user) return Response.json({ message: "Invalid JWT" }, { status: 401 });
  if (url.pathname === "/auth/v1/user") return Response.json(user);
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(access);
    return new Response(null, { status: 204 });
  }
  if (user.mode === "missing")
    return Response.json(
      { code: "PGRST202", message: "Missing migration" },
      { status: 404 },
    );
  if (url.pathname === "/rest/v1/virtual_wallets")
    return Response.json(
      [...wallets.values()]
        .filter((wallet) => wallet.owner === user.id)
        .map(({ id, name, base_currency_code }) => ({
          id,
          name,
          base_currency_code,
        })),
    );
  const rpc = url.pathname.split("/").at(-1);
  if (rpc === "virtual_wallet_market")
    return Response.json({
      evaluated_at: now(),
      assets: assets.map((asset, index) => ({
        ...asset,
        quote: {
          price: "10",
          observed_at: new Date(
            Date.now() - (index === 2 ? -60000 : index ? 300000 : 10000),
          ).toISOString(),
          quality: "VALID",
          provider: "kraken",
          currency_code: "USDT",
        },
      })),
    });
  if (rpc === "virtual_wallet_create") {
    const creation = `${user.id}:${body.p_key}`;
    if (creations.has(creation)) return Response.json(creations.get(creation));
    const wallet = {
      id: randomUUID(),
      name: body.p_name,
      base_currency_code: "USDT",
      owner: user.id,
      operations: [],
      keys: new Map(),
    };
    wallets.set(wallet.id, wallet);
    creations.set(creation, wallet.id);
    if (body.p_name.startsWith("Retry") && !attempts.has(creation)) {
      attempts.add(creation);
      return Response.json({}, { status: 503 });
    }
    return Response.json(wallet.id);
  }
  const wallet = wallets.get(body.p_wallet_id);
  if (!wallet || wallet.owner !== user.id)
    return Response.json({}, { status: 403 });
  if (rpc === "virtual_wallet_state") return Response.json(state(wallet));
  if (rpc === "virtual_wallet_history")
    return Response.json({
      operations: wallet.older ? [wallet.older] : [],
      total: 51,
      next_before: null,
    });
  if (rpc === "virtual_wallet_apply") {
    if (Object.keys(body).sort().join(",") !== "p_key,p_request,p_wallet_id")
      return Response.json({ message: "Unknown RPC field" }, { status: 400 });
    const request = body.p_request;
    for (const [field, value] of Object.entries(request))
      if (
        [
          "amount",
          "quantity",
          "unit_price",
          "fees",
          "sell_quantity",
          "sell_unit_price",
          "sell_fees",
          "buy_quantity",
          "buy_unit_price",
          "buy_fees",
        ].includes(field) &&
        typeof value !== "string"
      )
        return Response.json(
          { message: "Financial number must be string" },
          { status: 400 },
        );
    const previous = wallet.keys.get(body.p_key),
      serialized = JSON.stringify(request);
    if (previous)
      return previous.request === serialized
        ? Response.json(previous.id)
        : Response.json(
            { message: "idempotency payload conflict" },
            { status: 400 },
          );
    const operation = entry(request, wallet.operations.length + 1);
    wallet.operations.push(operation);
    wallet.keys.set(body.p_key, { request: serialized, id: operation.id });
    if (request.amount === "777" && !attempts.has(body.p_key)) {
      attempts.add(body.p_key);
      return Response.json(
        { message: "Simulated lost acknowledgement after commit" },
        { status: 503 },
      );
    }
    return Response.json(operation.id);
  }
  return Response.json({}, { status: 404 });
};
