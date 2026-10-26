import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Senha de acesso').fill('atlas-test-password-only');
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
