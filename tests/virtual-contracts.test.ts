import { test } from "node:test";
import assert from "node:assert/strict";
import {
  operationSchema,
  safeReturnTo,
  usableQuote,
} from "../src/lib/virtual-contracts";
const at = "2026-01-01T12:00:00.000Z";
const asset = "00000000-0000-4000-8000-000000000001";
test("financial requests preserve exact decimal strings and reject numbers, overflow, excess scale and unknown ownership", () => {
  const value = {
    kind: "DEPOSIT",
    occurred_at: at,
    amount: "12345678901234567890.123456789012345678",
  };
  assert.deepEqual(operationSchema.parse(value), value);
  for (const amount of [
    10,
    "1e2",
    "-1",
    "0",
    "1.0000000000000000001",
    "123456789012345678901",
  ])
    assert.equal(
      operationSchema.safeParse({ ...value, amount }).success,
      false,
    );
  assert.equal(
    operationSchema.safeParse({ ...value, owner_id: asset }).success,
    false,
  );
});
test("trades require explicit fees and swaps require both complete legs", () => {
  const trade = {
    kind: "BUY",
    occurred_at: at,
    asset_id: asset,
    quantity: "0.000000000000000001",
    unit_price: "2",
    fees: "0",
  };
  assert.equal(operationSchema.safeParse(trade).success, true);
  assert.equal(
    operationSchema.safeParse({ ...trade, fees: undefined }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({
      kind: "SWAP",
      occurred_at: at,
      sell_asset_id: asset,
    }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({ ...trade, occurred_at: "2999-01-01T00:00:00Z" })
      .success,
    false,
  );
});
test("return destination stays under the individual wallet and quotes expire at 120 seconds", () => {
  for (const path of [
    "https://evil.test/virtual",
    "//evil.test",
    "/login",
    "/virtual/../login",
    "/virtual\\evil",
    "/virtual?x=\n",
  ])
    assert.equal(safeReturnTo(path), "/virtual");
  assert.equal(safeReturnTo("/virtual?carteira=abc"), "/virtual");
  assert.equal(
    safeReturnTo(`/virtual?carteira=${asset}`),
    `/virtual?carteira=${asset}`,
  );
  const quote = {
    price: "2",
    observed_at: at,
    quality: "VALID",
    provider: "kraken",
    currency_code: "USDT",
  };
  const now = Date.parse(at);
  assert.equal(usableQuote(quote, now), true);
  assert.equal(usableQuote(quote, now + 120001), false);
  assert.equal(usableQuote(quote, now - 1), false);
  assert.equal(usableQuote({ ...quote, price: 2 }, now), false);
});

test("local date picker preserves the users timezone in the ISO transport", async () => {
  const { localInputToISO } = await import("../src/lib/virtual-contracts");
  const previous = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    assert.equal(
      localInputToISO("2026-01-01T12:00"),
      "2026-01-01T15:00:00.000Z",
    );
    assert.equal(localInputToISO("invalid"), "");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("same-origin renewal compares the browser origin to the request host, including its port", async () => {
  const { sameOrigin, virtualMoney } =
    await import("../src/lib/virtual-contracts");
  assert.equal(
    sameOrigin("http://127.0.0.1:3102", "127.0.0.1:3102", "http:"),
    true,
  );
  assert.equal(
    sameOrigin("https://evil.example", "127.0.0.1:3102", "http:"),
    false,
  );
  assert.equal(sameOrigin(null, "127.0.0.1:3102", "http:"), false);
  assert.equal(
    virtualMoney("12345678901234567890.125"),
    "12.345.678.901.234.567.890,13 USDT",
  );
});
