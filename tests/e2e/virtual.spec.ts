import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email = "wallet-a@example.test") {
  await page.goto("/conta");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Senha individual", { exact: true })
    .fill("test-password-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/virtual$/);
}
async function create(page: Page, email?: string) {
  await login(page, email);
  await page.getByLabel("Nome da carteira").fill(`Teste ${test.info().testId}`);
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(page).toHaveURL(/carteira=/);
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await expect(
    page.getByRole("heading", { name: "Novo registro virtual" }),
  ).toBeVisible();
  await page
    .getByLabel("Data e hora (seu fuso local)")
    .fill("2026-01-01T12:00");
}
async function record(page: Page, kind: string) {
  const next = page.getByRole("button", { name: "Novo registro", exact: true });
  if (await next.isVisible()) await next.click();
  await page.getByLabel("Tipo de operação").selectOption(kind);
}
test("individual account is separate from shared administrator and signup honestly awaits email confirmation", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "atlas-session", value: "forged", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/virtual");
  await expect(page).toHaveURL(/\/conta/);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("signup@example.test");
  await page
    .getByLabel("Senha individual", { exact: true })
    .fill("test-password-only");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmação");
  expect(
    (await context.cookies()).some((c) => c.name === "atlas-virtual-access"),
  ).toBe(false);
});
test("wallet starts empty, records exact deposit/trades/swap and supports history, privacy and mobile", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await create(page);
  const cookies = await context.cookies();
  for (const name of ["atlas-virtual-access", "atlas-virtual-refresh"]) {
    const cookie = cookies.find((c) => c.name === name);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  }
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.locator("#historico > details > summary").click();
  await expect(page.getByText("Nenhuma operação registrada.")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await page
    .getByLabel("Valor (USDT)")
    .fill("12345678901234567890.123456789012345678");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("status")).toContainText("confirmado");
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.locator("#historico > details > summary").click();
  await page.getByText("Detalhes do registro 1", { exact: true }).click();
  await expect(page.locator("#historico")).toContainText(
    "12345678901234567890.123456789012345678",
  );
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  for (const kind of ["BUY", "SELL"]) {
    await record(page, kind);
    await page
      .getByLabel("Ativo", { exact: true })
      .selectOption({ label: "BTCUSDT — Bitcoin" });
    await page.getByLabel("Quantidade", { exact: true }).fill("1");
    await page.getByLabel("Preço unitário (USDT)", { exact: true }).fill("10");
    await page.getByLabel("Taxa (USDT)", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Registrar operação" }).click();
    await expect(page.locator("#historico")).toContainText(kind);
  }
  await record(page, "SWAP");
  for (const leg of ["Venda", "Compra"]) {
    await page.getByLabel(`${leg}: ativo`).selectOption({
      label: leg === "Venda" ? "BTCUSDT — Bitcoin" : "ETHUSDT — Ethereum",
    });
    await page.getByLabel(`${leg}: quantidade`).fill("1");
    await page.getByLabel(`${leg}: preço unitário (USDT)`).fill("10");
    await page.getByLabel(`${leg}: taxa (USDT)`).fill("0");
  }
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#historico")).toContainText("SWAP");
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.locator("#historico")).not.toContainText(
    "12345678901234567890",
  );
  await page.screenshot({
    path: "artifacts/atlas-virtual-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/atlas-virtual-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sair da conta individual" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto("/virtual");
  await expect(page).toHaveURL(/\/conta/);
  expect(errors).toEqual([]);
});
test("missing schema is a setup status, never a fake wallet", async ({
  page,
}) => {
  await login(page, "missing@example.test");
  await expect(
    page.getByRole("alert").filter({ hasText: "ativada" }),
  ).toContainText("ativada");
  await expect(page.getByLabel("Nome da carteira")).toHaveCount(0);
});
test("expired sessions renew only through same-origin POST and user B cannot select user A wallet", async ({
  page,
  context,
  request,
}) => {
  await create(page);
  const walletUrl = page.url();
  await context.addCookies([
    {
      name: "atlas-virtual-access",
      value: "expired",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
    },
  ]);
  await page.goto(walletUrl);
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await expect(
    page.getByRole("heading", { name: "Novo registro virtual" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  const csrf = await request.post("/conta/renovar/sessao", {
    headers: { Origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
  await page.getByRole("button", { name: "Sair da conta individual" }).click();
  await login(page, "wallet-b@example.test");
  await page.goto(walletUrl);
  await expect(
    page.getByRole("alert").filter({ hasText: "pertence" }),
  ).toContainText("pertence");
});
test("validation rejects decimals beyond database scale and retries retain the idempotency key", async ({
  page,
}) => {
  await create(page);
  await page.getByLabel("Valor (USDT)").fill("1.0000000000000000001");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "18" })).toContainText(
    "18",
  );
  await page.getByLabel("Valor (USDT)").fill("777");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "mesma chave" }),
  ).toContainText("mesma chave");
  await page.getByRole("button", { name: "Atualizar cotações" }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar cotações" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("status")).toContainText("confirmado");
  expect(
    await page.locator('#registro input[name="key"]').inputValue(),
  ).not.toBe(key);
  await expect(
    page.locator("#historico").getByText("Código: DEPOSIT", { exact: true }),
  ).toHaveCount(1);
});
test("partial valuation stays unavailable and history paginates manually with reversal", async ({
  page,
}) => {
  await login(page, "history@example.test");
  await page.locator("#historico > details > summary").click();
  await expect(
    page.getByText("Patrimônio incompleto", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#posicoes")).toContainText("Cotação indisponível");
  await page.getByRole("button", { name: "Carregar mais operações" }).click();
  await page.getByText("Detalhes do registro 1", { exact: true }).click();
  await expect(page.locator("#historico")).toContainText("2.12345");
  await page
    .getByRole("button", { name: "Estornar operação 1", exact: true })
    .click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("REVERSAL");
  await page
    .getByLabel("Data e hora (seu fuso local)")
    .fill("2026-01-01T12:00");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#historico")).toContainText("REVERSAL");
});

test("open position expires without refresh and browser bundles never receive a service key", async ({
  page,
  context,
}) => {
  await page.clock.install();
  const external: string[] = [],
    scripts: Promise<string>[] = [];
  page.on("request", (request) => {
    if (request.url().includes("supabase.co")) external.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().includes("/_next/") && response.url().includes(".js"))
      scripts.push(response.text().catch(() => ""));
  });
  await login(page, "fresh@example.test");
  await expect(
    page.getByRole("heading", { name: "Patrimônio virtual", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#posicoes")).toContainText("10,00");
  await expect(page.locator("#posicoes")).toContainText("Preço atual");
  await expect(page.locator("#posicoes")).toContainText("Valor da posição");
  await page.screenshot({
    path: "artifacts/atlas-virtual-positions-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/atlas-virtual-positions-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simular BTCUSDT" }).click();
  await page
    .getByLabel("Ativo de destino")
    .selectOption({ label: "SOLUSDT — Solana" });
  await expect(
    page.getByText("Cotações Kraken atuais indisponíveis para simular."),
  ).toBeVisible();
  await context.setOffline(true);
  await page.clock.fastForward(65000);
  await page.clock.fastForward(56000);
  await expect(
    page.getByRole("heading", { name: "Patrimônio incompleto", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#posicoes")).toContainText("Cotação indisponível");
  expect(external).toEqual([]);
  expect((await Promise.all(scripts)).join("")).not.toContain(
    "sb_secret_test_only_never_real",
  );
});
test("wallet creation keeps its request key and name after a lost acknowledgement and read refresh", async ({
  page,
}) => {
  await login(page);
  const form = page.getByLabel("Nome da carteira").locator("..").locator("..");
  await page.getByLabel("Nome da carteira").fill("Retry wallet");
  const key = await form.locator('input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "mesma chave" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Atualizar cotações" }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar cotações" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Nome da carteira")).toHaveValue("Retry wallet");
  expect(await form.locator('input[name="key"]').inputValue()).toBe(key);
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(page).toHaveURL(/carteira=/);
  await expect(
    page.getByRole("link", { name: "Retry wallet", exact: true }),
  ).toHaveCount(1);
  await page.getByText("Criar outra carteira").click();
  await page.getByLabel("Nome da carteira").fill("Second wallet");
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(
    page.getByRole("link", { name: "Second wallet", exact: true }),
  ).toHaveCount(1);
});

for (const mode of ["zero-quote", "wrong-currency"]) {
  test(`${mode} latest quote remains unavailable while cash, history and manual records stay usable`, async ({
    page,
  }) => {
    await login(page, `${mode}@example.test`);
    await expect(
      page.getByRole("heading", { name: "Patrimônio incompleto", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".virtual-stats").first()).toContainText(
      "Caixa disponível",
    );
    await expect(page.locator("#historico")).toContainText("DEPOSIT");
    await expect(page.locator("#posicoes")).toContainText(
      "Cotação indisponível",
    );
    await page.getByRole("button", { name: "Comprar", exact: true }).click();
    await page.getByLabel("Tipo de operação").selectOption("BUY");
    await page
      .getByLabel("Data e hora (seu fuso local)")
      .fill("2026-01-01T12:00");
    await page
      .getByLabel("Ativo", { exact: true })
      .selectOption({ label: "BTCUSDT — Bitcoin" });
    await expect(
      page.getByRole("button", { name: "Usar cotação atual" }),
    ).toHaveCount(0);
    await page.getByLabel("Quantidade", { exact: true }).fill("1");
    await page.getByLabel("Preço unitário (USDT)", { exact: true }).fill("10");
    await page.getByLabel("Taxa (USDT)", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Registrar operação" }).click();
    await expect(page.locator("#registro").getByRole("status")).toContainText(
      "confirmado",
    );
    await expect(page.locator("#historico")).toContainText("BUY");
  });
}

test("ambiguous operation keeps its exact draft and key through a failed 30s read and recovery", async ({
  page,
}) => {
  await page.clock.install();
  await create(page, "retry-read-operation@example.test");
  await page.getByLabel("Valor (USDT)").fill("777");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toContainText(
    "mesma chave",
  );
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await page.clock.runFor(30001);
  await expect(
    page.getByRole("alert").filter({ hasText: "última leitura confirmada" }),
  ).toBeVisible();
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await expect(
    page.getByRole("button", { name: "Registrar operação" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tentar atualizar leitura" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "última leitura confirmada" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("status")).toContainText(
    "confirmado",
  );
  await expect(
    page.locator("#historico").getByText("Código: DEPOSIT", { exact: true }),
  ).toHaveCount(1);
  expect(
    await page.locator('#registro input[name="key"]').inputValue(),
  ).not.toBe(key);
});

test("ambiguous creation keeps its exact name and key through a failed 30s read and recovery", async ({
  page,
}) => {
  await page.clock.install();
  await login(page, "retry-read-create@example.test");
  const form = page.getByLabel("Nome da carteira").locator("..").locator("..");
  await page.getByLabel("Nome da carteira").fill("Retry preserved wallet");
  const key = await form.locator('input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "mesma chave" }),
  ).toBeVisible();
  await page.clock.runFor(30001);
  await expect(
    page.getByRole("alert").filter({ hasText: "última leitura confirmada" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome da carteira")).toHaveValue(
    "Retry preserved wallet",
  );
  expect(await form.locator('input[name="key"]').inputValue()).toBe(key);
  await expect(
    page.getByRole("button", { name: "Criar carteira USDT" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tentar atualizar leitura" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "última leitura confirmada" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Nome da carteira")).toHaveValue(
    "Retry preserved wallet",
  );
  expect(await form.locator('input[name="key"]').inputValue()).toBe(key);
  await page.getByRole("button", { name: "Criar carteira USDT" }).click();
  await expect(page).toHaveURL(/carteira=/);
  await expect(
    page.getByRole("link", { name: "Retry preserved wallet", exact: true }),
  ).toHaveCount(1);
});

test("an initial transient read never enables writes without a confirmed screen", async ({
  page,
}) => {
  await login(page, "initial-readfail@example.test");
  await expect(
    page.getByRole("alert").filter({ hasText: "indisponível" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tentar atualizar leitura" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome da carteira")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Registrar operação" }),
  ).toHaveCount(0);
});

test("ambiguous write stays hidden with its original key during Auth503 and restores only after same-user verification", async ({
  page,
}) => {
  await page.clock.install();
  await create(page, "retry-auth-operation@example.test");
  await page.getByLabel("Valor (USDT)").fill("777");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toContainText(
    "mesma chave",
  );
  await page.clock.runFor(30001);
  await expect(
    page.getByRole("alert").filter({ hasText: "verificar sua sessão" }),
  ).toBeVisible();
  await expect(page.locator("#registro")).toBeHidden();
  await expect(page.locator(".virtual-stats").first()).toBeHidden();
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await expect(page.locator('#registro input[name="amount"]')).toHaveValue(
    "777",
  );
  await page.getByRole("button", { name: "Tentar atualizar leitura" }).click();
  await expect(page.locator("#registro")).toBeVisible();
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("status")).toContainText(
    "confirmado",
  );
  await expect(
    page.locator("#historico").getByText("Código: DEPOSIT", { exact: true }),
  ).toHaveCount(1);
});

test("a newly verified different identity clears a hidden prior-user retry screen", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await create(page, "retry-auth-operation@example.test");
  await page.getByLabel("Valor (USDT)").fill("777");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toContainText(
    "mesma chave",
  );
  await page.clock.runFor(30001);
  await expect(
    page.getByRole("alert").filter({ hasText: "verificar sua sessão" }),
  ).toBeVisible();
  await expect(page.locator("#registro")).toBeHidden();
  await context.clearCookies();
  const otherPage = await context.newPage();
  await login(otherPage, "new-identity@example.test");
  await page.getByRole("button", { name: "Tentar atualizar leitura" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "pertence" }),
  ).toBeVisible();
  await expect(page.locator("#registro")).toHaveCount(0);
  await expect(page.locator("#historico")).toHaveCount(0);
  await expect(page.locator('input[name="amount"]')).toHaveCount(0);
  await otherPage.close();
});

test("wallet actions open on demand and preserve a retry draft when closed", async ({
  page,
}) => {
  await login(page, "fresh@example.test");
  await expect(
    page.getByRole("heading", { name: "Novo registro virtual" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("DEPOSIT");
  await page.getByLabel("Valor (USDT)").fill("777");
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
});

test("simulation requires fees, prepares an explicit swap, and expires", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await login(page, "fresh@example.test");
  await page.getByRole("button", { name: "Simular BTCUSDT" }).click();
  await expect(page.getByLabel("Posição de origem")).toHaveValue(
    "00000000-0000-4000-8000-000000000201",
  );
  await page
    .getByLabel("Ativo de destino")
    .selectOption({ label: "ETHUSDT — Ethereum" });
  await expect(
    page.getByRole("button", { name: "Preparar troca" }),
  ).toBeDisabled();
  await page.getByLabel("Taxa de venda (USDT)").fill("0");
  await page.getByLabel("Taxa de compra (USDT)").fill("0");
  await page.getByLabel("Hipótese origem (%)").fill("10");
  await page.getByLabel("Hipótese destino (%)").fill("5");
  await expect(
    page.getByRole("button", { name: "Preparar troca" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Preparar troca" }).click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("SWAP");
  await expect(page.getByLabel("Venda: quantidade")).toHaveValue("0.25");
  await expect(page.getByLabel("Compra: taxa (USDT)")).toHaveValue("0");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("status")).toContainText(
    "confirmado",
  );
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await context.setOffline(true);
  await page.clock.fastForward(121000);
  await expect(
    page.getByRole("button", { name: "Preparar troca" }),
  ).toBeDisabled();
});

test("closed research history preserves gaps and hides values", async ({
  page,
}) => {
  await login(page, "fresh@example.test");
  await page.getByText("Contexto de mercado", { exact: true }).click();
  await expect(page.getByText("Intervalos alinhados").first()).toBeVisible();
  await page.getByText("Histórico de preços fechados · Kraken").first().click();
  await expect(page.getByText("Intervalo sem dados ·").first()).toBeVisible();
  await expect(
    page.locator(".candle-history").first().locator("li"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.locator(".candle-history")).toHaveCount(0);
});

test("selling a selected holding offers exact fractions and current quote", async ({
  page,
}) => {
  await login(page, "fresh@example.test");
  await page.getByRole("button", { name: "Vender BTCUSDT" }).click();
  await expect(page.getByLabel("Ativo", { exact: true })).toHaveValue(
    "00000000-0000-4000-8000-000000000201",
  );
  await page.getByRole("button", { name: "25%", exact: true }).click();
  await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue(
    "0.25",
  );
  await page.getByRole("button", { name: "100%", exact: true }).click();
  await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Usar cotação atual" }).click();
  await expect(page.getByLabel("Preço unitário (USDT)")).toHaveValue("10");
});

test("position distinguishes unit quote from total value", async ({ page }) => {
  await login(page, "fresh-two@example.test");
  const position = page.locator("#posicoes");
  await expect(
    position.locator("dt").filter({ hasText: "Preço atual" }).locator("+ dd"),
  ).toHaveText("10,00 USDT");
  await expect(
    position
      .locator("dt")
      .filter({ hasText: "Valor da posição" })
      .locator("+ dd"),
  ).toHaveText("20,00 USDT");
});

test("prepared swap expires while closed and requires an explicit manual price choice", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await login(page, "fresh@example.test");
  await page.getByRole("button", { name: "Simular BTCUSDT" }).click();
  await page
    .getByLabel("Ativo de destino")
    .selectOption({ label: "ETHUSDT — Ethereum" });
  await page.getByLabel("Taxa de venda (USDT)").fill("0");
  await page.getByLabel("Taxa de compra (USDT)").fill("0");
  await page.getByRole("button", { name: "Preparar troca" }).click();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await context.setOffline(true);
  await page.clock.fastForward(121000);
  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  await expect(
    page.getByText("As cotações preparadas expiraram", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar operação" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Usar preços declarados manualmente" })
    .click();
  await expect(
    page.getByRole("button", { name: "Registrar operação" }),
  ).toBeEnabled();
});

test("new confirmed draft uses current local time while ambiguous retry keeps its date and payload", async ({
  page,
}) => {
  await page.clock.install();
  await create(page);
  await page.getByLabel("Valor (USDT)").fill("1");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("status")).toContainText(
    "confirmado",
  );
  const old = await page
    .getByLabel("Data e hora (seu fuso local)")
    .inputValue();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.clock.runFor(120000);
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  const next = await page
    .getByLabel("Data e hora (seu fuso local)")
    .inputValue();
  expect(next).not.toBe(old);
  await page
    .getByLabel("Data e hora (seu fuso local)")
    .fill("2026-01-01T12:00");
  const retryDate = await page
    .getByLabel("Data e hora (seu fuso local)")
    .inputValue();
  await page.getByLabel("Valor (USDT)").fill("777");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toContainText(
    "mesma chave",
  );
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.clock.runFor(120000);
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(
    page.getByText("Resolva o envio anterior", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("DEPOSIT");
  await expect(page.getByLabel("Data e hora (seu fuso local)")).toHaveValue(
    retryDate,
  );
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("777");
  await expect(page.getByLabel("Valor (USDT)")).toHaveAttribute("readonly", "");
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
});

test("definitive validation rejection permits an explicit new buy draft", async ({
  page,
}) => {
  await create(page);
  await page.getByLabel("Valor (USDT)").fill("1.0000000000000000001");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toContainText(
    "18",
  );
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar novo rascunho" }).click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("BUY");
  expect(
    await page.locator('#registro input[name="key"]').inputValue(),
  ).not.toBe(key);
});

test("a rejected read after a committed write remains uncertain", async ({
  page,
}) => {
  await create(page, "post-write-read-request@example.test");
  await page.getByLabel("Valor (USDT)").fill("42");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(
    page.getByText("Resolva o envio anterior", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar novo rascunho" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Valor (USDT)")).toHaveValue("42");
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(
    page
      .locator("#registro")
      .getByRole("status")
      .filter({ hasText: "confirmado" }),
  ).toBeVisible();
});

test("changing operation type clears prepared swap prices", async ({
  page,
}) => {
  await login(page, "fresh@example.test");
  await page.getByRole("button", { name: "Simular BTCUSDT" }).click();
  await page
    .getByLabel("Ativo de destino")
    .selectOption({ label: "ETHUSDT — Ethereum" });
  await page.getByLabel("Taxa de venda (USDT)").fill("0");
  await page.getByLabel("Taxa de compra (USDT)").fill("0");
  await page.getByRole("button", { name: "Preparar troca" }).click();
  await page.getByLabel("Tipo de operação").selectOption("BUY");
  await page.getByRole("button", { name: "Substituir rascunho" }).click();
  await page.getByLabel("Tipo de operação").selectOption("SWAP");
  await expect(page.getByLabel("Venda: preço unitário (USDT)")).toHaveValue("");
  await expect(page.getByLabel("Compra: preço unitário (USDT)")).toHaveValue(
    "",
  );
});

test("an open confirmed drawer starts the next draft with current time only on request", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await create(page);
  await page.getByLabel("Valor (USDT)").fill("1");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.locator("#registro").getByRole("status")).toContainText(
    "confirmado",
  );
  await expect(page.getByLabel("Valor (USDT)")).toBeHidden();
  await context.setOffline(true);
  await page.clock.fastForward(7200000);
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  const expected = await page.evaluate(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await expect(page.getByLabel("Data e hora (seu fuso local)")).toHaveValue(
    expected,
  );
});

for (const kind of ["Comprar", "Vender"]) {
  test(`${kind} selected asset retains unsent draft after closing`, async ({
    page,
  }) => {
    await login(page, "fresh@example.test");
    await page.getByRole("button", { name: `${kind} BTCUSDT` }).click();
    await page
      .getByLabel("Data e hora (seu fuso local)")
      .fill("2026-01-01T12:00");
    await page.getByLabel("Quantidade", { exact: true }).fill("0.25");
    await page.getByLabel("Preço unitário (USDT)").fill("11");
    await page.getByLabel("Taxa (USDT)", { exact: true }).fill("0.1");
    const key = await page.locator('#registro input[name="key"]').inputValue();
    await page.getByRole("button", { name: "Fechar registro" }).click();
    await page.getByRole("button", { name: `${kind} BTCUSDT` }).click();
    await expect(page.getByLabel("Data e hora (seu fuso local)")).toHaveValue(
      "2026-01-01T12:00",
    );
    await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue(
      "0.25",
    );
    await expect(page.getByLabel("Preço unitário (USDT)")).toHaveValue("11");
    await expect(page.getByLabel("Taxa (USDT)", { exact: true })).toHaveValue(
      "0.1",
    );
    expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
      key,
    );
  });
}

test("a different action requires explicit replacement of an unsent draft", async ({
  page,
}) => {
  await login(page, "fresh@example.test");
  await page.getByRole("button", { name: "Vender BTCUSDT" }).click();
  await page.getByLabel("Quantidade", { exact: true }).fill("0.5");
  const key = await page.locator('#registro input[name="key"]').inputValue();
  await page.getByRole("button", { name: "Fechar registro" }).click();
  await page.getByRole("button", { name: "Comprar BTCUSDT" }).click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("SELL");
  await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue(
    "0.5",
  );
  expect(await page.locator('#registro input[name="key"]').inputValue()).toBe(
    key,
  );
  await page.getByRole("button", { name: "Substituir rascunho" }).click();
  await expect(page.getByLabel("Tipo de operação")).toHaveValue("BUY");
  await expect(page.getByLabel("Quantidade", { exact: true })).toHaveValue("");
});
