import { devices, expect, test } from "@playwright/test";
import { expectToast, gotoAuthed, login } from "./helpers";

/**
 * Etapa 6 — acesso da equipe: dono convida, manda o link, vendedor cria a senha no
 * celular, entra e depois troca a senha em "Minha conta".
 */
test.describe("Acesso da equipe — celular", () => {
  test.setTimeout(120_000);

  test("convite por link → vendedor cria senha, entra e troca a senha", async ({ page, browser }) => {
    const tag = Date.now().toString().slice(-7);
    const email = `vendedor.${tag}@acesso-e2e.dev`;

    // 1. Dono convida e recebe o link.
    await login(page);
    await gotoAuthed(page, "/team");
    await page.getByRole("button", { name: "Convidar membro" }).click();
    const invite = page.getByRole("dialog");
    await invite.locator('input[type="email"]').fill(email);
    await invite.locator('input[name="name"]').fill(`Vendedor ${tag}`);
    await invite.getByRole("button", { name: "Registrar convite" }).click();

    const linkDialog = page.getByRole("dialog").filter({ hasText: "Link de convite" });
    await expect(linkDialog).toBeVisible();
    const url = await linkDialog.getByTestId("access-link-url").inputValue();
    expect(url).toMatch(/\/acesso\/[A-Za-z0-9_-]{40,}$/);
    await expect(linkDialog.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/\?text=/,
    );

    // 2. Vendedor abre o link no próprio celular e cria a senha.
    const ctx = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL: test.info().project.use.baseURL,
    });
    const phone = await ctx.newPage();
    await phone.goto(new URL(url).pathname);
    await expect(phone.getByTestId("access-email")).toHaveText(email);
    await phone.getByLabel("Nova senha", { exact: true }).fill("semnumero");
    await phone.getByLabel("Repita a senha", { exact: true }).fill("semnumero");
    await phone.getByRole("button", { name: "Salvar senha" }).click();
    await expect(phone.getByTestId("form-error")).toContainText("letras e números");

    await phone.getByLabel("Nova senha", { exact: true }).fill("Vendedor2026");
    await phone.getByLabel("Repita a senha", { exact: true }).fill("Vendedor2026");
    await phone.getByRole("button", { name: "Salvar senha" }).click();
    await phone.waitForURL(/\/login\?email=/);
    await expect(phone.getByLabel("E-mail", { exact: true })).toHaveValue(email);

    // 3. Link usado não vale de novo.
    const again = await ctx.newPage();
    await again.goto(new URL(url).pathname);
    await expect(again.getByText("Este link não vale mais")).toBeVisible();

    // 4. Entra com a senha criada.
    await phone.getByLabel("Senha", { exact: true }).fill("Vendedor2026");
    await phone.getByRole("button", { name: "Continuar" }).click();
    await phone.waitForURL("**/dashboard");

    // 5. Troca a própria senha.
    await gotoAuthed(phone, "/conta");
    await phone.getByLabel("Senha atual", { exact: true }).fill("Vendedor2026");
    await phone.getByLabel("Nova senha", { exact: true }).fill("Trocada2027");
    await phone.getByLabel("Repita a nova senha", { exact: true }).fill("Trocada2027");
    await phone.getByRole("button", { name: "Trocar senha" }).click();
    await expectToast(phone, "Senha trocada");

    await ctx.close();
  });
});
