import { defineConfig, devices } from "@playwright/test";

/**
 * Vitrine e Feirões — testes de navegador (etapa 2).
 * Rodam no CI (web-e2e.yml) contra API + Postgres + Redis + MinIO reais.
 * Base: E2E_BASE_URL (padrão http://localhost:3000).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "celular",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
