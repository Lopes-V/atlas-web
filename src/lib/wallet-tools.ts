import Decimal from "decimal.js";
import type { Candle, CryptoAnalysis, Quote } from "./contracts";
import { decimal, signedDecimal, usableQuote } from "./virtual-contracts";

// A local constructor leaves the accounting core and other Decimal callers untouched.
const Exact = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });

export type SimulationInput = {
  heldQuantity: string;
  costBasis: string;
  percent: string;
  sourcePrice: string;
  targetPrice: string;
  sellFee: string | null;
  buyFee: string | null;
  sourceScenarioPct: string | null;
  targetScenarioPct: string | null;
};
export type SimulationResult = {
  status: "ready" | "fees-required" | "invalid";
  reason: string | null;
  sourceQuantity: string | null;
  grossProceeds: string | null;
  costBasisSold: string | null;
  totalFees: string | null;
  netProceeds: string | null;
  targetQuantity: string | null;
  targetCost: string | null;
  cashRemainder: string | null;
  estimatedRealizedPnl: string | null;
  keepScenarioValue: string | null;
  swapScenarioValue: string | null;
  scenarioDifference: string | null;
};
export type ResearchAsset = {
  id: string;
  symbol: string;
  name: string;
  analyses: CryptoAnalysis[];
  candles: Candle[];
};
export type WalletResearch = {
  fetchedAt: string;
  assets: ResearchAsset[];
  error: string | null;
};

function bounded(value: unknown, signed = false): Decimal | null {
  const parsed = (signed ? signedDecimal : decimal).safeParse(value);
  return parsed.success ? new Exact(parsed.data) : null;
}

function money(value: Decimal): string {
  const result = value.toDecimalPlaces(18, Decimal.ROUND_HALF_UP).toFixed();
  if (!signedDecimal.safeParse(result).success)
    throw new Error("O resultado excede os limites de precisão da carteira.");
  return result;
}

function quantity(value: Decimal): string | null {
  const result = value.toDecimalPlaces(18, Decimal.ROUND_FLOOR).toFixed();
  return decimal.safeParse(result).success && new Exact(result).gt(0)
    ? result
    : null;
}

export function quantityForPercent(
  heldQuantity: string,
  percent: string,
): string | null {
  const held = bounded(heldQuantity),
    portion = bounded(percent);
  if (!held?.gt(0) || !portion?.gt(0) || portion.gt(100)) return null;
  return quantity(held.times(portion).div(100));
}

function emptySimulation(reason: string): SimulationResult {
  return {
    status: "invalid",
    reason,
    sourceQuantity: null,
    grossProceeds: null,
    costBasisSold: null,
    totalFees: null,
    netProceeds: null,
    targetQuantity: null,
    targetCost: null,
    cashRemainder: null,
    estimatedRealizedPnl: null,
    keepScenarioValue: null,
    swapScenarioValue: null,
    scenarioDifference: null,
  };
}

export function simulateReallocation(input: SimulationInput): SimulationResult {
  const result = emptySimulation(
    "Informe quantidades e preços positivos e percentual entre 0 e 100.",
  );
  const held = bounded(input.heldQuantity),
    basis = bounded(input.costBasis);
  const sourcePrice = bounded(input.sourcePrice),
    targetPrice = bounded(input.targetPrice);
  const sourceQuantity = quantityForPercent(input.heldQuantity, input.percent);
  const sellFee = input.sellFee === null ? null : bounded(input.sellFee);
  const buyFee = input.buyFee === null ? null : bounded(input.buyFee);
  const sourceScenario =
    input.sourceScenarioPct === null
      ? null
      : bounded(input.sourceScenarioPct, true);
  const targetScenario =
    input.targetScenarioPct === null
      ? null
      : bounded(input.targetScenarioPct, true);
  if (
    !held?.gt(0) ||
    !basis ||
    !sourcePrice?.gt(0) ||
    !targetPrice?.gt(0) ||
    !sourceQuantity
  )
    return result;
  if (
    (input.sellFee !== null && !sellFee) ||
    (input.buyFee !== null && !buyFee)
  )
    return emptySimulation(
      "Informe taxas explícitas maiores ou iguais a zero.",
    );
  if (
    (input.sourceScenarioPct !== null &&
      (!sourceScenario || sourceScenario.lt(-100))) ||
    (input.targetScenarioPct !== null &&
      (!targetScenario || targetScenario.lt(-100)))
  )
    return emptySimulation(
      "Informe hipóteses decimais válidas, a partir de -100%.",
    );

  try {
    const sold = new Exact(sourceQuantity);
    const gross = new Exact(money(sold.times(sourcePrice)));
    if (!gross.gt(0))
      return emptySimulation(
        "O valor da venda é menor que a precisão permitida.",
      );
    result.sourceQuantity = sourceQuantity;
    result.grossProceeds = gross.toFixed();
    result.costBasisSold = money(basis.times(sold).div(held));
    if (!sellFee || !buyFee)
      return {
        ...result,
        status: "fees-required",
        reason:
          "Informe as taxas de venda e compra para calcular os resultados líquidos.",
      };

    const net = gross.minus(sellFee),
      available = net.minus(buyFee);
    if (!available.gt(0))
      return emptySimulation(
        "As taxas consomem o valor disponível para a compra.",
      );
    const acquired = quantity(available.div(targetPrice));
    if (!acquired)
      return emptySimulation(
        "A quantidade de destino está fora dos limites da carteira.",
      );
    const targetCost = new Exact(
      money(new Exact(acquired).times(targetPrice).plus(buyFee)),
    );
    const remainder = net.minus(targetCost);
    if (remainder.lt(0))
      return emptySimulation("O custo de compra excede o valor disponível.");
    const keep =
      sourceScenario === null
        ? null
        : money(gross.times(sourceScenario.div(100).plus(1)));
    const swap =
      targetScenario === null
        ? null
        : money(
            new Exact(acquired)
              .times(targetPrice)
              .times(targetScenario.div(100).plus(1))
              .plus(remainder),
          );
    return {
      ...result,
      status: "ready",
      reason: null,
      totalFees: money(sellFee.plus(buyFee)),
      netProceeds: money(net),
      targetQuantity: acquired,
      targetCost: targetCost.toFixed(),
      cashRemainder: money(remainder),
      estimatedRealizedPnl: money(net.minus(result.costBasisSold!)),
      keepScenarioValue: keep,
      swapScenarioValue: swap,
      scenarioDifference:
        keep === null || swap === null
          ? null
          : money(new Exact(swap).minus(keep)),
    };
  } catch {
    return emptySimulation(
      "O resultado excede os limites de precisão da carteira.",
    );
  }
}

const intervals = { "15m": 900_000, "1h": 3_600_000 } as const;
const core = [
  "CLOSE",
  "RETURN",
  "MOMENTUM_PCT",
  "EMA20",
  "EMA50",
  "RSI",
  "VOLATILITY",
  "ATR",
  "MAX_DRAWDOWN",
  "TREND_DIRECTION",
];
type AnalysisResult = {
  analysis: CryptoAnalysis | null;
  direction: "up" | "down" | "mixed" | "unavailable";
  reason: string | null;
  metrics: Record<string, string>;
};
const unavailable = (reason: string): AnalysisResult => ({
  analysis: null,
  direction: "unavailable",
  reason,
  metrics: {},
});

export function researchAnalysis(
  asset: ResearchAsset,
  interval: "15m" | "1h",
  quote: Quote | null | undefined,
  now: number,
  receivedAt: number,
): AnalysisResult {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(receivedAt) ||
    now < receivedAt ||
    !usableQuote(quote, now) ||
    Date.parse(quote!.observed_at) > receivedAt
  )
    return unavailable("Cotação Kraken válida e atual indisponível.");
  const candidates = asset.analyses.filter(
    (row) =>
      row.interval === interval && row.algorithm_version === "analysis-v2",
  );
  if (!candidates.length)
    return unavailable("Análise atual indisponível para este intervalo.");
  // Malformed or ambiguous latest evidence cannot make an older signal current.
  if (candidates.some((row) => !Number.isFinite(Date.parse(row.reference_at))))
    return unavailable("Referência da análise inválida.");
  const ordered = [...candidates].sort(
    (a, b) => Date.parse(b.reference_at) - Date.parse(a.reference_at),
  );
  const latest = ordered[0],
    reference = Date.parse(latest.reference_at),
    created = Date.parse(latest.created_at);
  if (ordered[1] && Date.parse(ordered[1].reference_at) === reference)
    return unavailable("Análise duplicada para a mesma referência.");
  const duration = intervals[interval];
  if (
    !Number.isFinite(created) ||
    reference + duration > receivedAt ||
    created < reference + duration ||
    created > receivedAt ||
    now - reference > 2 * duration + 120_000
  )
    return unavailable("Análise fora da janela de candles fechados e atuais.");
  const metrics: Record<string, string> = Object.create(null);
  for (const metric of latest.metrics) {
    if (
      Object.hasOwn(metrics, metric.metric_name) ||
      !bounded(metric.metric_value, true)
    )
      return unavailable("Métricas inválidas ou duplicadas.");
    metrics[metric.metric_name] = metric.metric_value;
  }
  if (core.some((key) => !Object.hasOwn(metrics, key)))
    return unavailable("Métricas essenciais indisponíveis.");
  const direction = new Exact(metrics.TREND_DIRECTION);
  if (!direction.eq(-1) && !direction.eq(0) && !direction.eq(1))
    return unavailable("Direção da análise inválida.");
  return {
    analysis: latest,
    direction: direction.eq(1) ? "up" : direction.eq(-1) ? "down" : "mixed",
    reason: null,
    metrics: { ...metrics },
  };
}

export function researchCandles(
  asset: ResearchAsset,
  receivedAt: number,
): Candle[] {
  if (!Number.isFinite(receivedAt)) return [];
  const counts = new Map<number, number>();
  for (const row of asset.candles) {
    const at = Date.parse(row.observed_at);
    counts.set(at, (counts.get(at) ?? 0) + 1);
  }
  // Preserve timestamps: consumers can split chart paths wherever a 15m slot is absent.
  return asset.candles
    .filter((row) => {
      const at = Date.parse(row.observed_at),
        close = bounded(row.close);
      return (
        Number.isFinite(at) &&
        counts.get(at) === 1 &&
        at + intervals["15m"] <= receivedAt &&
        row.provider.toLowerCase() === "kraken" &&
        row.quality === "VALID" &&
        close?.gt(0)
      );
    })
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}
