# Deploy — AutoPilot Vitrine e Feirões

Arquitetura da demonstração (custo zero até o uso real):

| Peça | Onde | Plano |
| --- | --- | --- |
| Web (Next.js) | Vercel | Hobby agora; **Pro antes de cobrar das lojas** (Hobby não permite uso comercial) |
| API (NestJS, Docker) + workers no mesmo processo | Render, região Virginia | Free (dorme após 15 min; o workflow `keepalive` evita no horário das lojas) |
| Redis (BullMQ, travas) | Render Key Value | Free (em memória; some no reinício — aceitável com as automações desligadas) |
| Postgres | Neon, região **AWS US East (N. Virginia)** | Free (1 GB, dorme após 5 min) |
| Fotos | Cloudflare R2 | Free (10 GB) |
| Backup | GitHub Actions (`db-backup.yml`) | grátis; dump criptografado, 14 dias |

Banco e API na mesma região (Virginia): cada requisição faz várias consultas, e banco longe da API multiplica a latência.

## 1. Neon (banco)

1. Crie o projeto `autopilot` na região **AWS US East (N. Virginia)**, Postgres 17.
2. Copie a connection string **direta** (sem `-pooler`) do usuário dono. Ela vira o segredo `MIGRATION_DATABASE_URL` (com `?sslmode=require`).

> O dono do Neon tem `BYPASSRLS`. A API **não** usa esse usuário: ela usa `autopilot_app`, criado pelo passo 3. A API se recusa a subir em produção com um usuário que ignora RLS.

## 2. Segredos do GitHub (Settings → Secrets and variables → Actions)

| Segredo | Valor |
| --- | --- |
| `MIGRATION_DATABASE_URL` | connection string do dono (passo 1) |
| `APP_DB_PASSWORD` | senha forte nova para `autopilot_app` |
| `BACKUP_PASSPHRASE` | frase longa para criptografar os backups (guarde fora do GitHub) |

## 3. Migrations, papel da aplicação e dados da demonstração

Actions → **Banco — migrations e papel da aplicação** → *Run workflow* → marque **seed_demo**.

Cria as tabelas, o usuário `autopilot_app` (sem `BYPASSRLS`) e a demonstração:
4 lojas fictícias de Botucatu, 120 carros e o "Feirão de Novembro (demo)" publicado com 80 carros.
Login da demonstração: `admin@vitrine.demo.autopilot.dev` / `Demo@12345` (gerente nas 4 lojas) e
`dono.<slug-da-loja>@vitrine.demo.autopilot.dev`. **Troque as senhas antes de mostrar a qualquer pessoa.**

A connection string da API é a do passo 1 com o usuário trocado:
`postgresql://autopilot_app:<APP_DB_PASSWORD>@<host-do-neon>/<banco>?sslmode=require`

## 4. Cloudflare R2 (fotos)

1. Crie o bucket `autopilot-media`. Em *Settings → Public access*, ative a URL `r2.dev` (ou um domínio próprio). Ela é o `R2_PUBLIC_BASE_URL`.
2. *Manage API tokens* → token com **Object Read & Write** só nesse bucket → `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`. O `R2_ACCOUNT_ID` aparece na página do R2.
3. CORS do bucket (o celular envia a foto direto para o R2):

```json
[
  {
    "AllowedOrigins": ["https://SEU-DOMINIO-DA-VERCEL"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 5. Render (API + Redis)

*New → Blueprint* → repositório `Onigui/FEIRAO-OS` → usa o `render.yaml` da raiz. Preencha:
`DATABASE_URL` (passo 3, usuário `autopilot_app`) e as 5 variáveis `R2_*`.
O `JWT_ACCESS_SECRET` é gerado pelo Render.

> **Atenção:** o workspace já tem 2 serviços grátis (`sof-web`, `famesp`). As 750 horas grátis por mês são
> **somadas** entre todos. Com o keepalive só no horário das lojas (~14 h/dia ≈ 430 h/mês), sobra margem se
> os outros dois dormirem quando ninguém usa.

Confira: `https://autopilot-api.onrender.com/health/ready` deve responder `ok` para Postgres e Redis.

## 6. Vercel (web)

*Add New → Project* → `Onigui/FEIRAO-OS` → **Root Directory: `apps/web`**. Variáveis:

| Variável | Valor |
| --- | --- |
| `API_INTERNAL_URL` | `https://autopilot-api.onrender.com` |
| `NEXT_PUBLIC_API_BASE_URL` | `/backend` |
| `NEXT_PUBLIC_APP_URL` | `https://<domínio do projeto>` (usado nos QR) |
| `NEXT_PUBLIC_SHOWCASE_CITY` | `Botucatu` |

> **Proteção de deploy:** o time na Vercel está com *Vercel Authentication* ligada para todos os domínios
> exceto os próprios. Sem desligar (Settings → Deployment Protection) ou usar domínio próprio, a vitrine
> pública pede login da Vercel aos clientes.

## 7. Depois do primeiro deploy

1. Variável do repositório `API_PUBLIC_URL` = `https://autopilot-api.onrender.com` (liga o `keepalive.yml`).
2. Actions → **Banco — backup diário** → *Run workflow* uma vez para conferir.
3. Teste de fumaça no celular: login → estoque → foto → vitrine → contato → lead → feirão → QR → vendido.

## Restaurar um backup

```bash
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -o backup.dump -d backup-AAAAMMDD-HHMM.dump.gpg
pg_restore --no-owner --no-privileges -d "$MIGRATION_DATABASE_URL" --clean --if-exists backup.dump
# depois rode de novo o workflow "Banco — migrations e papel da aplicação" (recria as permissões do autopilot_app)
```

## Antes de cobrar das lojas

- Vercel Pro (US$ 20/usuário/mês) — uso comercial.
- Render Starter (US$ 7/mês) para a API não dormir; avaliar o plano do workspace (Hobby continua grátis).
- Neon: o Free dorme e tem 100 CU-hora/mês; acompanhar o uso.
- Revisão jurídica do termo das lojas e da política de privacidade.
