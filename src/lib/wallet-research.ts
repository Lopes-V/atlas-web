import 'server-only';
import { z } from 'zod';
import { verifyAccess } from './virtual-auth';
import { candleSchema, cryptoAnalysisSchema } from './contracts';
import type { WalletResearch } from './wallet-tools';

const catalogSchema = z.array(z.uuid()).max(10);
const rawAssetSchema = z.object({
  id:z.uuid(), symbol:z.string(), name:z.string(), asset_type:z.literal('CRYPTO'), is_active:z.literal(true),
  market:z.object({code:z.literal('CRYPTO'),is_active:z.literal(true)}),
  currency:z.object({code:z.literal('USDT'),is_active:z.literal(true)}),
  exchange:z.object({code:z.literal('KRAKEN'),is_active:z.literal(true)}),
  analyses15m:z.array(cryptoAnalysisSchema).max(2), analyses1h:z.array(cryptoAnalysisSchema).max(2),
  candles:z.array(candleSchema).max(96),
});
const unavailable='A análise de mercado está indisponível. Seus registros e operações continuam disponíveis.';

/** Read only global, already-collected market facts. Financial/private tables
 * always remain behind the individual's JWT/RLS RPCs, never this service key.
 * No caller-controlled table, select, path or arbitrary query can reach fetch.
 */
export async function getWalletResearch(token:string, assetIds:string[]):Promise<WalletResearch> {
  const empty=(error:string|null):WalletResearch=>({fetchedAt:new Date().toISOString(),assets:[],error});
  const ids=catalogSchema.safeParse(assetIds);
  if(!ids.success)return empty(unavailable);
  if(!ids.data.length)return empty(null);
  try {
    // Verification happens inside this helper too: callers cannot substitute the
    // operator cookie or an unchecked decoded JWT for an individual identity.
    if(!await verifyAccess(token))return empty('Entre na sua conta individual para consultar a análise de mercado.');
    const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
    if(!base||!key||new URL(base).protocol!=='https:')return empty(unavailable);
    const unique=[...new Set(ids.data)];
    const url=new URL('/rest/v1/assets',base);
    url.search=new URLSearchParams({
      select:'id,symbol,name,asset_type,is_active,market:markets!inner(code,is_active),currency:currencies!inner(code,is_active),exchange:exchanges!inner(code,is_active),analyses15m:analyses(id,interval,reference_at,algorithm_version,created_at,metrics:analysis_metrics(metric_name,metric_value::text,reference_period)),analyses1h:analyses(id,interval,reference_at,algorithm_version,created_at,metrics:analysis_metrics(metric_name,metric_value::text,reference_period)),candles:market_candles(observed_at,close::text,quality,provider)',
      id:`in.(${unique.join(',')})`, limit:'10', order:'symbol.asc',
      asset_type:'eq.CRYPTO',is_active:'eq.true',
      'market.code':'eq.CRYPTO','market.is_active':'eq.true',
      'currency.code':'eq.USDT','currency.is_active':'eq.true',
      'exchange.code':'eq.KRAKEN','exchange.is_active':'eq.true',
      'analyses15m.algorithm_version':'eq.analysis-v2','analyses15m.interval':'eq.15m',
      'analyses15m.order':'reference_at.desc','analyses15m.limit':'2',
      'analyses1h.algorithm_version':'eq.analysis-v2','analyses1h.interval':'eq.1h',
      'analyses1h.order':'reference_at.desc','analyses1h.limit':'2',
      'candles.provider':'eq.kraken','candles.interval':'eq.15m',
      'candles.order':'observed_at.desc','candles.limit':'96',
    }).toString();
    const headers:Record<string,string>={apikey:key,Accept:'application/json'};
    if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
    const response=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return empty(unavailable);
    const parsed=z.array(rawAssetSchema).max(10).safeParse(await response.json());
    if(!parsed.success||parsed.data.some(asset=>!unique.includes(asset.id))||new Set(parsed.data.map(asset=>asset.id)).size!==parsed.data.length)return empty(unavailable);
    return {
      fetchedAt:new Date().toISOString(),error:null,
      assets:parsed.data.map(asset=>({id:asset.id,symbol:asset.symbol,name:asset.name,analyses:[...asset.analyses15m,...asset.analyses1h],candles:asset.candles})),
    };
  } catch {
    // Optional research failure does not replace a balance/price or suppress the
    // ledger. The explicit error is surfaced next to the research panel.
    return empty(unavailable);
  }
}
