import { devices, expect, test } from "@playwright/test";
import { expectToast, gotoAuthed, login, solidPng } from "./helpers";

/** "YYYY-MM-DDTHH:mm" no horário de São Paulo (valor de <input type="datetime-local">). */
function spLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Feirão (etapa 4): organizador cria, inscreve carro, publica, imprime QR;
 * visitante lê o QR e pede contato; ao vivo marca vendido; relatório conta tudo.
 */
test.describe("Feirão — celular", () => {
  test.setTimeout(180_000);

  test("do rascunho ao relatório", async ({ page, browser }) => {
    const tag = Date.now().toString().slice(-6);
    const model = `Kwid Feirao ${tag}`;
    const fairName = `Feirão E2E ${tag}`;

    await login(page);

    // Vitrine ativa (precisa para publicar).
    await gotoAuthed(page, "/settings/showcase");
    await page.getByLabel("WhatsApp da loja", { exact: true }).fill("(14) 99999-0000");
    await page.getByLabel("Cidade", { exact: true }).fill("Botucatu");
    const terms = page.getByRole("checkbox");
    if (await terms.isEnabled()) await terms.check();
    const activate = page.getByRole("button", { name: "Salvar e ativar vitrine" });
    if (await activate.isVisible()) {
      await activate.click();
      await expectToast(page, "Vitrine ativada");
    }

    // Carro com foto.
    await gotoAuthed(page, "/inventory/new");
    await page.getByLabel("Marca", { exact: true }).fill("Renault");
    await page.getByLabel("Modelo", { exact: true }).fill(model);
    await page.getByLabel("Ano de fabricação", { exact: true }).fill("2023");
    await page.getByLabel("Ano do modelo", { exact: true }).fill("2023");
    await page.getByLabel("Preço (R$)", { exact: true }).fill("62.000");
    await page.getByLabel("Quilometragem", { exact: true }).fill("12.000");
    await page.getByRole("button", { name: "Salvar e adicionar fotos" }).click();
    await page.waitForURL(/\/inventory\/[0-9a-f-]{36}$/);
    await page.getByTestId("photo-input").setInputFiles([
      { name: "kwid.png", mimeType: "image/png", buffer: solidPng(1200, 900, [200, 120, 20]) },
    ]);
    await expectToast(page, "Fotos enviadas");

    // 1. Cria o feirão (começou há 1 h, termina em 6 h).
    await gotoAuthed(page, "/fairs/new");
    await page.getByLabel("Nome do feirão", { exact: true }).fill(fairName);
    await page.getByLabel("Início", { exact: true }).fill(spLocal(new Date(Date.now() - 3_600_000)));
    await page.getByLabel("Fim", { exact: true }).fill(spLocal(new Date(Date.now() + 6 * 3_600_000)));
    await page.getByLabel("Local", { exact: true }).fill("Pátio da AF Veículos");
    await page.getByRole("button", { name: "Criar feirão" }).click();
    await expectToast(page, "Feirão criado");
    await page.waitForURL(/\/fairs\/[0-9a-f-]{36}$/);
    const fairPath = new URL(page.url()).pathname;
    await expect(page.getByTestId("fair-status")).toHaveText("Rascunho");

    // 2. Inscreve o carro.
    const candidates = page.getByTestId("fair-candidates");
    await candidates.getByPlaceholder("Filtrar modelo").fill(model);
    await candidates.getByRole("checkbox").first().check();
    await candidates.getByRole("button", { name: "Inscrever 1 carro" }).click();
    await expectToast(page, "1 carro inscrito");
    await expect(page.getByTestId("fair-vehicle-list")).toContainText(model);

    // 3. Publica.
    await page.getByRole("button", { name: "Publicar feirão" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("fair-status")).toHaveText("Publicado");
    const publicHref = await page.getByRole("link", { name: "Página pública" }).getAttribute("href");
    expect(publicHref).toMatch(/^\/feirao\/[a-z0-9-]+$/);

    // 4. QR para imprimir.
    await gotoAuthed(page, `${fairPath}/qr`);
    const card = page.getByTestId("qr-card").filter({ hasText: model });
    await expect(card).toHaveCount(1);
    await expect(card.locator("svg")).toHaveCount(1);
    const code = await card.getAttribute("data-qr");
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    // 5. Visitante lê o QR e pede contato.
    const ctx = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL: test.info().project.use.baseURL,
    });
    const pub = await ctx.newPage();
    await pub.goto(`/q/${code}`);
    await pub.waitForURL(/\/carro\/[a-z0-9-]+\?feirao=.+&origem=qr$/);
    await expect(pub.getByTestId("fair-badge")).toContainText(fairName);
    const form = pub.getByTestId("interest-form");
    await form.getByLabel("Seu nome").fill(`Visitante ${tag}`);
    await form.getByLabel("Seu WhatsApp").fill(`(14) 9${tag.slice(0, 4)}-${tag.slice(2)}`);
    await form.getByTestId("consent-contact").check();
    await form.getByRole("button", { name: "Quero que a loja me chame" }).click();
    await expect(pub.getByTestId("interest-done")).toBeVisible();

    // Página do feirão e destaque na vitrine da cidade.
    await pub.goto(publicHref as string);
    await expect(pub.getByTestId("fair-name")).toHaveText(fairName);
    await expect(pub.getByTestId("fair-vehicle-list")).toContainText(model);
    await pub.goto("/vitrine");
    await expect(pub.getByTestId("next-fair")).toBeVisible();

    // 6. Ao vivo: marca vendido com um toque.
    await gotoAuthed(page, fairPath);
    await page.getByRole("button", { name: "Começar (ao vivo)" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("fair-status")).toHaveText("Ao vivo");
    await gotoAuthed(page, `${fairPath}/live`);
    const row = page.getByTestId("live-list").locator("li").filter({ hasText: model });
    await row.getByRole("button", { name: "Vendido" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expectToast(page, "Vendido!");
    await expect(page.getByTestId("counter-fair-sold")).toHaveText("1Vendidos no feirão");

    // Público vê a faixa "Vendido" no feirão.
    await pub.goto(publicHref as string);
    await expect(
      pub.getByTestId("fair-vehicle-list").locator("li").filter({ hasText: model }).getByText("Vendido", { exact: true }),
    ).toBeVisible();

    // 7. Relatório.
    await gotoAuthed(page, `${fairPath}/report`);
    const totals = page.getByTestId("report-totals");
    await expect(totals).toContainText("Vendidos no feirão1");
    await expect(totals).toContainText("Contatos1");
    await expect(totals).toContainText("Leituras de QR1");

    // 8. Encerra: lista congela.
    await gotoAuthed(page, fairPath);
    await page.getByRole("button", { name: "Encerrar feirão" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("fair-status")).toHaveText("Encerrado");
    await expect(page.getByTestId("fair-my-vehicles")).toContainText("congelada");
    await ctx.close();
  });
});
