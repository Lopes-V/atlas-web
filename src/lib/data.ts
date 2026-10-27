import 'server-only';
import { z } from 'zod';
import { isAuthenticated } from './auth';
import { cryptoAssetSchema, assetSchema, portfolioSchema, opportunitySchema, alertSchema, jobSchema, fixedIncomeSchema, fixedSnapshotSchema, candleSchema, type DashboardData, type Section } from './contracts';

const LIMIT = 200;
export function databaseConfigured(): boolean {
  try {
    const url = new URL(process.env.SUPABASE_URL ?? '');
    return url.protocol === 'https:' && Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  } catch { return false; }
}
async function query<T>(table: string, params: Record<string, string>, schema: z.ZodType<T>, limit = LIMIT): Promise<Section<T>> {
  const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL!);
  url.search = new URLSearchParams({ ...params, limit: String(limit) }).toString();
  try {
    const key = process.env.SUPABASE_SECRET_KEY!;
    const headers: Record<string, string> = { apikey: key, Accept: 'application/json' };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { data: [], error: response.status === 401 || response.status === 403 ? 'Acesso ao banco recusado. Verifique as credenciais do servidor.' : `Não foi possível consultar esta seção (HTTP ${response.status}).`, limit };
    const parsed = z.array(schema).safeParse(await response.json());
    if (!parsed.success) return { data: [], error: 'O banco retornou dados fora do contrato esperado. Verifique as migrações do backend.', limit };
    return { data: parsed.data, error: null, limit };
  } catch {
    return { data: [], error: 'A conexão com o banco falhou ou excedeu 10 segundos. Tente atualizar.', limit };
  }
}
export async function getDashboard(): Promise<DashboardData> {
  const configuredAge = Number(process.env.ATLAS_QUOTE_MAX_AGE_SECONDS ?? 345600);
  const base = { mode: 'setup' as const, fetchedAt: new Date().toISOString(), maxAgeSeconds: Number.isFinite(configuredAge) && configuredAge > 0 ? configuredAge : 345600 };
  const empty = { data: [], error: null, limit: LIMIT };
  if (!databaseConfigured() || !await isAuthenticated()) return { ...base, crypto: empty, assets: empty, portfolios: empty, opportunities: empty, alerts: empty, jobs: empty, fixedIncome: empty, fixedSnapshots: empty };
  const [crypto, assets, portfolios, opportunities, alerts, jobs, fixedIncome, fixedSnapshots] = await Promise.all([
    query('assets', {
      select: 'id,symbol,name,asset_type,market:markets(code,name,country_code),currency:currencies(code),exchange:exchanges!inner(code),quotes:market_quotes(price::text,provider,currency_code,observed_at,quality),analyses15m:analyses(id,interval,reference_at,algorithm_version,created_at,metrics:analysis_metrics(metric_name,metric_value::text,reference_period)),analyses1h:analyses(id,interval,reference_at,algorithm_version,created_at,metrics:analysis_metrics(metric_name,metric_value::text,reference_period))',
      is_active: 'eq.true', asset_type: 'eq.CRYPTO', 'exchange.code': 'eq.KRAKEN', symbol: 'in.(BTCUSDT,ETHUSDT,SOLUSDT)', order: 'symbol.asc',
      'quotes.provider': 'eq.kraken', 'quotes.order': 'observed_at.desc', 'quotes.limit': '1',
      'analyses15m.algorithm_version': 'eq.analysis-v2', 'analyses15m.interval': 'eq.15m', 'analyses15m.order': 'reference_at.desc', 'analyses15m.limit': '1',
      'analyses1h.algorithm_version': 'eq.analysis-v2', 'analyses1h.interval': 'eq.1h', 'analyses1h.order': 'reference_at.desc', 'analyses1h.limit': '1',
    }, cryptoAssetSchema),
    query('assets', { select: 'id,symbol,name,asset_type,market:markets(code,name,country_code),currency:currencies(code),quotes:market_quotes(price::text,provider,currency_code,observed_at,quality)', is_active: 'eq.true', asset_type: 'neq.CRYPTO', order: 'symbol.asc', 'quotes.order': 'observed_at.desc', 'quotes.limit': '2' }, assetSchema),
    query('portfolios', { select: 'id,name,base_currency_code,snapshots:portfolio_snapshots(as_of,market_value::text,total_cost_basis::text,unrealized_pnl::text),transactions:portfolio_transactions(id,asset_id,transaction_type,quantity::text,unit_price::text,fees::text,currency_code,occurred_at)', is_active: 'eq.true', order: 'name.asc', 'snapshots.order': 'as_of.desc', 'snapshots.limit': '366', 'transactions.order': 'occurred_at.desc', 'transactions.limit': '30' }, portfolioSchema, 20),
    query('opportunities', { select: 'id,asset_id,level,score::text,evidence_count,evaluated_at,policy_version,ai:ai_runs(summary,classification,risks,finished_at)', order: 'evaluated_at.desc' }, opportunitySchema, 100),
    query('alerts', { select: 'id,asset_id,channel,status,decided_at,sent_at', order: 'decided_at.desc' }, alertSchema, 100),
    query('job_runs', { select: 'id,job_name,status,scheduled_for,started_at,finished_at,error_code', order: 'started_at.desc' }, jobSchema, 50),
    query('fixed_income_instruments', { select: 'id,asset_id,provider_symbol,bond_type,indexer,maturity_date,currency_code,provider', order: 'maturity_date.asc' }, fixedIncomeSchema),
    query('fixed_income_snapshots', { select: 'asset_id,provider_symbol,reference_date,buy_rate::text,buy_price::text,received_at,quality', order: 'reference_date.desc' }, fixedSnapshotSchema, 500),
  ]);
  return { ...base, mode: 'connected', crypto, assets, portfolios, opportunities, alerts, jobs, fixedIncome, fixedSnapshots };
}
export async function getCandles(assetId: string, provider?: string): Promise<Section<z.infer<typeof candleSchema>>> {
  if (!provider || !z.uuid().safeParse(assetId).success || !databaseConfigured() || !await isAuthenticated()) return { data: [], error: null, limit: 366 };
  return query('market_candles', { select: 'observed_at,close::text,quality,provider', asset_id: `eq.${assetId}`, interval: 'eq.1d', order: 'observed_at.desc', ...(provider ? { provider: `eq.${provider}` } : {}) }, candleSchema, 366);
}
