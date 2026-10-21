# Vitrine e Feirões — Design (Fase 1)

**Data:** 2026-10-21 · **Etapa:** 0 (preparação) · **Status:** aprovado para implementação por etapas

Especificação de produto: documento "AutoPilot Vitrine e Feirões — Fase 1: Especificação do MVP".
Artefatos técnicos desta pasta:

- [`vitrine-feiroes/vitrine-feiroes-additions.prisma`](./vitrine-feiroes/vitrine-feiroes-additions.prisma): modelos e enums novos. Validado contra o schema deste repositório com o validador do Prisma 6.19.
- [`vitrine-feiroes/rls_showcase_fairs.sql`](./vitrine-feiroes/rls_showcase_fairs.sql): políticas RLS a anexar à migration da etapa 1.
- [`vitrine-feiroes/rls_showcase_fairs_tests.sql`](./vitrine-feiroes/rls_showcase_fairs_tests.sql): 26 cenários de RLS. Rodados em PostgreSQL 16 com as 21 migrations deste repositório, todos com o resultado esperado.

---

## 1. Objetivo

Adicionar ao AutoPilot:

- estoque de veículos por loja (`Company`);
- vitrine pública da cidade e da loja;
- feirões entre lojas, com QR Code por carro e modo "ao vivo";
- formulário de interesse que cria/reaproveita `Lead`;
- relatório do feirão.

Prazo da versão demonstrável: **2026-11-25**.

## 2. Decisões

| Tema | Decisão |
| --- | --- |
| Tenant | A loja é a `Company`. Papéis existentes: `OWNER` (dono), `ADMIN` (gerente), `AGENT` (vendedor). |
| Lead | Contato da vitrine vira `Lead` da loja dona do carro. Nenhum campo do `Lead` muda; o vínculo com o carro fica em `lead_vehicle_interests`. |
| Feirão | Model `Fair` (o nome `Event` já existe para eventos de domínio). |
| Leitura pública | Nova flag de sessão `app.public_read`, ligada só pelo módulo `showcase`. |
| Feirão entre lojas | Colunas `organizer_company_id` replicadas em `fair_participants`, `fair_vehicles` e `lead_vehicle_interests`. As políticas usam essas colunas, e o RLS com `FORCE` não permite `SECURITY DEFINER` como atalho. |
| Fotos | Cloudflare R2 (S3 API), upload direto do navegador por URL assinada. |
| Automações | Lead de vitrine sem autorização de ofertas fica fora de recuperação, first-touch e campanhas (seção 7). |
| Hospedagem | Web na Vercel (Hobby durante o desenvolvimento; Pro antes do uso real). API + worker + Redis em host de container, a definir. |

## 3. Módulos novos

| Módulo | Onde | Etapa | Responsabilidade |
| --- | --- | --- | --- |
| `storage` | `apps/api/src/modules/storage` | 0 | Cliente R2: URL assinada de upload, URL pública, remoção. Sem controller. |
| `inventory` | `apps/api/src/modules/inventory` | 1 | Veículos, fotos, status, histórico, importação CSV/XLSX. |
| `showcase` | `apps/api/src/modules/showcase` | 3 | Rotas públicas (leitura com `app.public_read`), interesse → Lead, analytics anônimo. |
| `fairs` | `apps/api/src/modules/fairs` | 4 | Feirões, convites, carros do feirão, QR, relatório. |

## 4. Modelo de dados

Ver `vitrine-feiroes/vitrine-feiroes-additions.prisma`. Resumo:

- `companies`: + `public_whatsapp`, `public_address`, `city`, `showcase_enabled`, `showcase_terms_accepted_at`. `slug` passa a ter índice único parcial (`WHERE slug IS NOT NULL`).
- Novas: `vehicles`, `vehicle_photos`, `vehicle_status_transitions`, `fairs`, `fair_participants`, `fair_vehicles`, `lead_vehicle_interests`, `showcase_analytics_events`.

Extensão de tenant (`TENANT_SCOPED_MODELS`):

- entram: `vehicle`, `vehiclePhoto`, `vehicleStatusTransition` e `leadVehicleInterest`;
- ficam de fora: `fair`, `fairParticipant`, `fairVehicle` e `showcaseAnalyticsEvent`. O acesso entre lojas é legítimo nelas e fica a cargo do RLS e dos serviços.

## 5. RLS

Ver `vitrine-feiroes/rls_showcase_fairs.sql`.

| Tabela | Ler | Escrever |
| --- | --- | --- |
| `vehicles`, `vehicle_photos` | própria loja; público (não arquivado, loja com vitrine ativa); organizador lê carros inscritos no seu feirão | própria loja |
| `vehicle_status_transitions` | própria loja | própria loja |
| `fairs` | organizador; lojas convidadas; público fora de `DRAFT` | organizador |
| `fair_participants` | convidada, organizador, público (só `ACCEPTED`) | INSERT só organizador (e o organizador gravado precisa ser o dono do feirão); UPDATE convidada/organizador; DELETE organizador; colunas de vínculo imutáveis |
| `fair_vehicles` | dona, organizador, público | INSERT só loja `ACCEPTED`, só carro próprio; colunas de vínculo imutáveis |
| `lead_vehicle_interests` | própria loja; organizador lê as linhas do seu feirão (sem dado pessoal) | própria loja, com organizador verdadeiro |
| `showcase_analytics_events` | sem RLS (sem dado pessoal); leitura só por serviço filtrado | público via serviço |

## 6. Rotas

### API

| Rota | Etapa | Acesso |
| --- | --- | --- |
| `/inventory/vehicles` (CRUD, status, fotos), `/inventory/import/*` | 1 | Painel (JWT + empresa + papel) |
| `PATCH /companies/current/showcase` | 2 | `OWNER`/`ADMIN` |
| `/public/vehicles`, `/public/stores/:slug`, `/public/fairs/*`, `/public/q/:code`, `POST /public/interests`, `POST /public/analytics` | 3–4 | Público, throttle próprio |
| `/fairs/*` | 4 | Painel |

### Web

| Rota | Etapa |
| --- | --- |
| `/inventory`, `/inventory/new`, `/inventory/[id]`, `/inventory/import`, `/settings/showcase` | 2 |
| `/vitrine`, `/vitrine/[lojaSlug]`, `/carro/[slug]`, `/privacidade` (renderizadas no servidor) | 3 |
| `/fairs/*` (painel), `/feirao/[slug]`, `/q/[codigo]` | 4 |

## 7. Levantamento: caminhos que enviam mensagem automaticamente a um lead

Feito por leitura de código em 2026-10-21 (commit `8bebbb0`). Todo envio passa por `WhatsappSendService`; a lista abaixo é de quem **decide** enviar.

| # | Caminho | Arquivo · função | Gatilho | Automático? |
| --- | --- | --- | --- | --- |
| 1 | Recuperação por IA (D1/D3/D7) | `modules/ai/ai-recovery.scanner.ts` → `ai-recovery.service.ts · scheduleEligibleForCompany / tryScheduleLead` (cria FollowUp `AI_RECOVERY`) | `setInterval` quando `ASYNC_FOLLOWUP_ENABLED=true` e recovery ativo na empresa | Sim |
| 2 | Execução de follow-ups vencidos | `modules/async/followup-due.scanner.ts` → `followup-scheduler.processor.ts` → `follow-up.service.ts · executeDue → runWhatsAppSend` | `setInterval`; executa qualquer FollowUp `SCHEDULED` vencido (manual, IA, first-touch, recuperação) | Sim |
| 3 | Preparação do envio de recuperação | `ai-recovery.service.ts · prepareExecution` (rechecagem de parada antes do envio) | Chamado por #2 | Sim |
| 4 | Resposta automática da IA | `modules/ai/ai-assist-pipeline.service.ts` (modo `AUTO` → `WhatsappSendService`) | Mensagem recebida do lead | Sim, mas responde a quem escreveu |
| 5 | First-touch | `modules/outbound/outbound-first-touch.service.ts · generate → findEligibleLeads → generateForLead` (FollowUp `OUTBOUND_FIRST_TOUCH`, aprovação humana) | Ação do usuário | Em massa, com aprovação |
| 6 | Campanhas | `modules/outbound/outbound-campaign.service.ts · addLeads / attachImportBatch / generateFirstTouch` | Ação do usuário | Em massa |
| 7 | Sugestão de resposta da IA | `modules/ai/ai.service.ts` (FollowUp `AI_REPLY`) | Ação do usuário | Não |

**Onde aplicar o bloqueio (etapa 3).** A função única `isShowcaseLeadBlockedForAutomation(companyId, leadId)` devolve verdadeiro quando o lead tem algum `lead_vehicle_interest` e nenhum interesse tem `consent_marketing_at`. Ela entra em:

1. `AiRecoveryService.tryScheduleLead`: não agenda `AI_RECOVERY`;
2. `AiRecoveryService.prepareExecution`: para o envio já agendado (defesa em profundidade);
3. `OutboundFirstTouchService.findEligibleLeads`: lead não entra;
4. `OutboundCampaignService.addLeads` e `attachImportBatch`: lead é ignorado e contado como "sem autorização";
5. `FollowUpService.executeDue`: última barreira para FollowUps dos tipos `AI_RECOVERY` e `OUTBOUND_FIRST_TOUCH`.

**Decisão pendente: caminho #4.** A resposta automática da IA só acontece quando o próprio lead escreve, e a autorização 1 cobre a conversa sobre o veículo. A recomendação é **permitir** a resposta automática ao que o lead escreveu e bloquear só a recuperação e as ofertas. Na demonstração, o modo `AUTO` fica desligado nas lojas de teste.

## 8. Ambiente e verificação

- O CI da API (`api-ci.yml`) roda lint, unitários, migrations, seed, e2e e build com Postgres e Redis.
- `web-ci.yml` (novo nesta etapa) roda lint, typecheck e build da web.
- **Ambiente de desenvolvimento do Claude:** a rede bloqueia `binaries.prisma.sh` e o Google Fonts. Localmente:
  - o cliente Prisma é gerado com `prisma generate --no-engine`, o que basta para tipos e testes unitários;
  - migrations e e2e são verificados num PostgreSQL 16 local aplicando os SQL das migrations com `psql`, e no CI;
  - o build da web usa `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`.

### Linha de base (2026-10-21, commit `8bebbb0`)

| Verificação | Resultado |
| --- | --- |
| API · testes unitários | 72 suítes, 373 testes, todos passando |
| API · build | OK |
| API · lint sem `--fix` | 239 erros e 22 avisos já existentes (229 de formatação Prettier, todos corrigíveis automaticamente; o CI usa `--fix`). Não corrigidos nesta fase para não misturar escopo. |
| API · e2e | Não executável localmente (engine do Prisma); fica para o CI |
| Web · lint | Sem avisos |
| Web · typecheck | OK |
| Web · build | OK (com fontes simuladas) |
