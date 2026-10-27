"use client";
import {
  researchAnalysis,
  researchCandles,
  type WalletResearch,
} from "@/lib/wallet-tools";
import type { Market } from "@/lib/virtual-contracts";
import { dateTime, percent } from "@/lib/finance";
import Decimal from "decimal.js";

export function WalletResearchPanel({
  research,
  market,
  now,
  hidden,
}: {
  research?: WalletResearch;
  market: Market | null;
  now: number;
  hidden: boolean;
}) {
  if (!research || research.error || !research.assets.length)
    return (
      <section className="virtual-panel">
        <h2>Contexto de mercado</h2>
        <p>
          Pesquisa de mercado indisponível. Sua carteira continua disponível.
        </p>
      </section>
    );
  const received = Date.parse(research.fetchedAt);
  return (
    <section className="virtual-panel">
      <details>
        <summary>Contexto de mercado</summary>
        <p>Dados descritivos de candles fechados; não são recomendações.</p>
        {research.assets.map((asset) => {
          const quote = market?.assets.find((a) => a.id === asset.id)?.quote;
          const analyses = (["15m", "1h"] as const).map((interval) => ({
            interval,
            ...researchAnalysis(asset, interval, quote, now, received),
          }));
          const candles = researchCandles(asset, received).slice(-96);
          return (
            <article key={asset.id}>
              <p>
                {analyses.some((a) => !a.analysis)
                  ? "Alinhamento indisponível"
                  : analyses[0].direction === analyses[1].direction
                    ? "Intervalos alinhados"
                    : "Intervalos divergentes"}
              </p>
              <h3>
                {asset.symbol} · {asset.name}
              </h3>
              {analyses.map((a) => (
                <p key={a.interval}>
                  {a.interval}:{" "}
                  {a.analysis ? (
                    <>
                      {a.direction === "up"
                        ? "alta"
                        : a.direction === "down"
                          ? "baixa"
                          : "mista"}{" "}
                      · RSI {hidden ? "••••••" : a.metrics.RSI} · volatilidade{" "}
                      {hidden
                        ? "••••••"
                        : percent(
                            new Decimal(a.metrics.VOLATILITY)
                              .times(100)
                              .toFixed(),
                            false,
                          )}{" "}
                      · ATR (USDT) {hidden ? "••••••" : a.metrics.ATR} ·{" "}
                      {dateTime(a.analysis.reference_at)} · analysis-v2
                    </>
                  ) : (
                    a.reason
                  )}
                </p>
              ))}
              <details>
                <summary>Histórico de preços fechados · Kraken</summary>
                {hidden ? (
                  <p>••••••</p>
                ) : candles.length ? (
                  <ol className="candle-history">
                    {candles.map((c, index) => (
                      <li key={c.observed_at}>
                        {index > 0 &&
                          Date.parse(c.observed_at) -
                            Date.parse(candles[index - 1].observed_at) !==
                            900000 && <strong>Intervalo sem dados · </strong>}
                        {dateTime(c.observed_at)} · {c.close} USDT
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Histórico indisponível.</p>
                )}
              </details>
            </article>
          );
        })}
      </details>
    </section>
  );
}
