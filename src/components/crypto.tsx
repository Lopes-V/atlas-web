'use client';

import Decimal from 'decimal.js';
import { useEffect, useState } from 'react';
import { Activity, Clock3, ShieldCheck } from 'lucide-react';
import type { CryptoAnalysis, CryptoAsset, DashboardData } from '@/lib/contracts';
import { dateTime, percent } from '@/lib/finance';
import { Empty, SectionError } from './ui';

const intervals = { '15m': 900_000, '1h': 3_600_000 } as const;
const core = ['CLOSE', 'RETURN', 'MOMENTUM_PCT', 'EMA20', 'EMA50', 'RSI', 'VOLATILITY', 'ATR', 'MAX_DRAWDOWN', 'TREND_DIRECTION'];
const directions: Record<string, string> = { '1': 'ALTA', '-1': 'BAIXA', '0': 'MISTA' };
const numbers = (value: string) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(new Decimal(value).toFixed() as Intl.StringNumericLiteral);

function latestAnalysis(asset: CryptoAsset, interval: keyof typeof intervals, now: number, receivedAt: number) {
  // Never fall back to an older favorable signal when the latest record is unusable.
  const latest = asset.analyses.filter(row => row.interval === interval && row.algorithm_version === 'analysis-v2')
    .sort((a, b) => Date.parse(b.reference_at) - Date.parse(a.reference_at))[0];
  if (!latest) return null;
  const reference = Date.parse(latest.reference_at), created = Date.parse(latest.created_at);
  if (reference + intervals[interval] > receivedAt || now - reference > 2 * intervals[interval] + 120_000 || created > receivedAt || created < reference + intervals[interval]) return null;
  const metric = new Map(latest.metrics.map(row => [row.metric_name, row.metric_value]));
  if (core.some(key => !metric.has(key)) || !directions[new Decimal(metric.get('TREND_DIRECTION')!).toString()]) return null;
  return latest;
}

function Analysis({ analysis, interval, hidden }: { analysis: CryptoAnalysis | null; interval: keyof typeof intervals; hidden: boolean }) {
  const metric = new Map(analysis?.metrics.map(row => [row.metric_name, row.metric_value]) ?? []);
  const direction = metric.get('TREND_DIRECTION');
  const amount = (key: string) => hidden ? '••••••' : metric.has(key) ? `${numbers(metric.get(key)!)} USDT` : '—';
  const numeric = (key: string, suffix = '') => metric.has(key) ? `${numbers(metric.get(key)!)}${suffix}` : '—';
  const ratio = (key: string) => metric.has(key) ? percent(new Decimal(metric.get(key)!).times(100).toString()) : '—';
  return <section className="crypto-interval" aria-label={interval}>
    <div className="crypto-interval-heading"><h3>{interval}</h3>{analysis && direction && <span className={`badge ${new Decimal(direction).isPositive() ? 'positive' : new Decimal(direction).isNegative() ? 'negative' : 'neutral'}`}>{directions[new Decimal(direction).toString()]}</span>}</div>
    {!analysis ? <p className="crypto-unavailable"><Clock3 size={16}/> Aguardando análise válida</p> : <>
      <p className="crypto-reference">Início do candle fechado: <time dateTime={analysis.reference_at}>{dateTime(analysis.reference_at)} (Brasília)</time></p>
      <dl className="crypto-metrics">
        <div><dt>Fechamento</dt><dd>{amount('CLOSE')}</dd></div>
        <div><dt>Retorno · {analysis.metrics.find(row => row.metric_name === 'RETURN')?.reference_period ?? '—'} candles</dt><dd>{ratio('RETURN')}</dd></div>
        <div><dt>Momentum</dt><dd>{metric.has('MOMENTUM_PCT') ? percent(metric.get('MOMENTUM_PCT')) : '—'}</dd></div>
        <div><dt>EMA20</dt><dd>{amount('EMA20')}</dd></div>
        <div><dt>EMA50</dt><dd>{amount('EMA50')}</dd></div>
        <div><dt>RSI</dt><dd>{numeric('RSI')}</dd></div>
        <div><dt>Volatilidade</dt><dd>{ratio('VOLATILITY')}</dd></div>
        <div><dt>ATR</dt><dd>{amount('ATR')}</dd></div>
        <div><dt>Drawdown máximo</dt><dd>{ratio('MAX_DRAWDOWN')}</dd></div>
        <div><dt>Volume médio · ativo base</dt><dd>{hidden ? '••••••' : numeric('AVERAGE_VOLUME')}</dd></div>
        <div><dt>Volume relativo</dt><dd>{numeric('RELATIVE_VOLUME', '×')}</dd></div>
      </dl>
      <p className="crypto-reference">Calculada: {dateTime(analysis.created_at)} (Brasília) · {analysis.algorithm_version}</p>
    </>}
  </section>;
}

export function Crypto({ data, hidden }: { data: DashboardData; hidden: boolean }) {
  const receivedAt = Date.parse(data.fetchedAt);
  const [clock, setClock] = useState({ fetchedAt: data.fetchedAt, elapsed: 0 });
  useEffect(() => {
    // Server time plus monotonic elapsed time avoids browser wall-clock skew.
    const startedAt = performance.now();
    const tick = () => setClock({ fetchedAt: data.fetchedAt, elapsed: Math.max(0, performance.now() - startedAt) });
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [data.fetchedAt]);
  const now = receivedAt + (clock.fetchedAt === data.fetchedAt ? clock.elapsed : 0);
  return <>
    <div className="page-intro"><div><span className="eyebrow">BYBIT · SPOT · USDT</span><h1>Cripto</h1><p>Condições de curto prazo, com indicadores persistidos por intervalo.</p></div></div>
    <div className="mint-note crypto-note"><span className="empty-icon"><ShieldCheck size={22}/></span><div><h3>Contexto para acompanhar o mercado</h3><p>Tendências descrevem os candles analisados. Não são recomendações de compra nem promessa de retorno. Custos e spread indisponíveis: não há registro persistido nesta versão.</p></div></div>
    <SectionError message={data.crypto.error}/>
    {data.crypto.data.length === 0 ? <div className="panel"><Empty title="Aguardando análise válida" description="Os pares monitorados aparecerão após o cadastro e a coleta do backend." icon={Activity}/></div> : <div className="crypto-grid">{data.crypto.data.map(asset => {
      const quote = asset.quotes[0];
      const time = quote ? Date.parse(quote.observed_at) : NaN;
      const valid = quote?.provider === 'bybit' && quote.currency_code === 'USDT' && quote.quality === 'VALID' && new Decimal(quote.price).greaterThan(0) && time <= receivedAt && now - time <= 120_000;
      return <article className="panel crypto-card" key={asset.id} aria-label={asset.symbol}>
        <header className="crypto-card-heading"><div><span className="eyebrow">BYBIT · SPOT</span><h2>{asset.symbol}</h2><p>{asset.name} · USDT</p></div><Activity size={21}/></header>
        <div className="crypto-price"><strong>{valid ? hidden ? '••••••' : `${numbers(quote.price)} USDT` : 'Cotação indisponível'}</strong>{valid && <span>Cotação: <time dateTime={quote.observed_at}>{dateTime(quote.observed_at)} (Brasília)</time></span>}<small>Fonte: Bybit · validade máxima da cotação: 120 segundos</small></div>
        {(Object.keys(intervals) as (keyof typeof intervals)[]).map(interval => <Analysis key={interval} analysis={valid ? latestAnalysis(asset, interval, now, receivedAt) : null} interval={interval} hidden={hidden}/>)}
      </article>;
    })}</div>}
    <p className="page-note">Atualize o painel para consultar novos registros. Cada janela usa somente candles fechados; dados ausentes ou fora da janela de atualização ficam indisponíveis.</p>
  </>;
}
