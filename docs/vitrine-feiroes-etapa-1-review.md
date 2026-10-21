# Vitrine e Feirões — Etapa 1 · Relatório

**Data:** 2026-10-21 · **Branch:** `claude/vitrine-feiroes-etapa-1` · **Base:** `main` @ `eebdb70`

## Entregue

| Item | Arquivos |
| --- | --- |
| Modelos novos e campos da vitrine em `Company` | `prisma/schema.prisma` |
| Migration escrita à mão (padrão do repo): 7 enums, 8 tabelas, índices, FKs e 21 políticas RLS | `prisma/migrations/20261021150000_vitrine_feiroes_v1/migration.sql` |
| Flag de leitura pública `app.public_read` (mesmo comando SQL do bypass: continua com 2 comandos por transação) | `src/prisma/rls-context.ts`, `rls-session.ts`, `extensions/rls-session.extension.ts` |
| Extensão de tenant: `vehicle`, `vehiclePhoto`, `vehicleStatusTransition`, `leadVehicleInterest`. Exclusão lógica: `vehicle`, `fair` | `src/prisma/extensions/*.ts` |
| Módulo `inventory` (registrado no `AppModule`) | `src/modules/inventory/**` |
| `StorageService.headObject` (confirma que a foto chegou ao R2) | `src/modules/storage/storage.service.ts` |
| Testes e2e: 26 cenários de RLS e fluxos da API | `test/vitrine-feiroes-rls.e2e-spec.ts`, `test/vitrine-feiroes-inventory.e2e-spec.ts` |
| CI: roda em `claude/**` e falha se houver drift do Prisma nas tabelas novas (`scripts/check-vitrine-drift.sh`) | `.github/workflows/api-ci.yml`, `web-ci.yml` |

## API nova

| Método e rota | Papéis | O que faz |
| --- | --- | --- |
| `GET /api/inventory/vehicles` | todos | Lista (sem arquivados por padrão), busca, status, paginação |
| `POST /api/inventory/vehicles` | todos | Cadastra (`AVAILABLE`), gera `slug` e `showcaseCode` |
| `GET /api/inventory/vehicles/:id` | todos | Detalhe com fotos |
| `PATCH /api/inventory/vehicles/:id` | todos | Edita |
| `DELETE /api/inventory/vehicles/:id` | OWNER, ADMIN | Exclusão lógica |
| `POST /api/inventory/vehicles/:id/status` | todos* | Muda status; *desfazer venda (até 24 h) e desarquivar só OWNER/ADMIN |
| `GET /api/inventory/vehicles/:id/status-history` | todos | Histórico |
| `POST /api/inventory/vehicles/:id/photos/upload-url` | todos | URL assinada (PUT no R2, 5 min; tipo e tamanho assinados) |
| `POST /api/inventory/vehicles/:id/photos` | todos | Confirma a foto depois de checar o arquivo no R2 |
| `PUT /api/inventory/vehicles/:id/photos/order` | todos | Reordena (a primeira é a capa) |
| `DELETE /api/inventory/vehicles/:id/photos/:photoId` | todos | Remove do banco e do R2 |
| `GET /api/inventory/import/template?format=csv\|xlsx` | OWNER, ADMIN | Modelo de planilha |
| `POST /api/inventory/import/preview` | OWNER, ADMIN | Lê CSV/XLSX (até 2 MB, 500 linhas) e devolve válidas + erros por linha |
| `POST /api/inventory/import/commit` | OWNER, ADMIN | Grava as válidas numa transação; tudo é validado de novo |

## Decisões tomadas

- **Commit da importação sem estado no servidor.** O cliente devolve as linhas válidas da prévia e a API valida tudo de novo, então não há tabela de lotes. Se um dia for preciso auditar o arquivo original, reaproveita-se `lead_import_batches` como modelo.
- **Mudança de status protegida contra corrida.** O `UPDATE ... WHERE status = <status lido>` impede que duas pessoas marquem o mesmo carro ao mesmo tempo. Quem chegar depois recebe 409.
- **Foto só é registrada depois de confirmada no R2.** A API checa a existência, o tipo e o tamanho do arquivo. A chave precisa estar dentro de `vehicles/<loja>/<veículo>/`.
- **`slug` da loja.** Não mudei nada: o repositório já tinha um índice único parcial (`uq_companies_slug_active`).
- **RLS testado de verdade no CI.** O Postgres do CI roda como superusuário, que ignora RLS. O teste cria o papel `vf_rls_tester` (sem `BYPASSRLS`) e roda cada cenário com `SET LOCAL ROLE`.
- **Migration escrita à mão.** O motor do Prisma não baixa neste ambiente, e o repositório já seguia esse padrão. O passo "Prisma drift report" do CI mostra o que o Prisma ainda mudaria.

## Fora desta etapa

Telas (etapa 2), rotas públicas e contatos (etapa 3), feirões (etapa 4). As tabelas `fairs*`, `lead_vehicle_interests` e `showcase_analytics_events` já existem, mas ainda sem API.

## Verificação

| Verificação | Onde | Resultado |
| --- | --- | --- |
| Testes unitários da API | ambiente de desenvolvimento | 77 suítes, 470 testes, todos passando (antes: 74 / 398) |
| Lint dos arquivos novos e alterados | ambiente de desenvolvimento | sem erros |
| Tipos (`tsconfig.build.json`) | ambiente de desenvolvimento | OK |
| As 22 migrations aplicadas em ordem num PostgreSQL 16 | ambiente de desenvolvimento | OK; 21 políticas criadas |
| e2e (RLS + estoque), drift e build | GitHub Actions | OK (ver "Resultado do CI") |

## Resultado do CI

GitHub Actions, branch `claude/vitrine-feiroes-etapa-1`:

| Passo | Resultado |
| --- | --- |
| Lint, testes unitários, `prisma migrate deploy` (22 migrations) e seed | OK |
| **Prisma drift (Vitrine e Feirões)**: banco migrado comparado ao `schema.prisma` | Nenhuma diferença nas tabelas novas; a migration escrita à mão bate com o schema. Há 3 linhas de diff em objetos antigos do AutoPilot (anteriores a esta etapa). |
| E2E, incluindo os 26 cenários de RLS com papel sem `BYPASSRLS` e os 13 testes da API de estoque | OK |
| Build | OK |
| Web CI | OK (sem mudanças na web) |

## Como testar manualmente

1. `npm run db:migrate` e `npm run seed:local` na API; entre com o dono da loja local.
2. `POST /api/inventory/vehicles` com o corpo do exemplo no Swagger (`/docs`, tag `inventory`).
3. `POST /api/inventory/vehicles/:id/status` com `{"toStatus":"SOLD"}` e depois `{"toStatus":"AVAILABLE"}` (desfaz em até 24 h).
4. `GET /api/inventory/import/template?format=xlsx`, preencha 3 linhas (uma com erro) e envie em `/api/inventory/import/preview`.
5. Com o R2 configurado: `upload-url` → `curl -X PUT` com o arquivo → `POST .../photos` com a chave devolvida.
