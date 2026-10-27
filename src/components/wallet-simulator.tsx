"use client";
import { useState } from "react";
import { simulateReallocation } from "@/lib/wallet-tools";
import {
  usableQuote,
  type Market,
  type WalletState,
} from "@/lib/virtual-contracts";

export function WalletSimulator({
  state,
  market,
  now,
  hidden,
  onPrepare,
  selection,
}: {
  state: WalletState;
  market: Market | null;
  now: number;
  hidden: boolean;
  onPrepare: (values: Record<string, string>) => void;
  selection: { id: string; serial: number } | null;
}) {
  const [source, setSource] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [seenSelection, setSeenSelection] = useState(selection);
  if (selection !== seenSelection) {
    setSeenSelection(selection);
    if (selection) {
      setSource(selection.id);
      setExpanded(true);
    }
  }
  const [target, setTarget] = useState("");
  const [portion, setPortion] = useState("25");
  const [sellFee, setSellFee] = useState("");
  const [buyFee, setBuyFee] = useState("");
  const [sourceHypothesis, setSourceHypothesis] = useState("");
  const [targetHypothesis, setTargetHypothesis] = useState("");
  const position = state.positions.find((p) => p.asset_id === source);
  const sellQuote = market?.assets.find((a) => a.id === source)?.quote;
  const buyQuote = market?.assets.find((a) => a.id === target)?.quote;
  const fresh =
    !!market &&
    source !== target &&
    !!sellQuote &&
    !!buyQuote &&
    [sellQuote, buyQuote].every(
      (q) =>
        usableQuote(q, Date.parse(market.evaluated_at)) && usableQuote(q, now),
    );
  const result =
    fresh && position && sellQuote && buyQuote
      ? simulateReallocation({
          heldQuantity: position.quantity,
          costBasis: position.cost_basis,
          percent: portion,
          sourcePrice: sellQuote.price,
          targetPrice: buyQuote.price,
          sellFee: sellFee || null,
          buyFee: buyFee || null,
          sourceScenarioPct: sourceHypothesis || null,
          targetScenarioPct: targetHypothesis || null,
        })
      : null;
  const field = (label: string, value: string, change: (v: string) => void) => (
    <label>
      {label}
      <input
        type={hidden ? "password" : "text"}
        inputMode="decimal"
        value={value}
        onChange={(e) => change(e.target.value)}
        autoComplete="off"
      />
    </label>
  );
  return (
    <section className="virtual-panel">
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>Simular troca</summary>
        <p>
          Estimativa somente para leitura; hipóteses não incluem taxas de saída
          futuras. Informe as duas taxas e, se desejar, hipóteses de variação.
          Nenhuma operação é registrada aqui.
        </p>
        <div className="virtual-form">
          <div className="virtual-fields">
            <label>
              Posição de origem
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Selecione</option>
                {state.positions.map((p) => (
                  <option key={p.asset_id} value={p.asset_id}>
                    {p.symbol} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ativo de destino
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Selecione</option>
                {market?.assets
                  .filter((a) => a.id !== source)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.symbol} — {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Percentual da posição
              <select
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
              >
                {["10", "25", "50", "100"].map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </label>
            {field("Taxa de venda (USDT)", sellFee, setSellFee)}
            {field("Taxa de compra (USDT)", buyFee, setBuyFee)}
            {field(
              "Hipótese origem (%)",
              sourceHypothesis,
              setSourceHypothesis,
            )}
            {field(
              "Hipótese destino (%)",
              targetHypothesis,
              setTargetHypothesis,
            )}
          </div>
          {!fresh ? (
            <p role="status">
              Cotações Kraken atuais indisponíveis para simular.
            </p>
          ) : (
            result?.reason && <p role="status">{result.reason}</p>
          )}
          {result && (
            <dl className="simulation-results">
              {[
                ["Quantidade vendida", result.sourceQuantity],
                ["Venda bruta (USDT)", result.grossProceeds],
                ["Taxas totais (USDT)", result.totalFees],
                ["Venda líquida (USDT)", result.netProceeds],
                ["Quantidade de destino", result.targetQuantity],
                ["Custo de compra (USDT)", result.targetCost],
                ["Saldo restante (USDT)", result.cashRemainder],
                [
                  "Ganho realizado estimado (USDT)",
                  result.estimatedRealizedPnl,
                ],
                ["Manter sob hipótese (USDT)", result.keepScenarioValue],
                ["Trocar sob hipótese (USDT)", result.swapScenarioValue],
                ["Diferença sob hipóteses (USDT)", result.scenarioDifference],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{hidden ? "••••••" : (value ?? "Indisponível")}</dd>
                </div>
              ))}
            </dl>
          )}
          <button
            type="button"
            className="button primary"
            disabled={!fresh || result?.status !== "ready"}
            onClick={() => {
              if (
                !result ||
                !sellQuote ||
                !buyQuote ||
                !result.sourceQuantity ||
                !result.targetQuantity
              )
                return;
              onPrepare({
                sell_asset_id: source,
                sell_quantity: result.sourceQuantity,
                sell_unit_price: sellQuote.price,
                sell_fees: sellFee,
                buy_asset_id: target,
                buy_quantity: result.targetQuantity,
                buy_unit_price: buyQuote.price,
                buy_fees: buyFee,
              });
            }}
          >
            Preparar troca
          </button>
        </div>
      </details>
    </section>
  );
}
