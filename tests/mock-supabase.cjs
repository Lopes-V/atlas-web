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
const fixtures = {
  assets,
  portfolios: [
    { id: id(10), name: 'Minha carteira BR', base_currency_code: 'BRL', snapshots: Array.from({ length: 12 }, (_, index) => ({ as_of: at(index * 2), market_value: String(10000 - index * 240), total_cost_basis: '7000.00', unrealized_pnl: String(3000 - index * 240) })), transactions: [{ id: id(11), asset_id: id(1), transaction_type: 'BUY', quantity: '100', unit_price: '36.00', fees: '0.10', currency_code: 'BRL', occurred_at: at(2) }] },
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
  if (table === 'fixed_income_snapshots') return Response.json({ message: 'Deliberate isolated section error for E2E' }, { status: 503 });
  if (!(table in fixtures)) return Response.json({ message: 'Unknown table' }, { status: 404 });
  return Response.json(fixtures[table]);
};
