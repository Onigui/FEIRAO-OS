# Vitrine e Feirões — Etapa 5 · Relatório (preparo do deploy)

**Data:** 2026-10-22 · **Branch:** `claude/vitrine-feiroes-etapa-5` · **Base:** `claude/vitrine-feiroes-etapa-4`

O código e a automação para colocar no ar estão prontos e testados. Falta só o que depende das suas contas
(Neon, Cloudflare R2, segredos do GitHub e os cliques de criação no Render e na Vercel): ver
[`deploy-vitrine-feiroes.md`](./deploy-vitrine-feiroes.md).

## Correção importante encontrada

**A vitrine pública não funcionaria em produção.** Com um usuário de banco sem `BYPASSRLS` (o correto),
a página do carro e o QR davam 404. As consultas do Prisma só rodam no `await`; o código devolvia a consulta
sem esperar, e ela rodava fora do contexto de leitura pública. O CI antigo usava superusuário, que ignora o
RLS e escondia o erro. Corrigido no helper `runWithRlsPublicRead` (espera dentro do contexto), com teste
unitário que falha na versão antiga. **O e2e de navegador agora roda com o mesmo papel de produção.**

## Entregue

| Item | Onde |
| --- | --- |
| Papel `autopilot_app` sem `BYPASSRLS` (script idempotente) | `apps/api/scripts/create-app-role.sql` |
| API recusa subir em produção com usuário que ignora RLS (`DB_ALLOW_BYPASS_ROLE=true` só para emergência) | `src/prisma/db-role-guard.ts` |
| IP real atrás de Vercel + Render (`TRUST_PROXY_HOPS`) e limite por `req.ip`, sem confiar no 1º `X-Forwarded-For` | `main.ts`, `src/core/guards/app-throttler.guard.ts` |
| Anonimização LGPD: contato da vitrine sem andamento há 12 meses (`SHOWCASE_RETENTION_ENABLED`) | `showcase-retention.service.ts` / `.scanner.ts` |
| Política de privacidade descreve exatamente o que é apagado | `(showcase)/privacidade` |
| Seed da demonstração: 4 lojas **fictícias** de Botucatu, 120 carros, feirão publicado com 80 | `prisma/seeds/vitrine.ts` (`npm run seed:vitrine`) |
| Blueprint do Render (API + Redis) | `render.yaml` |
| Workflow de migrations + papel + seed | `.github/workflows/db-deploy.yml` |
| Backup diário criptografado (repo é público) | `.github/workflows/db-backup.yml` |
| Manter a API acordada no horário das lojas | `.github/workflows/keepalive.yml` |
| Passo a passo do deploy, restauração e custos | `docs/deploy-vitrine-feiroes.md` |
| Dependências: Next 15.5.28 (vulnerabilidade **crítica** corrigida), `proxy-addr` (crítica), outras sem quebra | `package-lock.json` |

## Regras da anonimização

- Alvo: interesse com mais de 12 meses, lead sem resposta, qualificação ou venda e sem contato nos últimos 12 meses.
- O interesse ganha `anonymized_at`; relatórios de feirão continuam contando.
- Se a vitrine foi o único contato (lead `SHOWCASE` sem conversa, nota ou atividade): nome e telefone apagados e lead removido da lista.
- Se a loja tem outro histórico com a pessoa (ex.: WhatsApp), o lead fica.
- Roda a cada 6 h, um lote por vez, com trava no Redis; auditoria `SHOWCASE_RETENTION_ANONYMIZE`.

## Verificação

| Verificação | Onde | Resultado |
| --- | --- | --- |
| Testes unitários da API | ambiente de desenvolvimento | 84 suítes, 514 testes passando (antes: 509) |
| e2e da API (inclui anonimização e limite 429) | GitHub Actions | OK |
| Seed da demonstração rodado 2 vezes (idempotente: 120 carros, 80 no feirão) | GitHub Actions | OK |
| Backup → criptografia → restauração em banco novo | GitHub Actions | OK |
| e2e no celular **com o papel sem BYPASSRLS** (6 testes) | GitHub Actions | OK |

## Vulnerabilidades restantes (aceitas, sem impacto em produção)

- Web: `postcss` dentro do Next (só processa o CSS do próprio projeto no build) e `braces` (ferramenta de lint).
- API: `deepmerge-ts` (CLI do Prisma, só no deploy), `js-yaml` (Swagger, desligado em produção), `uuid` dentro do `exceljs` (não usa as funções afetadas). As correções exigem versões maiores com quebra; reavaliar depois da demo.

## Custos verificados (outubro/2026)

| Serviço | Grátis | Pago mais barato |
| --- | --- | --- |
| Render | Web: dorme após 15 min, 750 h/mês **por workspace**; Key Value 1 instância em memória; Postgres grátis expira em 30 dias (não usado) | Starter US$ 7/mês; plano Pro do workspace US$ 25/mês (opcional) |
| Neon | 1 GB/projeto, 100 CU-h/mês, dorme após 5 min, 6 h de histórico | Launch: US$ 0,106/CU-h + US$ 0,35/GB-mês |
| Railway (alternativa) | só teste | Hobby US$ 5/mês com US$ 5 de uso |
| Fly.io (alternativa) | só teste | ~US$ 2,19/mês (256 MB) |
| Vercel | Hobby (não comercial) | Pro US$ 20/usuário/mês |
