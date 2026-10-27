// Test process preload only. No production fixture mode or TLS override exists.
const originalFetch = globalThis.fetch;
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const at = (days = 0, minutes = 0) => new Date(Date.now() - days * 86400000 - minutes * 60000).toISOString();
const quote = (price, days = 0, quality = 'VALID', currency_code = 'BRL') => ({ price, provider: 'brapi', currency_code, observed_at: at(days), quality });
const assets = [
  { id: id(1), symbol: 'PETR4', name: 'Petrobras', asset_type: 'STOCK', market: { code: 'B3', name: 'Brasil', country_code: 'BR' }, currency: { code: 'BRL' }, quotes: [quote('36.84'), quote('36.00', 1)] },
  { id: id(2), symbol: 'VALE3', name: 'Vale', asset_type: 'STOCK', market: { code: 'B3', name: 'Brasil', country_code: 'BR' }, currency: { code: 'BRL' }, quotes: [quote('999999.00', 0, 'OUTLIER'), quote('60.00', 1)] },
  { id: id(3), symbol: 'AAPL', name: 'Apple', asset_type: 'STOCK', market: { code: 'US', name: 'Estados Unidos', country_code: 'US' }, currency: { code: 'USD' }, quotes: [quote('200.00', 7, 'VALID', 'USD')] },
];
// Extra test-only records exercise multiple pages without invented production prices.
assets.push(...Array.from({ length: 12 }, (_, index) => ({
  ...assets[0], id: id(100 + index), symbol: `ZZT${String(index).padStart(2, '0')}`, name: `Empresa de teste ${index}`, quotes: [],
})));
// Kraken fixtures are a separate CRYPTO market and never inflate the B3 count.
const metric = (metric_name, metric_value) => ({ metric_name, metric_value, reference_period: 14 });
const metrics = direction => [metric('CLOSE', '68000.25'), metric('RETURN', '0.0125'), metric('MOMENTUM_PCT', '1.25'), metric('EMA20', '67500.00'), metric('EMA50', '67000.00'), metric('RSI', '58.25'), metric('VOLATILITY', '0.0025'), metric('ATR', '120.25'), metric('MAX_DRAWDOWN', '-0.015'), metric('AVERAGE_VOLUME', '100.00'), metric('RELATIVE_VOLUME', '1.20'), metric('TREND_DIRECTION', String(direction))];
const analysis = (value, interval, minutes, direction = 1) => ({ id: id(value), interval, reference_at: at(0, minutes), created_at: at(0, 1), algorithm_version: 'analysis-v2', metrics: metrics(direction) });
const cryptoAssets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((symbol, index) => ({
  id: id(200 + index), symbol, name: ['Bitcoin', 'Ethereum', 'Solana'][index], asset_type: 'CRYPTO',
  market: { code: 'CRYPTO', name: 'Criptoativos', country_code: null }, currency: { code: 'USDT' }, exchange: { code: 'KRAKEN' },
  quotes: [{ price: '68001.50', provider: 'kraken', currency_code: 'USDT', quality: 'VALID', observed_at: at(0, index === 1 ? 5 : index === 2 ? -1 : 0.5) }],
  analyses15m: index === 0 ? [analysis(210, '15m', 16)] : index === 1 ? [analysis(211, '15m', 16)] : [{ ...analysis(212, '15m', 16), metrics: metrics(1).filter(row => row.metric_name !== 'EMA50') }],
  analyses1h: index === 0 ? [analysis(220, '1h', 61, -1)] : index === 1 ? [analysis(221, '1h', -1)] : [{ ...analysis(222, '1h', 61), created_at: at(0, -1) }],
}));
const fixtures = {
  assets: [...assets, ...cryptoAssets],
  portfolios: [
    { id: id(10), name: 'Minha carteira BR', base_currency_code: 'BRL', snapshots: Array.from({ length: 12 }, (_, index) => ({ as_of: at(index * 2), market_value: String(10000 - index * 240), total_cost_basis: '7000.00', unrealized_pnl: String(3000 - index * 240) })), transactions: [{ id: id(11), asset_id: id(1), transaction_type: 'BUY', quantity: '100', unit_price: '36.00', fees: '0.10', currency_code: 'BRL', occurred_at: at(2) }] },
    { id: id(13), name: 'Carteira de precisão de teste', base_currency_code: 'BRL', snapshots: [{ as_of: at(0), market_value: '12345678901234567890.12', total_cost_basis: '12345678901234567890.00', unrealized_pnl: '0.12' }], transactions: [] },
    { id: id(12), name: 'Carteira internacional', base_currency_code: 'USD', snapshots: [{ as_of: at(0), market_value: '500.00', total_cost_basis: '400.00', unrealized_pnl: '100.00' }], transactions: [] },
  ],
  opportunities: [{ id: id(20), asset_id: id(1), level: 'WATCH', score: '65.00', evidence_count: 3, evaluated_at: at(), policy_version: 'policy-test-v1', ai: { summary: 'Interpretação de teste com dados validados.', classification: 'NEUTRAL', risks: ['Risco de volatilidade de teste'], finished_at: at() } }],
  alerts: [{ id: id(30), asset_id: id(1), channel: 'telegram', status: 'SENT', decided_at: at(0, 2), sent_at: at(0, 1) }],
  job_runs: [{ id: id(40), job_name: 'market_quotes', status: 'SUCCEEDED', scheduled_for: at(0, 3), started_at: at(0, 3), finished_at: at(0, 2), error_code: null }],
  fixed_income_instruments: [{ id: id(50), asset_id: id(1), provider_symbol: 'TEST-BOND', bond_type: 'Título de teste', indexer: 'SELIC', maturity_date: '2029-01-01', currency_code: 'BRL', provider: 'test' }],
  fixed_income_snapshots: [{ asset_id: id(1), provider_symbol: 'TEST-BOND', reference_date: at().slice(0, 10), buy_rate: '12.00', buy_price: '100.00', received_at: at(), quality: 'VALID' }],
  market_candles: Array.from({ length: 30 }, (_, index) => ({ observed_at: at(index), close: String(36.84 - index * 0.12), quality: 'VALID', provider: 'brapi' })),
};
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== 'atlas-test.supabase.co') return originalFetch(input, init);
  const table = url.pathname.split('/').at(-1);
  const headers = new Headers(init?.headers);
  if (headers.get('apikey') !== 'sb_secret_test_only_never_real') return Response.json({ message: 'Unauthorized' }, { status: 401 });
  if (table === 'assets' && url.searchParams.get('asset_type') === 'eq.CRYPTO') {
    const required = { 'exchange.code': 'eq.KRAKEN', 'quotes.provider': 'eq.kraken', 'quotes.limit': '1', 'analyses15m.interval': 'eq.15m', 'analyses1h.interval': 'eq.1h', 'analyses15m.algorithm_version': 'eq.analysis-v2', 'analyses1h.algorithm_version': 'eq.analysis-v2', 'analyses15m.order': 'reference_at.desc', 'analyses1h.order': 'reference_at.desc', 'analyses15m.limit': '1', 'analyses1h.limit': '1' };
    if (Object.entries(required).some(([key, value]) => url.searchParams.get(key) !== value)) return Response.json({ message: 'Crypto query must isolate provider and independent latest v2 intervals' }, { status: 400 });
    return Response.json(cryptoAssets);
  }
  if (table === 'assets') {
    if (url.searchParams.get('asset_type') !== 'neq.CRYPTO') return Response.json({ message: 'General assets query must exclude CRYPTO' }, { status: 400 });
    return Response.json(fixtures.assets.filter(asset => asset.asset_type !== 'CRYPTO'));
  }
  if (table === 'fixed_income_snapshots') return Response.json({ message: 'Deliberate isolated section error for E2E' }, { status: 503 });
  if (!(table in fixtures)) return Response.json({ message: 'Unknown table' }, { status: 404 });
  return Response.json(fixtures[table]);
};
