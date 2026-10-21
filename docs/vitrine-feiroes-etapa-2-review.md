# Vitrine e Feirões — Etapa 2 · Relatório

**Data:** 2026-10-21 · **Branch:** `claude/vitrine-feiroes-etapa-2` · **Base:** `main` @ `9760466`

## Entregue

| Item | Arquivos |
| --- | --- |
| Estoque: lista com busca, filtro de status e "Vendido" em 1 toque + confirmação | `apps/web/src/app/(app)/inventory/page.tsx` |
| Cadastro e edição de carro (preço em reais, km, câmbio, combustível etc.) | `inventory/new/page.tsx`, `inventory/[vehicleId]/page.tsx`, `features/inventory/vehicle-form.tsx` |
| Fotos: compressão no celular (lado maior 1600 px, JPEG 0,8), envio direto ao R2, capa, ordem e exclusão | `features/inventory/compress-photo.ts`, `photo-manager.tsx` |
| Status com regras iguais às da API (desfazer venda até 24 h e desarquivar só dono/admin) e histórico | `features/inventory/status-actions.tsx` |
| Importação de planilha: modelo CSV/Excel, prévia com erros por linha, importar só as válidas | `inventory/import/page.tsx` |
| Vitrine da loja: WhatsApp, cidade, endereço, aceite do termo, ativar/desativar | `settings/showcase/page.tsx` + `GET/PATCH /api/settings/company/showcase` |
| Termo de uso da vitrine (rascunho, **revisar com advogado**) | `app/(public)/termos/page.tsx` |
| Painel: cartão "carros disponíveis"; menu "Estoque" (todos os papéis) e "Vitrine da loja" (dono/admin) | `dashboard/page.tsx`, `app-shell.tsx`, `rbac.ts`, `nav.ts`, `middleware.ts` |
| `R2_ENDPOINT` opcional (S3 compatível para testes) | `apps/api/src/config/*`, `storage.module.ts` |
| Testes de navegador no celular (Playwright, Pixel 7) rodando no GitHub Actions | `apps/web/e2e/*`, `playwright.config.ts`, `.github/workflows/web-e2e.yml` |

## Regras da vitrine (API)

- Só ativa com: endereço da loja (slug), WhatsApp (10–15 dígitos), cidade e termo aceito. Se faltar algo, responde `SHOWCASE_INCOMPLETE` listando o que falta.
- A data do aceite do termo nunca é sobrescrita. A versão do termo (`v1-2026-11`) aparece na tela.
- Toda alteração gera auditoria `COMPANY_SHOWCASE_UPDATE`.

## Correção encontrada no caminho

O build da API gerava `dist/src/main.js`, mas `start:prod` e o `Dockerfile` executam `dist/main.js`. O deploy em contêiner falharia. Agora o `tsconfig.build.json` compila só `src/`.

## Testes de navegador (celular)

1. Cadastrar carro com 2 fotos → foto chega ao armazenamento como JPEG → trocar capa → marcar vendido → histórico → filtro.
2. "Vendido" em 1 toque direto da lista.
3. Importar planilha com 50 linhas, 3 com erro (linhas 6, 11 e 21) → 47 importados.
4. Ativar a vitrine da loja.

Os testes esperam o menu logado aparecer antes de trocar de página. Sem isso, a navegação interrompia a seleção da loja e a sessão se perdia (só no teste: uma pessoa não troca de página em milissegundos).

No CI, o R2 é substituído por um S3 local (moto). A imagem do MinIO não estava disponível no Docker Hub.

## Verificação

| Verificação | Onde | Resultado |
| --- | --- | --- |
| Testes unitários da API | ambiente de desenvolvimento | 77 suítes, 477 testes passando (antes: 470) |
| Tipos, lint e build da web | ambiente de desenvolvimento | OK |
| URL assinada → upload → HeadObject → leitura pública no S3 local | ambiente de desenvolvimento | OK |
| API CI (inclui e2e de RLS e estoque) | GitHub Actions | OK |
| Web CI (tipos, lint, build) | GitHub Actions | OK |
| Web E2E: 4 testes no celular contra a stack real | GitHub Actions | 4 de 4 passando, sem nova tentativa |

## Para a etapa 5 (deploy)

- O limite de requisições da API é de 120 por minuto **por IP**. A web chama a API por um proxy (`/backend`), então em produção todas as lojas podem chegar com o mesmo IP. Antes do deploy é preciso confiar no IP real (`X-Forwarded-For`) ou ajustar o limite.

## Fora desta etapa

Vitrine pública e contatos → Lead, mais o bloqueio das automações (etapa 3). Feirões (etapa 4). Deploy (etapa 5).
