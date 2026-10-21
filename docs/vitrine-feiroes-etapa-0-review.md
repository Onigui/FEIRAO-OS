# Vitrine e Feirões — Etapa 0 · Relatório

**Data:** 2026-10-21 · **Branch:** `claude/vitrine-feiroes-etapa-0` · **Base:** `main` @ `8bebbb0`

## Entregue

| Item | Arquivos |
| --- | --- |
| Design da integração, com levantamento das automações | `docs/vitrine-feiroes-design.md` |
| Modelos Prisma validados, RLS e 26 testes de RLS (referência para a etapa 1) | `docs/vitrine-feiroes/*` |
| Módulo de armazenamento (Cloudflare R2), sem controller | `apps/api/src/modules/storage/storage.{constants,service,module}.ts` |
| Testes do armazenamento | `storage.service.spec.ts` (16 testes), `storage.module.spec.ts` (2 testes) |
| Configuração e validação do R2 (opcional; sem R2 → 503) | `src/config/configuration.ts`, `src/config/env.validation.ts`, `env.validation.spec.ts` (+4 testes), `apps/api/.env.example` |
| CI da web (lint, typecheck, build) | `.github/workflows/web-ci.yml` |
| Dependências | `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` 3.1146.0 (publicadas em 02/10/2026) |

## Decisões tomadas

- **Upload:** a URL assinada inclui tipo e tamanho do arquivo, então o R2 recusa um corpo diferente do que a API validou. A chave do arquivo é montada pelo módulo que chama; o serviço recusa chaves com `..`, `//`, barra inicial ou caracteres fora do padrão.
- **R2 opcional:** sem as variáveis, o app sobe normalmente e só as rotas de upload (etapas 1 e 4) respondem 503. O CI e o ambiente de quem não usa fotos não mudam.
- **StorageModule não registrado no `AppModule`:** ele será importado pelos módulos `inventory` e `fairs`. Assim, esta etapa não altera nenhum comportamento em execução.
- **Lint antigo:** os 239 erros de formatação já existentes não foram corrigidos, para não misturar escopo. O CI continua usando `--fix`.

## Fora desta etapa

- Migrations, modelos e telas (etapas 1 a 4).
- Escolha do host da API e do Redis (decisão do fundador, antes da etapa 5).

## Verificação

| Comando | Antes | Depois |
| --- | --- | --- |
| API · `jest` (unitários) | 72 suítes, 373 testes | 74 suítes, 398 testes, todos passando |
| API · `nest build` | OK | OK |
| API · ESLint sem `--fix` | 239 erros | 239 erros (nenhum novo; arquivos novos sem erros) |
| API · `tsc --noEmit` (inclui specs) | 50 erros em specs antigos | 50 (nenhum novo) |
| API · e2e | Não executável neste ambiente (rede bloqueia o motor do Prisma) | Roda no CI ao abrir o PR |
| Web · lint / typecheck / build | OK | Sem mudanças na web |

Ambiente: a rede do ambiente de desenvolvimento bloqueia `binaries.prisma.sh` e o Google Fonts. O cliente Prisma foi gerado com `--no-engine` (só tipos) e o build da web usou fontes simuladas. O CI do GitHub não tem essas limitações.

## Como testar manualmente

1. Crie um bucket no Cloudflare R2 e um token de API com permissão de leitura e escrita nesse bucket.
2. Preencha `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_PUBLIC_BASE_URL` no `.env` da API.
3. Configure o CORS do bucket para aceitar `PUT` vindo de `http://localhost:3000`.
4. Num console do Nest (ou num teste), chame `storageService.createUploadUrl({ key: 'teste/a.jpg', contentType: 'image/jpeg', contentLength: <bytes>, maxBytes: 8388608, allowedContentTypes: ['image/jpeg'] })`.
5. Envie o arquivo com `curl -X PUT -H 'Content-Type: image/jpeg' --data-binary @a.jpg '<url>'` e abra `publicUrl('teste/a.jpg')` no navegador.
