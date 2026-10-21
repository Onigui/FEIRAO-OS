import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner@test.autopilot.dev";
export const OWNER_PASSWORD = process.env.E2E_PASSWORD ?? "Demo@12345";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(OWNER_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Navegação com recarga completa numa página logada. Se a sessão cair e a
 * página voltar para /login, falha mostrando as respostas de erro da API
 * (o relatório do CI fica legível sem baixar o trace).
 */
export async function gotoAuthed(page: Page, path: string) {
  const failures: string[] = [];
  const onResponse = (res: import("@playwright/test").Response) => {
    if (res.url().includes("/backend/") && res.status() >= 400) {
      failures.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
    }
  };
  const onFailed = (req: import("@playwright/test").Request) => {
    if (req.url().includes("/backend/")) {
      failures.push(`FALHOU ${req.method()} ${new URL(req.url()).pathname} ${req.failure()?.errorText ?? ""}`);
    }
  };
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  await page.goto(path);
  // Espera o fim da checagem de sessão: ou o menu logado aparece, ou volta para /login.
  await page.waitForFunction(
    () => location.pathname === "/login" || document.querySelector('a[href="/inventory"]') !== null,
    undefined,
    { timeout: 20_000 },
  );
  page.off("response", onResponse);
  page.off("requestfailed", onFailed);
  if (new URL(page.url()).pathname === "/login") {
    throw new Error(`Sessão perdida ao abrir ${path}. Respostas da API: ${failures.join(" | ") || "nenhum erro"}`);
  }
}

/** PNG sólido gerado em memória (sem arquivos binários no repo). */
export function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
