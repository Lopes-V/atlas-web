import { test, expect } from '@playwright/test';

test('opens setup without fabricated financial data and navigates all sections', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mais clareza.Melhores decisões.');
  await expect(page.getByText('Conexão pendente', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configurar conexão', exact: true }).first()).toBeVisible();
  await expect(page.locator('.stat-value').first()).toHaveText('—');
  for (const [route, title] of [['cripto', 'Cripto'], ['mercados', 'Mercados'], ['carteira', 'Minha carteira'], ['oportunidades', 'Oportunidades'], ['alertas', 'Alertas'], ['renda-fixa', 'Renda fixa'], ['sistema', 'Estado do sistema'], ['configuracoes', 'Configurações']]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
  expect(errors).toEqual([]);
});

test('mobile navigation and page layout stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['', 'cripto', 'mercados', 'carteira', 'oportunidades', 'alertas', 'renda-fixa', 'sistema', 'configuracoes', 'login']) {
    await page.goto(`/${route}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await page.getByRole('link', { name: 'Abrir carteira anterior' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Minha carteira');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/atlas-mobile.png', fullPage: true });
});

test('unknown routes show a real 404 and keyboard skip link works', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.screenshot({ path: 'artifacts/atlas-desktop.png', fullPage: true });
});
