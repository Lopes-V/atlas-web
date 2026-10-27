import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteState, priceChange, portfolioReturn, latestBy, toCsv, money } from '../src/lib/finance';

const now = Date.parse('2026-10-26T17:00:00Z');
test('rejects stale, future and invalid quotes rather than presenting them as current', () => {
  assert.equal(quoteState({ quality: 'VALID', observed_at: '2026-10-26T16:59:00Z' }, now, 300), 'valid');
  assert.equal(quoteState({ quality: 'VALID', observed_at: '2026-10-25T00:00:00Z' }, now, 300), 'stale');
  assert.equal(quoteState({ quality: 'VALID', observed_at: '2026-10-27T00:00:00Z' }, now, 300), 'invalid');
  assert.equal(quoteState({ quality: 'OUTLIER', observed_at: '2026-10-26T16:59:00Z' }, now, 300), 'invalid');
  assert.equal(quoteState(null, now, 300), 'missing');
});
test('calculates only same-source same-currency changes with nonzero base', () => {
  const a = { price: '0.3', provider: 'brapi', currency_code: 'BRL', observed_at: '2026-10-26T17:00:00Z', quality: 'VALID' };
  assert.equal(priceChange(a, { ...a, price: '0.1', observed_at: '2026-10-26T16:00:00Z' }), '200');
  assert.equal(priceChange(a, { ...a, provider: 'other' }), null);
  assert.equal(priceChange(a, { ...a, currency_code: 'USD' }), null);
  assert.equal(priceChange(a, { ...a, price: '0' }), null);
  assert.equal(priceChange(a, { ...a, quality: 'INVALID' }), null);
  assert.equal(priceChange(a, { ...a }), null);
});
test('portfolio return preserves decimal precision and absent basis', () => {
  assert.equal(portfolioReturn('0.3', '0.1'), '200');
  assert.equal(portfolioReturn('0', '0'), null);
});
test('latest record is selected by timestamp without mutating input', () => {
  const records = [{ id: 'a', at: '2026-10-25T17:00:00Z' }, { id: 'a', at: '2026-10-26T17:00:00Z' }, { id: 'b', at: '2026-10-24T17:00:00Z' }];
  assert.equal(latestBy(records, row => row.id, row => row.at).get('a')?.at, records[1].at);
  assert.equal(records[0].at, '2026-10-25T17:00:00Z');
});
test('CSV escapes separators and neutralizes spreadsheet formulas', () => {
  const csv = toCsv(['Ativo', 'Nome'], [['=HYPERLINK("bad")', 'A;B'], ['PETR4', 'Petrobras']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"A;B"'));
});

test('formats database-scale monetary values without losing cents', () => {
  assert.equal(money('12345678901234567890.12'), 'R$\u00a012.345.678.901.234.567.890,12');
  assert.equal(money('-12345678901234567890.12', 'USD'), '-US$\u00a012.345.678.901.234.567.890,12');
});

test('formats small and absent values with the currency locale and explicit rounding', () => {
  assert.equal(money('0.005'), 'R$\u00a00,01');
  assert.equal(money('-0.01'), '-R$\u00a00,01');
  assert.equal(money('36.84'), 'R$\u00a036,84');
  assert.equal(money(null), '—');
  assert.equal(money(undefined), '—');
});
