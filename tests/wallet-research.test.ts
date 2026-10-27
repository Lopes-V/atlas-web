import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { CryptoAnalysis } from '../src/lib/contracts';
import { researchAnalysis } from '../src/lib/wallet-tools';
const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = { exports: {} } as NodeModule;
const ID = '00000000-0000-4000-8000-000000000201';
const raw = () => ({
  id: ID, symbol: 'BTCUSDT', name: 'Bitcoin', asset_type: 'CRYPTO', is_active: true,
  market: { code: 'CRYPTO', is_active: true }, currency: { code: 'USDT', is_active: true }, exchange: { code: 'KRAKEN', is_active: true },
  analyses15m: [] as CryptoAnalysis[], analyses1h: [] as CryptoAnalysis[], candles: [{ observed_at: '2026-01-01T00:00:00Z', close: '12345678901234567890.123456789012345678', quality: 'VALID', provider: 'kraken' }],
});

const receivedAt = Date.parse('2026-01-01T00:00:00Z');
const coreMetrics = { CLOSE:'120', RETURN:'0.01', MOMENTUM_PCT:'1', EMA20:'119', EMA50:'118', RSI:'58', VOLATILITY:'0.02', ATR:'2', MAX_DRAWDOWN:'-0.1', TREND_DIRECTION:'1' };
const analysis = (interval: '15m' | '1h', older = false, direction = '1'): CryptoAnalysis => ({
  id: older ? '00000000-0000-4000-8000-000000000302' : '00000000-0000-4000-8000-000000000301',
  interval, algorithm_version:'analysis-v2',
  reference_at:new Date(receivedAt - (interval === '15m' ? 900_000 : 3_600_000) * (older ? 2 : 1)).toISOString(),
  created_at:new Date(receivedAt).toISOString(),
  metrics:Object.entries({...coreMetrics,TREND_DIRECTION:direction}).map(([metric_name,metric_value])=>({metric_name,metric_value,reference_period:14})),
});
test('individual research reads only bounded public Kraken facts after remote identity verification', async t => {
  const { getWalletResearch } = await import('../src/lib/wallet-research');
  const original = globalThis.fetch;
  const prior = Object.fromEntries(['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'].map(key => [key, process.env[key]]));
  process.env.SUPABASE_URL = 'https://research-unit.example.test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_fake_research_test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fake_research_test';
  let privileged = 0, mode = 'valid';
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)), headers = new Headers(init?.headers);
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    if (url.pathname === '/auth/v1/user') {
      assert.equal(headers.get('apikey'), 'sb_publishable_fake_research_test');
      assert.equal(headers.get('authorization'), 'Bearer individual-token');
      if (mode === 'unauthorized') return Response.json({}, {status:401});
      return Response.json({ id:'00000000-0000-4000-8000-000000000001' });
    }
    privileged++;
    assert.equal(url.pathname, '/rest/v1/assets');
    assert.equal(headers.get('apikey'), 'sb_secret_fake_research_test');
    assert.equal(init?.method ?? 'GET', 'GET');
    assert.equal(url.searchParams.get('id'), `in.(${ID})`);
    for (const [key,value] of Object.entries({asset_type:'eq.CRYPTO',is_active:'eq.true','market.code':'eq.CRYPTO','market.is_active':'eq.true','currency.code':'eq.USDT','currency.is_active':'eq.true','exchange.code':'eq.KRAKEN','exchange.is_active':'eq.true','candles.provider':'eq.kraken','candles.interval':'eq.15m','candles.limit':'96','analyses15m.algorithm_version':'eq.analysis-v2','analyses15m.interval':'eq.15m','analyses15m.limit':'2','analyses15m.order':'reference_at.desc','analyses1h.algorithm_version':'eq.analysis-v2','analyses1h.interval':'eq.1h','analyses1h.limit':'2','analyses1h.order':'reference_at.desc'})) assert.equal(url.searchParams.get(key),value,key);
    assert.match(url.searchParams.get('select')!, /close::text/);
    assert.match(url.searchParams.get('select')!, /metric_value::text/);
    assert.doesNotMatch(url.searchParams.get('select')!, /virtual_|portfolios|auth[.]/);
    if (mode === 'outage') return Response.json({message:'private diagnostic'}, {status:503});
    if (mode === 'network') throw new Error('private network diagnostic');
    const asset = raw();
    for (const interval of ['15m','1h'] as const) {
      if (mode === `duplicate-${interval}`) {
        const latest = analysis(interval);
        asset[interval === '15m' ? 'analyses15m' : 'analyses1h'] = [latest,{...analysis(interval,false,'-1'),id:'00000000-0000-4000-8000-000000000303'}];
      }
      if (mode === `distinct-${interval}`)
        asset[interval === '15m' ? 'analyses15m' : 'analyses1h'] = [analysis(interval),analysis(interval,true,'-1')];
    }
    if (mode === 'wrong-source') asset.exchange.code = 'BYBIT';
    if (mode === 'wrong-id') asset.id = '00000000-0000-4000-8000-000000000999';
    if (mode === 'number') (asset.candles[0] as unknown as {close:number}).close = 5;
    return Response.json([asset]);
  };
  try {
    await t.test('expired/forged identity never triggers privileged reads', async () => {
      mode='unauthorized'; const result=await getWalletResearch('individual-token',[ID]);
      assert.equal(privileged,0); assert.deepEqual(result.assets,[]); assert.ok(result.error);
    });
    await t.test('invalid IDs and oversized catalog cannot be interpolated', async () => {
      mode='valid';
      for (const ids of [[ID+'),select=*'],Array.from({length:11},()=>ID)]) {
        const before=privileged; const result=await getWalletResearch('individual-token',ids);
        assert.equal(privileged,before); assert.deepEqual(result.assets,[]); assert.ok(result.error);
      }
    });
    await t.test('valid facts keep exact strings and contain no server credentials', async () => {
      mode='valid'; const result=await getWalletResearch('individual-token',[ID]);
      assert.equal(result.error,null); assert.equal(result.assets[0].candles[0].close,raw().candles[0].close);
      assert.equal(result.assets[0].id,ID); assert.deepEqual(result.assets[0].analyses,[]);
      assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
      assert.ok(!JSON.stringify(result).includes('sb_secret_'));
    });
    for (const interval of ['15m','1h'] as const) {
      await t.test(`${interval} conflicting latest duplicates survive the reader and become unavailable`, async () => {
        mode=`duplicate-${interval}`;
        const result=await getWalletResearch('individual-token',[ID]);
        assert.equal(result.error,null);
        assert.equal(result.assets[0].analyses.length,2);
        assert.deepEqual(result.assets[0].analyses.map(row=>row.metrics.find(metric=>metric.metric_name==='TREND_DIRECTION')?.metric_value),['1','-1']);
        const evidence=researchAnalysis(result.assets[0],interval,{price:'120',provider:'kraken',currency_code:'USDT',quality:'VALID',observed_at:new Date(receivedAt).toISOString()},receivedAt,receivedAt);
        assert.equal(evidence.analysis,null);
        assert.equal(evidence.direction,'unavailable');
        assert.ok(evidence.reason);
        assert.deepEqual(evidence.metrics,{});
      });
      await t.test(`${interval} distinct references survive the reader and choose the latest evidence`, async () => {
        mode=`distinct-${interval}`;
        const result=await getWalletResearch('individual-token',[ID]);
        assert.equal(result.error,null);
        assert.equal(result.assets[0].analyses.length,2);
        const evidence=researchAnalysis(result.assets[0],interval,{price:'120',provider:'kraken',currency_code:'USDT',quality:'VALID',observed_at:new Date(receivedAt).toISOString()},receivedAt,receivedAt);
        assert.equal(evidence.analysis?.reference_at,analysis(interval).reference_at);
        assert.equal(evidence.direction,'up');
        assert.equal(evidence.reason,null);
      });
    }
    for (const bad of ['wrong-source','wrong-id','number','outage','network']) await t.test(`${bad} makes research unavailable without a fake substitute`, async () => {
      mode=bad; const result=await getWalletResearch('individual-token',[ID]);
      assert.deepEqual(result.assets,[]); assert.ok(result.error); assert.ok(!result.error.includes('private'));
    });
  } finally {
    globalThis.fetch=original;
    for (const [key,value] of Object.entries(prior)) if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
