import { test, expect } from "@playwright/test";
test("individual wallet and Auth show truthful missing configuration without fixture balances", async ({
  page,
}) => {
  for (const route of ["/conta", "/virtual"]) {
    await page.goto(route);
    await expect(
      page.getByRole("alert").filter({ hasText: "acesso individual" }),
    ).toContainText("configurado");
    await expect(page.getByLabel("Nome da carteira")).toHaveCount(0);
    await expect(
      page.getByLabel("Senha individual", { exact: true }),
    ).toHaveCount(0);
  }
});
