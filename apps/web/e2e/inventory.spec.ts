import { expect, test } from "@playwright/test";
import { expectToast, login, solidPng } from "./helpers";

test.describe("Estoque — celular", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("cadastra carro com 2 fotos, marca vendido e vê o histórico", async ({ page }) => {
    const model = `Gol E2E ${Date.now().toString().slice(-6)}`;

    await page.goto("/inventory/new");
    await page.getByLabel("Marca").fill("Volkswagen");
    await page.getByLabel("Modelo").fill(model);
    await page.getByLabel("Ano de fabricação").fill("2020");
    await page.getByLabel("Ano do modelo").fill("2021");
    await page.getByLabel("Preço (R$)").fill("59.900");
    await page.getByLabel("Quilometragem").fill("45.000");
    await page.getByRole("button", { name: "Salvar e adicionar fotos" }).click();

    await page.waitForURL(/\/inventory\/[0-9a-f-]{36}$/);
    await expectToast(page, "Carro cadastrado");

    await page.getByTestId("photo-input").setInputFiles([
      { name: "frente.png", mimeType: "image/png", buffer: solidPng(2400, 1600, [200, 30, 30]) },
      { name: "lateral.png", mimeType: "image/png", buffer: solidPng(1200, 900, [30, 30, 200]) },
    ]);
    await expectToast(page, "Fotos enviadas");
    await expect(page.getByTestId("photo-list").locator("li")).toHaveCount(2);
    await expect(page.getByText("2 de 15 fotos")).toBeVisible();
    // A foto grande foi reduzida no navegador e o arquivo existe no armazenamento.
    const firstSrc = await page.getByTestId("photo-list").locator("img").first().getAttribute("src");
    expect(firstSrc).toBeTruthy();
    const photo = await page.request.get(firstSrc as string);
    expect(photo.ok()).toBeTruthy();
    expect(photo.headers()["content-type"]).toBe("image/jpeg");

    // Troca a capa: a segunda vira a primeira.
    await page.getByRole("button", { name: "Usar como capa" }).click();
    await expect(page.getByTestId("photo-list").locator("li").first().getByText("Capa")).toBeVisible();

    await page.getByRole("button", { name: "Vendido" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expectToast(page, "Status: Vendido");
    await expect(page.getByText("Vendido em")).toBeVisible();
    await expect(page.getByTestId("status-history")).toContainText("Disponível → Vendido");

    // Na lista, o filtro "Vendido" mostra o carro.
    await page.goto("/inventory");
    await page.getByLabel("Filtrar por status").click();
    await page.getByRole("option", { name: "Vendido", exact: true }).click();
    await page.getByPlaceholder("Buscar marca, modelo ou versão").fill(model);
    await expect(page.getByTestId("vehicle-list").getByText(model)).toBeVisible();
  });

  test("marca vendido com 1 toque direto na lista", async ({ page }) => {
    const model = `Uno Lista ${Date.now().toString().slice(-6)}`;
    await page.goto("/inventory/new");
    await page.getByLabel("Marca").fill("Fiat");
    await page.getByLabel("Modelo").fill(model);
    await page.getByLabel("Ano de fabricação").fill("2018");
    await page.getByLabel("Ano do modelo").fill("2018");
    await page.getByLabel("Preço (R$)").fill("32.000");
    await page.getByLabel("Quilometragem").fill("80000");
    await page.getByRole("button", { name: "Salvar e adicionar fotos" }).click();
    await page.waitForURL(/\/inventory\/[0-9a-f-]{36}$/);

    await page.goto("/inventory");
    await page.getByPlaceholder("Buscar marca, modelo ou versão").fill(model);
    const card = page.getByTestId("vehicle-list").locator("li").filter({ hasText: model });
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "Vendido" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expectToast(page, "Status: Vendido");
    // Fica fora da lista "Disponível".
    await page.getByLabel("Filtrar por status").click();
    await page.getByRole("option", { name: "Disponível", exact: true }).click();
    await expect(page.getByTestId("vehicle-list").getByText(model)).toHaveCount(0);
  });

  test("importa planilha de 50 linhas com 3 inválidas", async ({ page }) => {
    const tag = `Imp${Date.now().toString().slice(-6)}`;
    const lines = ["marca;modelo;ano_fabricacao;ano_modelo;preco;km;cambio;combustivel"];
    for (let i = 0; i < 50; i += 1) {
      lines.push(`${tag};Modelo ${i};2019;2020;R$ 45.000,00;30.000;manual;flex`);
    }
    lines[5] = `${tag};Ruim;2019;2025;R$ 45.000,00;30.000;manual;flex`;
    lines[10] = `;SemMarca;2019;2020;R$ 45.000,00;30.000;manual;flex`;
    lines[20] = `${tag};Cambio;2019;2020;R$ 45.000,00;30.000;sequencial;flex`;

    await page.goto("/inventory/import");
    await page.getByTestId("import-file-input").setInputFiles({
      name: "estoque.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(lines.join("\n"), "utf8"),
    });
    await expect(page.getByTestId("import-summary")).toContainText("47 de 50 linhas");
    const errors = page.getByTestId("import-errors");
    await expect(errors).toContainText("Linha 6:");
    await expect(errors).toContainText("Linha 11: marca vazia");
    await expect(errors).toContainText('Linha 21: câmbio não reconhecido ("sequencial")');

    await page.getByRole("button", { name: "Importar 47 carros" }).click();
    await expect(page.getByTestId("import-done")).toContainText("47 carros importados");

    await page.goto("/inventory");
    await page.getByPlaceholder("Buscar marca, modelo ou versão").fill(tag);
    await expect(page.getByText("47 carros")).toBeVisible();
  });

  test("configura e ativa a vitrine da loja", async ({ page }) => {
    await page.goto("/settings/showcase");
    await expect(page.getByTestId("showcase-url")).toContainText("/vitrine/");
    await page.getByLabel("WhatsApp da loja").fill("(14) 99999-0000");
    await page.getByLabel("Cidade").fill("Botucatu");
    const terms = page.getByRole("checkbox");
    if (await terms.isEnabled()) await terms.check();

    const toggle = page.getByRole("button", { name: /vitrine$/ });
    if ((await toggle.textContent())?.includes("Desativar")) {
      await toggle.click();
      await expectToast(page, "Vitrine desativada");
    }
    await page.getByRole("button", { name: "Salvar e ativar vitrine" }).click();
    await expectToast(page, "Vitrine ativada");
    await expect(page.getByText("Vitrine ativa")).toBeVisible();
  });
});
