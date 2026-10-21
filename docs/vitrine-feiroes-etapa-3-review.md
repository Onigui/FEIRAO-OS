# Vitrine e Feirões — Etapa 3 · Relatório

**Data:** 2026-10-21 · **Branch:** `claude/vitrine-feiroes-etapa-3` · **Base:** `claude/vitrine-feiroes-etapa-2` (a etapa 2 ainda não estava mesclada)

## Entregue

| Item | Arquivos |
| --- | --- |
| Vitrine pública da cidade, da loja e página do carro, renderizadas no servidor | `apps/web/src/app/(showcase)/**`, `features/showcase/*` |
| Filtros pela URL (funcionam sem JavaScript e podem ser compartilhados), paginação, galeria de arrastar | `filters.tsx`, `pagination.tsx`, `photo-gallery.tsx` |
| Botão de WhatsApp com mensagem pronta (carro + código do anúncio), só o clique anônimo é registrado | `whatsapp-button.tsx`, `track.ts` |
| Formulário de interesse: nome, WhatsApp, carro e as 2 autorizações separadas | `interest-form.tsx` |
| Política de privacidade (rascunho, **revisar com advogado**) | `(showcase)/privacidade/page.tsx` |
| Módulo `showcase` na API: leitura pública, contato → Lead, analytics, números do painel | `apps/api/src/modules/showcase/**` |
| Bloqueio das automações para lead da vitrine sem autorização de ofertas | `showcase-consent.service.ts` + 5 pontos (abaixo) |
| Painel: origem e carro no lead, card "Carros de interesse" no detalhe, "Contatos da vitrine (7 dias)" no início, "Ver na vitrine" no carro | `features/showcase/lead-interests.tsx`, `showcase-contacts-card.tsx` |

## API nova

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `GET /api/public/vehicles` | público, 300/min por IP | Disponíveis e reservados de lojas com vitrine ativa. Busca, marca, preço, ano, câmbio, combustível, ordem |
| `GET /api/public/vehicles/:slug` | público | Página do carro. Vendido responde com `status: SOLD` (a página mostra a faixa); arquivado dá 404 |
| `GET /api/public/stores/:slug` | público | Dados públicos da loja |
| `POST /api/public/interests` | público, 10/min por IP | Contato → Lead da loja dona do carro |
| `POST /api/public/analytics` | público, 120/min por IP | Visita, clique no WhatsApp, busca |
| `GET /api/showcase/stats` | painel | Carros disponíveis e números dos últimos 7 dias |
| `GET /api/showcase/lead-interests?leadIds=` | painel | Carros de interesse por lead |

Nenhuma resposta pública traz ID interno da loja ou do carro.

## Contato → Lead

1. Acha o carro publicado (com `app.public_read`). Vendido → 409.
2. Normaliza o WhatsApp para o formato dos leads do WhatsApp (`55` + DDD + número).
3. Roda no contexto da loja dona: reaproveita o lead pelo telefone, com ou sem `55`. Se o lead veio do WhatsApp e tinha o telefone como nome, troca pelo nome informado.
4. Lead novo: `source = SHOWCASE`, status `NEW`, histórico de status e auditoria `LEAD_AUTO_CREATED`.
5. Sempre grava `lead_vehicle_interests` com a data da autorização 1, a da 2 (se marcada) e a versão do texto (`v1-2026-11`).
6. Mesmo carro e mesma pessoa em 24 h: não duplica. Se a pessoa marcou ofertas agora, só registra essa autorização.
7. Auditoria `SHOWCASE_INTEREST_CREATED`, que aparece na linha do tempo do lead como "Pediu contato pela vitrine".
8. Campo-armadilha preenchido: responde sucesso e não grava nada.

## Bloqueio das automações

A regra: o lead tem algum interesse da vitrine e nenhum deles autorizou ofertas.

| # | Onde | Efeito |
| --- | --- | --- |
| 1 | `AiRecoveryService.tryScheduleLead` | Não agenda recuperação |
| 2 | `AiRecoveryService.prepareExecution` | Cancela a recuperação já agendada (`NO_MARKETING_CONSENT`) |
| 3 | `OutboundFirstTouchService.findEligibleLeads` e `generateForLead` (e a contagem) | Lead não entra no first-touch |
| 4 | `OutboundCampaignService.addLeads` (e `attachImportBatch`, que usa o mesmo método) | Lead é ignorado e contado em `skippedNoConsent` |
| 5 | `FollowUpService.executeDue` | Cancela recuperação e first-touch vencidos desse lead |
| + | `OutboundProtectionService.canSendProactive` | Trava de envio: nenhuma mensagem proativa (`SHOWCASE_NO_MARKETING_CONSENT`), mesmo com os limites desligados |

**Decisão aplicada no caminho #4 (resposta automática da IA):** a IA continua respondendo a quem escreveu, como recomendado no design. Na demonstração, o modo `AUTO` fica desligado nas lojas de teste.

## Pendências conhecidas

- **Anonimização após 12 meses:** a política de privacidade promete, mas o processo automático ainda não existe. Entra na etapa 5, antes do uso real. Nenhum dado chega a 12 meses antes disso.
- **Limite por IP atrás do proxy:** o mesmo item da etapa 2. Pela Vercel, todos os visitantes podem chegar à API com o mesmo IP, e o limite de 10 contatos por minuto valeria para a cidade inteira. Resolver na etapa 5 (confiar no `X-Forwarded-For` da Vercel).
- **Próximo feirão em destaque na vitrine da cidade:** entra com os feirões (etapa 4).

## Verificação

| Verificação | Onde | Resultado |
| --- | --- | --- |
| Testes unitários da API | ambiente de desenvolvimento | 79 suítes, 498 testes passando (antes: 477) |
| Tipos, lint e build da web | ambiente de desenvolvimento | OK |
| e2e da API: vitrine, formulário, Lead, 24 h, campo-armadilha, vendido, bloqueio, analytics, painel | GitHub Actions | ver "Resultado do CI" |
| e2e no celular: visitante acha o carro, pede contato, loja vê o lead, vendido sai da vitrine | GitHub Actions | ver "Resultado do CI" |

## Resultado do CI

(preenchido após a execução)
