import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Senha de acesso').fill('1234');
  await page.getByRole('button', { name: 'Acessar meu painel' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3102/');
}

test('requires authentication before reading private data and rejects an invalid session', async ({ page, context }) => {
  await page.goto('/carteira');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Minha carteira BR')).toHaveCount(0);
  await context.addCookies([{ name: 'atlas-session', value: 'forged', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/mercados');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Senha de acesso').fill('wrong-test-password');
  await page.getByRole('button', { name: 'Acessar meu painel' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Senha incorreta' })).toBeVisible();
  await signIn(page);
  await expect(page.locator('.stat-value').first()).toContainText('10.000,00');
  const cookie = (await context.cookies()).find(item => item.name === 'atlas-session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  await page.getByRole('button', { name: 'Sair do Atlas' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/carteira');
  await expect(page).toHaveURL(/\/login$/);
});

test('market filters, favorites, quote quality, details and CSV use real records', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page);
  await page.goto('/mercados');
  await expect(page.getByRole('row').filter({ hasText: 'VALE3' })).not.toContainText('999.999');
  await expect(page.getByRole('row').filter({ hasText: 'VALE3' })).toContainText('Dado inválido');
  await expect(page.getByRole('row').filter({ hasText: 'AAPL' })).toContainText('Desatualizado');
  await page.getByLabel('Buscar ativos', { exact: true }).fill('Petrobras');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Adicionar PETR4 aos favoritos' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remover PETR4 dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('atlas-mercados.csv');
  await page.getByRole('link', { name: 'Ver detalhes de PETR4' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PETR4');
  await expect(page.getByRole('img', { name: /Histórico de PETR4/ })).toBeVisible();
  await page.getByRole('button', { name: '7D', exact: true }).click();
  await expect(page).toHaveURL(/periodo=7/);
  expect(errors).toEqual([]);
});

test('portfolio selection never mixes currencies and privacy persists', async ({ page }) => {
  await signIn(page);
  await page.goto('/carteira');
  await page.getByLabel('Selecionar carteira').selectOption({ label: 'Carteira internacional (USD)' });
  await expect(page.locator('.stat-value').first()).toContainText('500,00');
  await expect(page.locator('.stat-value').first()).not.toContainText('10.500');
  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await expect(page.locator('.stat-value').first()).toHaveText('••••••');
  await page.reload();
  await expect(page.locator('.stat-value').first()).toHaveText('••••••');
  await expect(page.getByRole('button', { name: 'Exportar histórico' })).toBeDisabled();
});

test('signals expand, alerts filter, jobs render and one section failure stays visible', async ({ page }) => {
  await signIn(page);
  await page.goto('/oportunidades');
  await page.locator('summary').click();
  await expect(page.getByText('Interpretação de teste com dados validados.')).toBeVisible();
  await page.goto('/alertas');
  await page.getByLabel('Filtrar por status').selectOption('PENDING');
  await expect(page.getByText('Nenhum alerta com esse status.')).toBeVisible();
  await page.goto('/sistema');
  await expect(page.getByRole('cell', { name: 'market_quotes', exact: true })).toBeVisible();
  await page.goto('/renda-fixa');
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 503' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'SELIC', exact: true })).toBeVisible();
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/atlas-with-test-data.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['', 'mercados', 'carteira', 'oportunidades', 'alertas', 'renda-fixa', 'sistema']) {
    await page.goto(`/${route}`);
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const layout = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll('*')].filter(el => { if (el.getBoundingClientRect().right <= window.innerWidth + 1) return false; let parent = el.parentElement; while (parent) { if (getComputedStyle(parent).overflowX !== 'visible' && parent.getBoundingClientRect().right <= window.innerWidth) return false; parent = parent.parentElement; } return true; }).slice(0, 20).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })) }));
    const probes = layout.scroll > layout.width ? await page.evaluate(() => ['.chart-data', '.chart-wrap', '.signal-list', '.sidebar', '.market-strip', '.overview-hero', '.stats-grid'].map(selector => { const elements = [...document.querySelectorAll<HTMLElement>(selector)]; elements.forEach(el => el.style.display = 'none'); const width = document.documentElement.scrollWidth; elements.forEach(el => el.style.display = ''); return { selector, width }; })) : [];
    expect(layout.scroll, `${route}: ${JSON.stringify({ layout, probes })}`).toBeLessThanOrEqual(layout.width);
  }
});


test('paginates and sorts markets while preserving URL filters and exports all filtered records', async ({ page }) => {
  await signIn(page);
  await page.goto('/mercados?mercado=B3');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page).toHaveURL(/mercado=B3.*pagina=2/);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.reload();
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(15); // header + every filtered record
  expect(csv).toContain('PETR4');
  expect(csv).toContain('ZZT11');
  await page.getByLabel('Ordenar ativos', { exact: true }).selectOption('symbol-desc');
  await expect(page.getByText('Página 1 de 2', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('ZZT11');
  await page.getByLabel('Ativos por página', { exact: true }).selectOption('25');
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await expect(page.getByRole('button', { name: 'Próxima', exact: true })).toBeDisabled();
  await page.getByLabel('Buscar ativos', { exact: true }).fill('Petrobras');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('PETR4');
});


test('keeps database decimal cents when rendering portfolio values in the browser', async ({ page }) => {
  await signIn(page);
  await page.goto('/carteira');
  await page.getByLabel('Selecionar carteira').selectOption({ label: 'Carteira de precisão de teste (BRL)' });
  await expect(page.locator('.stat-value').first()).toHaveText('R$\u00a012.345.678.901.234.567.890,12');
  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await expect(page.locator('.stat-value').first()).toHaveText('••••••');
  await page.getByRole('button', { name: 'Exibir valores' }).click();
  await expect(page.locator('.stat-value').first()).toHaveText('R$\u00a012.345.678.901.234.567.890,12');
});


test('crypto route authenticates and presents persisted Bybit intervals with privacy', async ({ page }) => {
  await page.goto('/cripto');
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page);
  await page.getByRole('link', { name: 'Cripto', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cripto');
  const btc = page.getByRole('article', { name: 'BTCUSDT' });
  await expect(btc).toContainText('68.001,50 USDT');
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('ALTA');
  await expect(btc.getByRole('region', { name: '1h' })).toContainText('BAIXA');
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('+1,25%');
  await expect(btc).toContainText('RSI');
  await expect(btc).toContainText('58,25');
  await expect(btc).toContainText('Início do candle fechado');
  await expect(page.getByText('Custos e spread indisponíveis')).toBeVisible();
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('+0,25%');
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('-1,50%');
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('120,25 USDT');
  await page.screenshot({ path: 'artifacts/atlas-crypto-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await expect(btc).not.toContainText('68.001,50');
  await expect(btc).not.toContainText('68.000,25');
  await expect(btc).not.toContainText('120,25');
  await expect(btc).toContainText('••••••');
  await page.reload();
  await expect(btc).not.toContainText('68.001,50');
});

test('crypto rejects stale and future quotes, stale/open/future-created and incomplete analyses', async ({ page }) => {
  await signIn(page);
  await page.goto('/cripto');
  for (const symbol of ['ETHUSDT', 'SOLUSDT']) {
    const asset = page.getByRole('article', { name: symbol });
    await expect(asset).toContainText('Cotação indisponível');
    await expect(asset).not.toContainText('68.001,50');
    await expect(asset.getByText('Aguardando análise válida', { exact: true })).toHaveCount(2);
    await expect(asset).not.toContainText('ALTA');
    await expect(asset).not.toContainText('BAIXA');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/atlas-crypto-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('link', { name: 'Cripto', exact: true })).toHaveAttribute('aria-current', 'page');
});


test('regression: general markets exclude crypto and retain stock records', async ({ page }) => {
  await signIn(page);
  await page.goto('/mercados');
  await expect(page.getByRole('row').filter({ hasText: 'PETR4' })).toHaveCount(1);
  await page.getByLabel('Buscar ativos', { exact: true }).fill('BTCUSDT');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('.market-strip')).not.toContainText('BTCUSDT');
});

test('regression: stale quote suppresses a fresh persisted crypto trend', async ({ page }) => {
  await signIn(page);
  await page.goto('/cripto');
  const eth = page.getByRole('article', { name: 'ETHUSDT' });
  await expect(eth).toContainText('Cotação indisponível');
  await expect(eth.getByRole('region', { name: '15m' })).toContainText('Aguardando análise válida');
  await expect(eth).not.toContainText('ALTA');
});

test('regression: open crypto page expires quotes and trends without refresh', async ({ page }) => {
  await page.clock.install();
  await signIn(page);
  await page.goto('/cripto');
  const btc = page.getByRole('article', { name: 'BTCUSDT' });
  await expect(btc).toContainText('68.001,50 USDT');
  await expect(btc.getByRole('region', { name: '15m' })).toContainText('ALTA');
  await page.clock.fastForward(121_000);
  await expect(btc).toContainText('Cotação indisponível');
  await expect(btc.getByText('Aguardando análise válida', { exact: true })).toHaveCount(2);
  await expect(btc).not.toContainText('ALTA');
  await expect(btc).not.toContainText('BAIXA');
  await expect(page.getByRole('article', { name: 'SOLUSDT' })).toContainText('Cotação indisponível');
});
