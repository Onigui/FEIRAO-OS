import { devices, expect, test } from "@playwright/test";
import { expectToast, gotoAuthed, login, solidPng } from "./helpers";

/**
 * Vitrine pública (etapa 3): visitante acha o carro, pede contato, vira lead da loja;
 * vendido sai da vitrine na hora.
 */
test.describe("Vitrine pública — celular", () => {
  test.setTimeout(150_000);

  test("visitante pede contato, loja vê o lead, vendido sai da vitrine", async ({ page, browser }) => {
    const tag = Date.now().toString().slice(-6);
    const model = `Onix Vitrine ${tag}`;
    const visitor = `Cliente ${tag}`;
    const phone = `(14) 9${tag.slice(0, 4)}-${tag.slice(2)}`;

    // 1. Loja com vitrine ativa.
    await login(page);
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

    // 2. Carro com foto.
    await gotoAuthed(page, "/inventory/new");
    await page.getByLabel("Marca", { exact: true }).fill("Chevrolet");
    await page.getByLabel("Modelo", { exact: true }).fill(model);
    await page.getByLabel("Ano de fabricação", { exact: true }).fill("2022");
    await page.getByLabel("Ano do modelo", { exact: true }).fill("2022");
    await page.getByLabel("Preço (R$)", { exact: true }).fill("72.500");
    await page.getByLabel("Quilometragem", { exact: true }).fill("31.000");
    await page.getByRole("button", { name: "Salvar e adicionar fotos" }).click();
    await page.waitForURL(/\/inventory\/[0-9a-f-]{36}$/);
    const vehicleUrl = page.url();
    await page.getByTestId("photo-input").setInputFiles([
      { name: "frente.png", mimeType: "image/png", buffer: solidPng(1600, 1200, [20, 90, 160]) },
    ]);
    await expectToast(page, "Fotos enviadas");
    const publicHref = await page.getByRole("link", { name: "Ver na vitrine" }).getAttribute("href");
    expect(publicHref).toMatch(/^\/carro\/[a-z0-9-]+$/);

    // 3. Visitante anônimo, outro navegador (celular).
    const ctx = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL: test.info().project.use.baseURL,
    });
    const pub = await ctx.newPage();
    await pub.goto(`/vitrine?q=${encodeURIComponent(model)}`);
    const card = pub.getByTestId("public-vehicle-list").getByRole("link").filter({ hasText: model });
    await expect(card).toHaveCount(1);
    await expect(card.locator("img")).toHaveCount(1);
    await card.click();
    await pub.waitForURL(`**${publicHref}`);
    await expect(pub.getByTestId("vehicle-title")).toContainText(model);
    await expect(pub.getByText("R$ 72.500", { exact: true })).toBeVisible();
    const wa = await pub.getByTestId("whatsapp-button").getAttribute("href");
    expect(wa).toContain("https://wa.me/5514999990000?text=");
    expect(decodeURIComponent(wa ?? "")).toContain(model);

    // 4. Formulário: autorização 1 é obrigatória.
    const form = pub.getByTestId("interest-form");
    await form.getByLabel("Seu nome").fill(visitor);
    await form.getByLabel("Seu WhatsApp").fill(phone);
    await form.getByRole("button", { name: "Quero que a loja me chame" }).click();
    await expect(form.getByRole("alert")).toContainText("autorização");
    await form.getByTestId("consent-contact").check();
    await form.getByRole("button", { name: "Quero que a loja me chame" }).click();
    await expect(pub.getByTestId("interest-done")).toContainText("vai falar com você");

    // 5. A loja vê o lead com a origem e o carro.
    await gotoAuthed(page, "/leads");
    await page.getByPlaceholder("Buscar nome ou telefone").fill(visitor);
    const leadCard = page.getByRole("link").filter({ hasText: visitor });
    await expect(leadCard).toHaveCount(1);
    await expect(leadCard.getByTestId("lead-origin")).toContainText(model);
    await leadCard.click();
    const interests = page.getByTestId("lead-vehicle-interests");
    await expect(interests).toContainText(model);
    await expect(interests).toContainText("Sem autorização de ofertas");

    // 6. Vendido sai da vitrine na hora.
    await gotoAuthed(page, new URL(vehicleUrl).pathname);
    await page.getByRole("button", { name: "Vendido" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expectToast(page, "Status: Vendido");
    await pub.reload();
    await expect(pub.getByTestId("sold-banner")).toBeVisible();
    await expect(pub.getByTestId("interest-form")).toHaveCount(0);
    await pub.goto(`/vitrine?q=${encodeURIComponent(model)}`);
    await expect(pub.getByText("Nenhum carro com esses filtros")).toBeVisible();

    // 7. Política de privacidade.
    await pub.goto("/privacidade");
    await expect(pub.getByRole("heading", { name: "Política de privacidade da vitrine" })).toBeVisible();
    await ctx.close();
  });
});
