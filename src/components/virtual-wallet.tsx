"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createWalletAction,
  historyAction,
  recordOperationAction,
} from "@/app/virtual/actions";
import { usePreference } from "@/lib/preferences";
import { percent } from "@/lib/finance";
import { quantityForPercent, type WalletResearch } from "@/lib/wallet-tools";
import { WalletSimulator } from "./wallet-simulator";
import { WalletResearchPanel } from "./wallet-research-panel";
import {
  usableQuote,
  localInputToISO,
  virtualMoney,
  type Market,
  type Wallet,
  type WalletHistory,
  type WalletState,
} from "@/lib/virtual-contracts";

type Entry = WalletHistory["operations"][number];
const names = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retirada",
  BUY: "Compra",
  SELL: "Venda",
  SWAP: "Troca",
  FEE: "Taxa avulsa",
  REVERSAL: "Estorno",
};
export function VirtualWallet({
  wallets,
  state,
  market,
  createKey,
  operationKey,
  research,
  writesPaused = false,
}: {
  wallets: Wallet[];
  state: WalletState | null;
  market: Market | null;
  createKey: string;
  operationKey: string;
  research?: WalletResearch;
  writesPaused?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [privacy, setPrivacy] = usePreference("virtual:hidden", "false"),
    hidden = privacy === "true";
  const [now, setNow] = useState(() =>
    Date.parse(
      market?.evaluated_at ?? state?.evaluated_at ?? new Date().toISOString(),
    ),
  );
  useEffect(() => {
    const baseline = Date.parse(
        state?.evaluated_at ?? market?.evaluated_at ?? new Date().toISOString(),
      ),
      started = performance.now();
    const clock = window.setInterval(
      () => setNow(baseline + performance.now() - started),
      1000,
    );
    return () => clearInterval(clock);
  }, [state?.evaluated_at, market?.evaluated_at]);
  useEffect(() => {
    const refresh = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && !pending)
        startTransition(() => router.refresh());
    }, 30_000);
    return () => clearInterval(refresh);
  }, [router, pending]);
  const display = (value: string | null | undefined) =>
    hidden ? "••••••" : value == null ? "Indisponível" : virtualMoney(value);
  const complete =
    !!state?.valuation_complete &&
    state.positions.every(
      (position) =>
        position.price !== null &&
        position.observed_at !== null &&
        now - Date.parse(position.observed_at) >= 0 &&
        now - Date.parse(position.observed_at) <= 120000,
    );
  const [reversal, setReversal] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(wallets.length === 0);
  const [simSource, setSimSource] = useState<{
    id: string;
    serial: number;
  } | null>(null);
  const [request, setRequest] = useState<{
    kind: string;
    asset?: string;
    values?: Record<string, string>;
    serial: number;
  } | null>(null);
  const openAction = (
    kind: string,
    asset?: string,
    values?: Record<string, string>,
  ) => {
    setRequest({ kind, asset, values, serial: Date.now() });
    setOpen(true);
  };
  return (
    <>
      <div className="virtual-toolbar">
        <div className="virtual-wallet-links" aria-label="Suas carteiras">
          {wallets.map((wallet) => (
            <Link
              key={wallet.id}
              href={`/virtual?carteira=${wallet.id}`}
              aria-current={wallet.id === state?.wallet.id ? "page" : undefined}
            >
              {wallet.name}
            </Link>
          ))}
        </div>
        <div>
          <button
            className="toolbar-button"
            onClick={() => setPrivacy(String(!hidden))}
            aria-pressed={hidden}
          >
            {hidden ? "Exibir valores" : "Ocultar valores"}
          </button>
          <button
            className="toolbar-button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
          >
            {pending ? "Atualizando…" : "Atualizar cotações"}
          </button>
        </div>
      </div>
      {state ? (
        <>
          <section className="virtual-panel">
            <p className="eyebrow">{state.wallet.name} · USDT</p>
            <h2>{complete ? "Patrimônio virtual" : "Patrimônio incompleto"}</h2>
            <div className="virtual-total">
              {complete ? display(state.market_value) : "Indisponível"}
            </div>
            {!complete && (
              <p role="status">
                Há posições sem cotação válida, recente ou disponível. Valor
                parcial conhecido na última avaliação:{" "}
                {display(state.known_market_value)}. Posições sem preço não
                valem zero.
              </p>
            )}
            <div className="wallet-actions">
              <button
                className="button primary"
                onClick={() => openAction("DEPOSIT")}
              >
                Adicionar saldo
              </button>
              <button className="button" onClick={() => openAction("BUY")}>
                Comprar
              </button>
              <button className="button" onClick={() => openAction("SWAP")}>
                Trocar
              </button>
              <button
                className="button"
                onClick={() => openAction("WITHDRAWAL")}
              >
                Retirar
              </button>
            </div>
            <div className="virtual-stats">
              <div>
                <span>Caixa disponível</span>
                <strong>{display(state.cash)}</strong>
              </div>
              <div>
                <span>Ganho não realizado</span>
                <strong>
                  {display(complete ? state.unrealized_pnl : null)}
                </strong>
              </div>
            </div>
            <details>
              <summary>Detalhes contábeis</summary>
              <div className="virtual-stats">
                {[
                  ["Aportes líquidos", state.net_contributions],
                  ["Ganho realizado", state.realized_pnl],
                  ["Custo das posições", state.cost_basis],
                  ["Taxas acumuladas", state.fees],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{display(value)}</strong>
                  </div>
                ))}
              </div>
              <p className="muted">
                Aportes e retiradas são fluxos de caixa, não lucro. Cálculos do
                livro virtual; custo médio inclui taxas. Avaliado em{" "}
                {new Date(state.evaluated_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
                .
              </p>
            </details>
          </section>
          <section className="virtual-panel" id="posicoes">
            <h2>Posições atuais</h2>
            {!state.positions.length ? (
              <p>Nenhuma posição. Registre um depósito antes de comprar.</p>
            ) : (
              <div className="virtual-position-grid">
                {state.positions.map((position) => {
                  const fresh =
                    position.price !== null &&
                    position.observed_at !== null &&
                    now - Date.parse(position.observed_at) >= 0 &&
                    now - Date.parse(position.observed_at) <= 120000;
                  return (
                    <article
                      className="virtual-position"
                      key={position.asset_id}
                    >
                      <h3>{position.symbol}</h3>
                      <p>{position.name}</p>
                      <dl>
                        <dt>Quantidade</dt>
                        <dd>{hidden ? "••••••" : position.quantity}</dd>
                        <dt>Preço médio</dt>
                        <dd>{display(position.average_cost)}</dd>
                        <dt>Custo remanescente</dt>
                        <dd>{display(position.cost_basis)}</dd>
                        <dt>Preço atual</dt>
                        <dd>
                          {fresh
                            ? display(position.price)
                            : "Cotação indisponível"}
                        </dd>
                        <dt>Valor da posição</dt>
                        <dd>
                          {fresh
                            ? display(position.market_value)
                            : "Cotação indisponível"}
                        </dd>
                        <dt>Ganho da posição</dt>
                        <dd>
                          {fresh
                            ? display(position.unrealized_pnl)
                            : "Indisponível"}
                          {fresh &&
                            position.unrealized_pnl_pct != null &&
                            !hidden &&
                            ` (${percent(position.unrealized_pnl_pct)})`}
                        </dd>
                        <dt>Concentração</dt>
                        <dd>
                          {complete && position.concentration_pct !== null
                            ? hidden
                              ? "••••••"
                              : percent(position.concentration_pct, false)
                            : "Indisponível"}
                        </dd>
                      </dl>
                      <div className="wallet-actions">
                        <button
                          className="button"
                          onClick={() => openAction("SELL", position.asset_id)}
                        >
                          Vender {position.symbol}
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            setSimSource({
                              id: position.asset_id,
                              serial: Date.now(),
                            })
                          }
                        >
                          Simular {position.symbol}
                        </button>
                        <button
                          className="button"
                          onClick={() => openAction("BUY", position.asset_id)}
                        >
                          Comprar {position.symbol}
                        </button>
                      </div>
                      <small>
                        Fonte: Kraken ·{" "}
                        {position.observed_at
                          ? new Date(position.observed_at).toLocaleString(
                              "pt-BR",
                              { timeZone: "America/Sao_Paulo" },
                            )
                          : "Sem observação"}{" "}
                        · limite 120s
                      </small>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <OperationForm
            key={state.wallet.id}
            walletId={state.wallet.id}
            initialKey={operationKey}
            market={market}
            reversal={reversal}
            hidden={hidden}
            writesPaused={writesPaused}
            operations={state.operations}
            positions={state.positions}
            open={open}
            onClose={() => setOpen(false)}
            request={request}
            now={now}
          />
          <WalletSimulator
            selection={simSource}
            state={state}
            market={market}
            now={now}
            hidden={hidden}
            onPrepare={(values) => openAction("SWAP", undefined, values)}
          />
          <WalletResearchPanel
            research={research}
            market={market}
            now={now}
            hidden={hidden}
          />
          <History
            key={`${state.wallet.id}:${state.operations[0]?.id ?? "empty"}`}
            state={state}
            hidden={hidden}
            market={market}
            onReverse={(entry) => {
              setReversal(entry);
              setOpen(true);
              document
                .getElementById("registro")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </>
      ) : (
        <section className="virtual-panel">
          <p className="eyebrow">Comece pelo seu registro</p>
          <h2>Uma carteira vazia, pronta para você.</h2>
          <p>
            Crie uma carteira USDT e declare seus depósitos e operações. Nenhum
            saldo será preenchido automaticamente.
          </p>
        </section>
      )}
      <section className="virtual-panel">
        <details
          open={creationOpen}
          onToggle={(event) => setCreationOpen(event.currentTarget.open)}
        >
          <summary>
            {wallets.length ? "Criar outra carteira" : "Sua primeira carteira"}
          </summary>
          <CreateWallet initialKey={createKey} writesPaused={writesPaused} />
        </details>
      </section>
    </>
  );
}
function CreateWallet({
  initialKey,
  writesPaused,
}: {
  initialKey: string;
  writesPaused: boolean;
}) {
  const [result, action, pending] = useActionState(createWalletAction, {});
  const [stableKey] = useState(initialKey),
    [name, setName] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (result.walletId) router.replace(`/virtual?carteira=${result.walletId}`);
  }, [result.walletId, router]);
  return (
    <form action={action} className="virtual-form">
      <fieldset className="virtual-draft" disabled={writesPaused}>
        <input type="hidden" name="key" value={result.key ?? stableKey} />
        <label>
          Nome da carteira
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            placeholder="Minha carteira USDT"
          />
        </label>
        {result.error && (
          <p role="alert" className="form-error">
            {result.error}
          </p>
        )}
        <button className="button primary" disabled={pending || writesPaused}>
          {pending ? "Criando…" : "Criar carteira USDT"}
        </button>
      </fieldset>
    </form>
  );
}
function OperationForm({
  walletId,
  initialKey,
  market,
  reversal,
  hidden,
  writesPaused,
  operations,
  positions,
  open,
  onClose,
  request,
  now,
}: {
  walletId: string;
  initialKey: string;
  market: Market | null;
  reversal: Entry | null;
  hidden: boolean;
  writesPaused: boolean;
  operations: Entry[];
  positions: WalletState["positions"];
  open: boolean;
  onClose: () => void;
  request: {
    kind: string;
    asset?: string;
    values?: Record<string, string>;
    serial: number;
  } | null;
  now: number;
}) {
  const [kind, setKind] = useState("DEPOSIT");
  const [result, action, pending] = useActionState(recordOperationAction, {});
  const [stableKey] = useState(initialKey);
  const [values, setValues] = useState<Record<string, string>>({});
  const change = (name: string, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const [seenRequest, setSeenRequest] = useState(request);
  if (request !== seenRequest) {
    setSeenRequest(request);
    // An unresolved submission must retain its exact payload and idempotency key.
    if (request && !result.error && !pending) {
      setKind(request.kind);
      if (request.asset || request.values)
        setValues((previous) => ({
          ...previous,
          ...(request.asset ? { asset_id: request.asset } : {}),
          ...request.values,
        }));
    }
  }
  const selected = kind;
  // Changing the reversal selection is an explicit form choice, not a monetary calculation.
  const [seenReversal, setSeenReversal] = useState<Entry | null>(null);
  if (reversal !== seenReversal) {
    setSeenReversal(reversal);
    if (reversal && !result.error && !pending) {
      setKind("REVERSAL");
      change("reversal_of", reversal.id);
    }
  }
  const numberInput = (name: string, label: string) => (
    <label key={name}>
      {label}
      <input
        name={name}
        value={values[name] ?? ""}
        onChange={(event) => change(name, event.target.value)}
        inputMode="decimal"
        type={hidden ? "password" : "text"}
        autoComplete="off"
        required
        maxLength={40}
        placeholder="Decimal com ponto"
      />
    </label>
  );
  const assetInput = (name: string, label: string) => (
    <label key={name}>
      {label}
      <select
        name={name}
        aria-label={label}
        required
        value={values[name] ?? ""}
        onChange={(event) => change(name, event.target.value)}
      >
        <option value="" disabled>
          Selecione o ativo
        </option>
        {market?.assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.symbol} — {asset.name}
          </option>
        ))}
      </select>
    </label>
  );
  const legs = (prefix = "", title = "") => (
    <>
      {assetInput(`${prefix}asset_id`, `${title}ativo`)}
      {numberInput(`${prefix}quantity`, `${title}quantidade`)}
      {numberInput(`${prefix}unit_price`, `${title}preço unitário (USDT)`)}
      {numberInput(`${prefix}fees`, `${title}taxa (USDT)`)}
    </>
  );
  const [localDate, setLocalDate] = useState("");
  useEffect(() => {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    const timer = window.setTimeout(() => setLocalDate(local), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const occurredAt = localInputToISO(localDate);
  return (
    <section
      className="virtual-panel wallet-drawer"
      id="registro"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="registro-title"
    >
      <button type="button" className="toolbar-button" onClick={onClose}>
        Fechar registro
      </button>
      <h2 id="registro-title">Novo registro virtual</h2>
      <p>
        Informe os valores efetivamente declarados em USDT. Taxas são
        obrigatórias: digite 0 apenas quando a taxa for zero. O servidor valida
        todo o histórico, inclusive operações retroativas.
      </p>
      <form action={action} className="virtual-form">
        <fieldset className="virtual-draft" disabled={writesPaused}>
          <input name="key" type="hidden" value={result.key ?? stableKey} />
          <input name="walletId" type="hidden" value={walletId} />
          <div className="virtual-fields">
            <label>
              Tipo de operação
              <select
                name="kind"
                value={selected}
                onChange={(event) => setKind(event.target.value)}
              >
                {Object.entries(names).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data e hora (seu fuso local)
              <input
                type="datetime-local"
                value={localDate}
                required
                onChange={(event) => setLocalDate(event.target.value)}
              />
              <input name="occurred_at" type="hidden" value={occurredAt} />
              <small>
                A data é convertida para o instante UTC correspondente ao fuso
                do seu dispositivo. Datas futuras são recusadas.
              </small>
            </label>
          </div>
          <div className="virtual-fields" key={kind}>
            {["DEPOSIT", "WITHDRAWAL", "FEE"].includes(kind) &&
              numberInput("amount", "Valor (USDT)")}
            {["BUY", "SELL"].includes(kind) && (
              <>
                {assetInput("asset_id", "Ativo")}
                {numberInput("quantity", "Quantidade")}
                {kind === "SELL" &&
                  positions.find((p) => p.asset_id === values.asset_id) && (
                    <div className="wallet-actions">
                      {["25", "50", "100"].map((pct) => (
                        <button
                          type="button"
                          className="button"
                          key={pct}
                          onClick={() => {
                            const position = positions.find(
                              (p) => p.asset_id === values.asset_id,
                            );
                            const quantity =
                              position &&
                              quantityForPercent(position.quantity, pct);
                            if (quantity) change("quantity", quantity);
                          }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  )}
                {numberInput("unit_price", "Preço unitário (USDT)")}
                {(() => {
                  const quote = market?.assets.find(
                    (a) => a.id === values.asset_id,
                  )?.quote;
                  return market &&
                    usableQuote(quote, Date.parse(market.evaluated_at)) &&
                    usableQuote(quote, now) &&
                    quote ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => change("unit_price", quote.price)}
                    >
                      Usar cotação atual
                    </button>
                  ) : null;
                })()}
                {numberInput("fees", "Taxa (USDT)")}
              </>
            )}
            {kind === "SWAP" && (
              <>
                {legs("sell_", "Venda: ")}
                {legs("buy_", "Compra: ")}
              </>
            )}
            {kind === "REVERSAL" && (
              <label>
                Operação original
                <select
                  name="reversal_of"
                  required
                  value={values.reversal_of ?? ""}
                  onChange={(event) =>
                    change("reversal_of", event.target.value)
                  }
                >
                  <option value="" disabled>
                    Selecione pelo histórico
                  </option>
                  {[
                    ...operations,
                    ...(reversal &&
                    !operations.some((entry) => entry.id === reversal.id)
                      ? [reversal]
                      : []),
                  ]
                    .filter(
                      (entry) => !entry.reversed && entry.kind !== "REVERSAL",
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        #{entry.sequence} ·{" "}
                        {names[entry.kind as keyof typeof names] ?? entry.kind}{" "}
                        ·{" "}
                        {new Date(entry.occurred_at).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </option>
                    ))}
                </select>
                <small>
                  O estorno cancela o efeito original e reprocessa o histórico.
                  Não apaga registros.
                </small>
              </label>
            )}
          </div>
          {result.error && (
            <p role="alert" className="form-error">
              {result.error}
            </p>
          )}
          {result.success && <p role="status">{result.success}</p>}
          <button className="button primary" disabled={pending || writesPaused}>
            {pending ? "Confirmando…" : "Registrar operação"}
          </button>
          <small>
            Em caso de falha, tente novamente sem alterar os dados: a chave da
            solicitação permanece a mesma.
          </small>
        </fieldset>
      </form>
    </section>
  );
}
function History({
  state,
  hidden,
  market,
  onReverse,
}: {
  state: WalletState;
  hidden: boolean;
  market: Market | null;
  onReverse: (entry: Entry) => void;
}) {
  const [extra, setExtra] = useState<Entry[]>([]),
    [before, setBefore] = useState(state.next_before),
    [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="virtual-panel" id="historico">
      <details>
        <summary>Histórico auditável</summary>
        <p>
          {state.operations_total} operações · Registro virtual declarado ·
          Ordem de registro; a contabilização usa data efetiva e sequência.
        </p>
        {[...state.operations, ...extra].length ? (
          <ol className="virtual-history">
            {[...state.operations, ...extra].map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    {names[entry.kind as keyof typeof names] ?? entry.kind}
                  </strong>
                  <small>{entry.kind}</small>
                  {!hidden && (
                    <span>
                      {Object.entries(entry.request)
                        .filter(([key]) =>
                          [
                            "amount",
                            "quantity",
                            "sell_quantity",
                            "buy_quantity",
                            "asset_id",
                            "sell_asset_id",
                            "buy_asset_id",
                          ].includes(key),
                        )
                        .map(([key, value]) =>
                          key.includes("asset_id")
                            ? (market?.assets.find(
                                (asset) => asset.id === value,
                              )?.symbol ?? "Ativo indisponível")
                            : String(value),
                        )
                        .join(" · ")}
                    </span>
                  )}
                  <span>
                    #{entry.sequence} ·{" "}
                    {new Date(entry.occurred_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                    {entry.reversed && " · Estornada"}
                  </span>
                </div>
                <details>
                  <summary>Detalhes do registro {entry.sequence}</summary>
                  <p>ID: {entry.id}</p>
                  <p>
                    Registrado em:{" "}
                    {new Date(entry.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                  {hidden ? (
                    <p>••••••</p>
                  ) : (
                    <dl>
                      {Object.entries(entry.request).map(([key, value]) => (
                        <div key={key}>
                          <dt>
                            {(
                              {
                                kind: "Tipo",
                                occurred_at: "Data efetiva",
                                amount: "Valor USDT",
                                asset_id: "Ativo",
                                quantity: "Quantidade",
                                unit_price: "Preço unitário USDT",
                                fees: "Taxa USDT",
                                sell_asset_id: "Ativo vendido",
                                sell_quantity: "Quantidade vendida",
                                sell_unit_price: "Preço de venda USDT",
                                sell_fees: "Taxa de venda USDT",
                                buy_asset_id: "Ativo comprado",
                                buy_quantity: "Quantidade comprada",
                                buy_unit_price: "Preço de compra USDT",
                                buy_fees: "Taxa de compra USDT",
                                reversal_of: "Operação estornada",
                              } as Record<string, string>
                            )[key] ?? key}
                          </dt>
                          <dd>
                            {key.includes("asset_id")
                              ? (market?.assets.find(
                                  (asset) => asset.id === value,
                                )?.symbol ?? String(value))
                              : key === "kind"
                                ? (names[value as keyof typeof names] ??
                                  String(value))
                                : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {entry.reversal_of && <p>Estorno de: {entry.reversal_of}</p>}
                </details>
                {!entry.reversed && entry.kind !== "REVERSAL" && (
                  <button
                    className="toolbar-button"
                    type="button"
                    onClick={() => onReverse(entry)}
                    aria-label={`Estornar operação ${entry.sequence}`}
                  >
                    Preparar estorno
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p>Nenhuma operação registrada.</p>
        )}
        {error && <p role="alert">{error}</p>}
        {before !== null && (
          <button
            className="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const response = await historyAction(state.wallet.id, before);
                if (response.error) setError(response.error);
                else if (response.history) {
                  setExtra((previous) => [
                    ...previous,
                    ...response.history!.operations,
                  ]);
                  setBefore(response.history.next_before);
                  setError("");
                }
              })
            }
          >
            {pending ? "Carregando…" : "Carregar mais operações"}
          </button>
        )}
      </details>
    </section>
  );
}
