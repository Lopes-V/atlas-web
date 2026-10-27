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
  await expect(
    page.getByRole("heading", { name: "Novo registro virtual" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/carteira=/);
  await page
    .getByLabel("Data e hora (seu fuso local)")
    .fill("2026-01-01T12:00");
}
async function record(page: Page, kind: string) {
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
  await expect(page.getByText("Nenhuma operação registrada.")).toBeVisible();
  await page
    .getByLabel("Valor (USDT)")
    .fill("12345678901234567890.123456789012345678");
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("status")).toContainText("confirmado");
  await page.locator("#historico summary").first().click();
  await expect(page.locator("#historico")).toContainText(
    "12345678901234567890.123456789012345678",
  );
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
  await expect(
    page.getByRole("heading", { name: "Novo registro virtual" }),
  ).toBeVisible();
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
    page.locator("#historico").getByText("DEPOSIT", { exact: true }),
  ).toHaveCount(1);
});
test("partial valuation stays unavailable and history paginates manually with reversal", async ({
  page,
}) => {
  await login(page, "history@example.test");
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
  await page.screenshot({
    path: "artifacts/atlas-virtual-positions-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/atlas-virtual-positions-mobile.png",
    fullPage: true,
  });
  await context.setOffline(true);
  await page.clock.fastForward(65000);
  await expect(
    page.locator(".virtual-market > div").filter({ hasText: "SOLUSDT" }),
  ).toContainText("Cotação indisponível");
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
    await expect(page.locator(".virtual-stats")).toContainText(
      "Caixa disponível",
    );
    await expect(page.locator("#historico")).toContainText("DEPOSIT");
    await expect(page.locator("#posicoes")).toContainText(
      "Cotação indisponível",
    );
    await expect(
      page.locator(".virtual-market > div").filter({ hasText: "BTCUSDT" }),
    ).toContainText("Cotação indisponível");
    await page.getByLabel("Tipo de operação").selectOption("BUY");
    await page
      .getByLabel("Data e hora (seu fuso local)")
      .fill("2026-01-01T12:00");
    await page
      .getByLabel("Ativo", { exact: true })
      .selectOption({ label: "BTCUSDT — Bitcoin" });
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
    page.locator("#historico").getByText("DEPOSIT", { exact: true }),
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
  await expect(page.locator(".virtual-stats")).toBeHidden();
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
    page.locator("#historico").getByText("DEPOSIT", { exact: true }),
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
