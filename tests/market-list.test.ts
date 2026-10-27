import test from 'node:test';
import assert from 'node:assert/strict';
import { marketPage } from '../src/lib/market-list';

const assets = Array.from({ length: 23 }, (_, index) => ({ symbol: `ATIVO${String(index).padStart(2, '0')}`, name: `Empresa ${index}` }));
test('paginates without dropping or duplicating assets and preserves input', () => {
  const first = marketPage(assets, { page: '1' });
  const second = marketPage(assets, { page: '2' });
  const last = marketPage(assets, { page: '3' });
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 10);
  assert.equal(last.items.length, 3);
  assert.deepEqual([...first.items, ...second.items, ...last.items], assets);
  assert.equal(last.totalPages, 3);
});
test('clamps stale and malformed URL pages, including empty results', () => {
  assert.equal(marketPage(assets.slice(0, 1), { page: '999' }).page, 1);
  for (const page of ['-1', 'NaN', '2.5', 'Infinity']) assert.equal(marketPage(assets, { page }).page, 1);
  assert.equal(marketPage([], { page: '2' }).items.length, 0);
  assert.equal(marketPage(assets, { pageSize: '-1' }).pageSize, 10);
});
test('sorts alphabetically without comparing prices in different currencies or mutating records', () => {
  const result = marketPage(assets, { sort: 'symbol-desc', pageSize: '25' });
  assert.equal(result.items[0].symbol, 'ATIVO22');
  assert.equal(assets[0].symbol, 'ATIVO00');
  assert.equal(marketPage(assets, { sort: 'unknown' }).items[0].symbol, 'ATIVO00');
});
