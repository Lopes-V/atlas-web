import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import type { Candle, CryptoAnalysis } from "../src/lib/contracts";
import type { QuoteLike } from "../src/lib/finance";
import {
  quantityForPercent,
  researchAnalysis,
  researchCandles,
  simulateReallocation,
  type ResearchAsset,
  type SimulationInput,
} from "../src/lib/wallet-tools";

const input: SimulationInput = {
  heldQuantity: "2",
  costBasis: "200",
  percent: "50",
  sourcePrice: "120",
  targetPrice: "50",
  sellFee: "1",
  buyFee: "1",
  sourceScenarioPct: "10",
  targetScenarioPct: "20",
};

test("reallocation computes both explicit fees, proportional basis and hypothetical values exactly", () => {
  assert.deepEqual(simulateReallocation(input), {
    status: "ready",
    reason: null,
    sourceQuantity: "1",
    grossProceeds: "120",
    costBasisSold: "100",
    totalFees: "2",
    netProceeds: "119",
    targetQuantity: "2.36",
    targetCost: "119",
    cashRemainder: "0",
    estimatedRealizedPnl: "19",
    keepScenarioValue: "132",
    swapScenarioValue: "141.6",
    scenarioDifference: "9.6",
  });
});

test("either missing fee withholds every net result without silently assuming zero", () => {
  for (const fees of [
    { sellFee: null },
    { buyFee: null },
    { sellFee: null, buyFee: null },
  ]) {
    const result = simulateReallocation({ ...input, ...fees });
    assert.equal(result.status, "fees-required");
    assert.ok(result.reason);
    assert.equal(result.grossProceeds, "120");
    assert.equal(result.sourceQuantity, "1");
    for (const key of [
      "totalFees",
      "netProceeds",
      "targetQuantity",
      "targetCost",
      "cashRemainder",
      "estimatedRealizedPnl",
      "keepScenarioValue",
      "swapScenarioValue",
      "scenarioDifference",
    ] as const)
      assert.equal(result[key], null, key);
  }
});

test("explicit zero fees are accepted and absent hypotheses produce no invented scenarios", () => {
  const result = simulateReallocation({
    ...input,
    sellFee: "0",
    buyFee: "0",
    sourceScenarioPct: null,
    targetScenarioPct: null,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.targetQuantity, "2.4");
  assert.equal(result.totalFees, "0");
  assert.equal(result.keepScenarioValue, null);
  assert.equal(result.swapScenarioValue, null);
  assert.equal(result.scenarioDifference, null);
});

test("percentage quantity preserves very large and small holdings without overselling or rounding up", () => {
  const held = "99999999999999999999.123456789012345678";
  assert.equal(quantityForPercent(held, "100"), held);
  assert.equal(
    quantityForPercent("1", "33.333333333333333333"),
    "0.333333333333333333",
  );
  assert.equal(
    quantityForPercent("0.000000000000000001", "100"),
    "0.000000000000000001",
  );
  assert.equal(quantityForPercent("0.000000000000000001", "50"), null);
  const half = quantityForPercent(held, "50")!;
  assert.ok(new Decimal(half).lte(new Decimal(held).div(2)));
});

test("simulation floors acquired quantity, retains dust cash, and rounds money half up to 18 places", () => {
  const result = simulateReallocation({
    ...input,
    heldQuantity: "1",
    costBasis: "0.000000000000000001",
    percent: "50",
    sourcePrice: "2",
    targetPrice: "3",
    sellFee: "0",
    buyFee: "0",
    sourceScenarioPct: null,
    targetScenarioPct: null,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.costBasisSold, "0.000000000000000001");
  assert.equal(result.targetQuantity, "0.333333333333333333");
  assert.equal(result.targetCost, "0.999999999999999999");
  assert.equal(result.cashRemainder, "0.000000000000000001");
});

test("invalid, unbounded and insolvent financial inputs never produce a usable simulation", () => {
  const invalid: Partial<SimulationInput>[] = [
    { heldQuantity: "0" },
    { heldQuantity: "-1" },
    { percent: "0" },
    { percent: "100.000000000000000001" },
    { sourcePrice: "NaN" },
    { targetPrice: "Infinity" },
    { sourcePrice: "1e2" },
    { costBasis: "-1" },
    { sellFee: "-0.1" },
    { buyFee: "120" },
    { sellFee: "120" },
    { sourceScenarioPct: "-100.000000000000000001" },
    { targetScenarioPct: "NaN" },
    { targetScenarioPct: "100000000000000000000" },
    { heldQuantity: "100000000000000000000" },
    {
      sourcePrice: "99999999999999999999",
      heldQuantity: "99999999999999999999",
    },
    {
      heldQuantity: "0.000000000000000001",
      sourcePrice: "0.000000000000000001",
      percent: "100",
    },
    { targetPrice: "0.000000000000000001" },
    { targetPrice: "1.0000000000000000001" },
  ];
  for (const change of invalid) {
    const result = simulateReallocation({ ...input, ...change });
    assert.equal(result.status, "invalid", JSON.stringify(change));
    assert.ok(result.reason);
    assert.equal(result.targetQuantity, null);
  }
  for (const percent of ["0", "101", "NaN", "1e1", "-1"])
    assert.equal(quantityForPercent("1", percent), null);
});

test("a total loss hypothesis is valid and remaining cash survives the swap scenario", () => {
  const result = simulateReallocation({
    ...input,
    heldQuantity: "1",
    costBasis: "1",
    percent: "100",
    sourcePrice: "1",
    targetPrice: "3",
    sellFee: "0",
    buyFee: "0",
    sourceScenarioPct: "-100",
    targetScenarioPct: "-100",
  });
  assert.equal(result.status, "ready");
  assert.equal(result.keepScenarioValue, "0");
  assert.equal(result.swapScenarioValue, "0.000000000000000001");
});

const received = Date.parse("2026-10-27T12:00:00Z");
const iso = (milliseconds: number) => new Date(milliseconds).toISOString();
const core = {
  CLOSE: "120",
  RETURN: "0.01",
  MOMENTUM_PCT: "1",
  EMA20: "119",
  EMA50: "118",
  RSI: "58",
  VOLATILITY: "0.02",
  ATR: "2",
  MAX_DRAWDOWN: "-0.1",
  TREND_DIRECTION: "1",
};
const analysis = (overrides: Partial<CryptoAnalysis> = {}): CryptoAnalysis => ({
  id: "analysis",
  interval: "15m",
  algorithm_version: "analysis-v2",
  reference_at: iso(received - 900_000),
  created_at: iso(received),
  metrics: Object.entries(core).map(([metric_name, metric_value]) => ({
    metric_name,
    metric_value,
    reference_period: 14,
  })),
  ...overrides,
});
const asset = (
  analyses: CryptoAnalysis[] = [analysis()],
  candles: Candle[] = [],
): ResearchAsset => ({
  id: "asset",
  name: "Bitcoin",
  symbol: "BTC",
  analyses,
  candles,
});
// RPC quote quality is transported as a string and validated by the helper.
const quote: QuoteLike = {
  price: "120",
  observed_at: iso(received),
  currency_code: "USDT",
  provider: "kraken",
  quality: "VALID",
};

test("research requires a fresh Kraken quote and complete closed analysis-v2 evidence", () => {
  const result = researchAnalysis(asset(), "15m", quote, received, received);
  assert.equal(result.analysis?.id, "analysis");
  assert.equal(result.direction, "up");
  assert.equal(result.reason, null);
  assert.deepEqual(result.metrics, core);
  for (const [value, expected] of [
    ["-1", "down"],
    ["0", "mixed"],
  ] as const) {
    const row = analysis({
      metrics: analysis().metrics.map((metric) =>
        metric.metric_name === "TREND_DIRECTION"
          ? { ...metric, metric_value: value }
          : metric,
      ),
    });
    assert.equal(
      researchAnalysis(asset([row]), "15m", quote, received, received)
        .direction,
      expected,
    );
  }
});

test("expired, future, invalid and non-Kraken quotes withhold analysis", () => {
  for (const q of [
    null,
    { ...quote, provider: "other" },
    { ...quote, currency_code: "USD" },
    { ...quote, quality: "STALE" as const },
    { ...quote, price: "0" },
    { ...quote, price: "NaN" },
    { ...quote, observed_at: iso(received + 1) },
    { ...quote, observed_at: iso(received - 120_001) },
  ]) {
    const result = researchAnalysis(asset(), "15m", q, received, received);
    assert.equal(result.analysis, null);
    assert.equal(result.direction, "unavailable");
    assert.ok(result.reason);
    assert.deepEqual(result.metrics, {});
  }
  assert.ok(
    researchAnalysis(
      asset(),
      "15m",
      { ...quote, observed_at: iso(received - 120_000) },
      received,
      received,
    ).analysis,
  );
});

test("latest unusable analysis never falls back to older favorable evidence", () => {
  const older = analysis({
    id: "older",
    reference_at: iso(received - 1_800_000),
    created_at: iso(received - 900_000),
  });
  const newer = analysis({
    id: "newer",
    reference_at: iso(received - 600_000),
  });
  assert.equal(
    researchAnalysis(asset([older, newer]), "15m", quote, received, received)
      .analysis,
    null,
  );
  const missing = analysis({
    metrics: analysis().metrics.filter((row) => row.metric_name !== "RSI"),
  });
  assert.equal(
    researchAnalysis(asset([older, missing]), "15m", quote, received, received)
      .analysis,
    null,
  );
});

test("research rejects stale, open, future-created, premature and invalid analysis records", () => {
  for (const row of [
    analysis({ reference_at: iso(received - 1_920_001) }),
    analysis({ reference_at: iso(received - 899_999) }),
    analysis({ created_at: iso(received + 1) }),
    analysis({ created_at: iso(received - 1) }),
    analysis({ reference_at: "invalid" }),
    analysis({ created_at: "invalid" }),
    analysis({ algorithm_version: "analysis-v1" }),
    analysis({
      metrics: analysis().metrics.map((metric) =>
        metric.metric_name === "TREND_DIRECTION"
          ? { ...metric, metric_value: "2" }
          : metric,
      ),
    }),
    analysis({
      metrics: analysis().metrics.map((metric) =>
        metric.metric_name === "ATR"
          ? { ...metric, metric_value: "Infinity" }
          : metric,
      ),
    }),
    analysis({ metrics: [...analysis().metrics, analysis().metrics[0]] }),
  ])
    assert.equal(
      researchAnalysis(asset([row]), "15m", quote, received, received).analysis,
      null,
      JSON.stringify(row),
    );
  assert.equal(
    researchAnalysis(
      asset([analysis(), analysis()]),
      "15m",
      quote,
      received,
      received,
    ).analysis,
    null,
  );
  assert.equal(
    researchAnalysis(asset(), "15m", quote, received - 1, received).analysis,
    null,
  );
});

test("each interval uses its own exact freshness and closure boundary", () => {
  const row = analysis({
    interval: "1h",
    reference_at: iso(received - 3_600_000),
  });
  assert.ok(
    researchAnalysis(asset([row]), "1h", quote, received, received).analysis,
  );
  assert.equal(
    researchAnalysis(asset([row]), "15m", quote, received, received).analysis,
    null,
  );
  const oldest = analysis({
    interval: "1h",
    reference_at: iso(received - 7_320_000),
  });
  assert.ok(
    researchAnalysis(asset([oldest]), "1h", quote, received, received).analysis,
  );
  assert.equal(
    researchAnalysis(
      asset([oldest]),
      "1h",
      { ...quote, observed_at: iso(received + 1) },
      received + 1,
      received + 1,
    ).analysis,
    null,
  );
});

const candle = (offset: number, changes: Partial<Candle> = {}): Candle => ({
  observed_at: iso(received + offset),
  close: "120",
  provider: "kraken",
  quality: "VALID",
  ...changes,
});
test("candles are closed 15m Kraken rows in time order with actual gaps and no mutation", () => {
  const rows = [candle(-900_000), candle(-3_600_000), candle(-1_800_000)];
  assert.deepEqual(researchCandles(asset([], rows), received), [
    rows[1],
    rows[2],
    rows[0],
  ]);
  assert.equal(rows[0].observed_at, iso(received - 900_000));
});

test("open, invalid, duplicate and foreign-provider candles never become chart evidence", () => {
  const good = candle(-900_000);
  const duplicate = candle(-1_800_000);
  const rows = [
    good,
    candle(-899_999),
    candle(1),
    candle(-3_600_000, { close: "0" }),
    candle(-4_500_000, { close: "-1" }),
    candle(-5_400_000, { close: "Infinity" }),
    candle(-6_300_000, { close: "NaN" }),
    candle(-7_200_000, { provider: "other" }),
    candle(-8_100_000, { quality: "STALE" }),
    candle(-9_000_000, { observed_at: "invalid" }),
    duplicate,
    { ...duplicate, close: "121" },
  ];
  assert.deepEqual(researchCandles(asset([], rows), received), [good]);
  assert.deepEqual(researchCandles(asset([], rows), NaN), []);
});
