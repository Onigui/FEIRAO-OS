# Vitrine e Feirões — Etapa 4 · Relatório

**Data:** 2026-10-22 · **Branch:** `claude/vitrine-feiroes-etapa-4` · **Base:** `claude/vitrine-feiroes-etapa-3` (etapas 2 e 3 ainda não mescladas)

## Entregue

| Item | Onde |
| --- | --- |
| Feirões no painel: organizo, participo e convites (aceitar ou recusar) | `apps/web/src/app/(app)/fairs/page.tsx` |
| Criar e editar feirão: nome, início, fim, local, endereço, descrição | `fairs/new`, `features/fairs/fair-form.tsx` |
| Detalhe: avançar status com confirmação, lojas e convites, meus carros com preço do feirão | `fairs/[fairId]/page.tsx`, `fair-stores-panel.tsx`, `fair-vehicles-panel.tsx` |
| Modo evento: lista grande, um toque para vendido (desfazer em 24 h para dono/gerente), contadores a cada 15 s | `fairs/[fairId]/live/page.tsx` |
| QR para imprimir: um cartão por carro (loja, modelo, ano, km, preço do feirão, QR). Sem menu; organizador pode imprimir de todas as lojas | `app/(print)/fairs/[fairId]/qr/page.tsx` |
| Relatório: vendidos no feirão, valor, contatos, QR, WhatsApp e visitas; por loja; CSV para Excel | `fairs/[fairId]/report/page.tsx` |
| Página pública do feirão: data, local, lojas, carros com filtros, faixa "Vendido" | `app/(showcase)/feirao/[slug]/page.tsx` |
| Leitura do QR: conta a leitura e leva ao carro com a origem marcada | `app/(showcase)/q/[codigo]/page.tsx` |
| Página do carro: selo do feirão, preço do evento, contato atribuído ao feirão | `app/(showcase)/carro/[slug]/page.tsx` |
| Vitrine da cidade: próximo feirão em destaque. Painel: card "Próximo feirão". Menu: "Feirões" | `vitrine/page.tsx`, `next-fair-card.tsx` |
| Módulo `fairs` na API | `apps/api/src/modules/fairs/**` |

## Regras aplicadas

- **Status só avança:** rascunho → publicado → ao vivo → encerrado, um passo por vez, só a organizadora. Publicar exige a vitrine da organizadora ativa.
- **Organizadora participa:** ao criar o feirão, a loja entra como participante confirmada e pode inscrever os próprios carros.
- **Convite:** só a organizadora convida. Quem recusou pode ser convidado de novo. A organizadora só retira convite que ainda não foi aceito.
- **Aceitar exige vitrine ativa:** o público vê os carros pela vitrine da loja.
- **Recusar ou sair** tira os carros da loja do feirão.
- **Carros:** só loja confirmada, só carro próprio, só disponível ou reservado. Repetir não duplica.
- **Preço do feirão:** começa igual ao da vitrine e pode ser mudado por carro.
- **Encerrado congela:** não entra, não sai, não muda preço, ninguém sai do feirão.
- **QR:** código aleatório de 8 caracteres por inscrição. Nunca é reaproveitado e não carrega dado da loja nem do carro. Carro retirado perde o código.
- **"Vendido no feirão":** carro vendido com `sold_at` entre o início e o fim do evento.
- **Contatos:** o lead continua sendo só da loja dona do carro. O interesse guarda o feirão e a organizadora, que conta os contatos sem ver nome nem telefone (testado: a busca de leads da organizadora não encontra o visitante).
- **Relatório:** a organizadora vê todas as lojas; a convidada, só a própria.
- **Papéis:** dono e gerente gerenciam; vendedor vê, imprime QR, usa o modo evento e o relatório.

## API nova

| Rota | Acesso |
| --- | --- |
| `GET/POST /api/fairs`, `GET/PATCH /api/fairs/:id`, `POST /api/fairs/:id/status` | painel (criar, editar e status: dono/gerente da organizadora) |
| `GET /api/fairs/stores`, `POST /api/fairs/:id/invites`, `DELETE /api/fairs/:id/invites/:companyId` | organizadora |
| `POST /api/fairs/:id/respond` | loja convidada |
| `GET/POST /api/fairs/:id/vehicles`, `PATCH/DELETE /api/fairs/:id/vehicles/:fairVehicleId` | loja confirmada |
| `GET /api/fairs/:id/live`, `/qr`, `/report`, `/report.csv` | participantes |
| `GET /api/public/fairs/upcoming`, `/public/fairs/:slug`, `/public/fairs/:slug/vehicles`, `/public/q/:code` | público (fora de rascunho) |

`POST /api/public/interests` e `POST /api/public/analytics` aceitam `fairSlug`.

## Decisões tomadas nesta etapa

- **Leitura do QR sem sessão:** a leitura acontece no servidor, que não tem o identificador anônimo do navegador. Cada leitura conta uma vez (hash aleatório), sem dado pessoal.
- **Status manual:** o feirão não muda de status sozinho pelo horário; a organizadora toca em "Começar" e "Encerrar". Para a demonstração isso basta e evita surpresa no meio do evento.
- **Biblioteca de QR:** `qrcode` 1.5.4 (MIT), gerada no navegador, sem serviço externo nem custo.

## Verificação

| Verificação | Onde | Resultado |
| --- | --- | --- |
| Testes unitários da API | ambiente de desenvolvimento | 81 suítes, 509 testes passando (antes: 498) |
| e2e da API: 7 cenários do feirão (criar, convite, vitrine exigida, carros, status, público, QR, contato atribuído, isolamento do lead, ao vivo, relatório, CSV, congelamento) | GitHub Actions | OK |
| Tipos, lint e build da web | ambiente de desenvolvimento e GitHub Actions | OK |
| e2e no celular: do rascunho ao relatório (cria, inscreve, publica, imprime QR, visitante lê o QR e pede contato, ao vivo marca vendido, faixa no público, relatório, encerra) | GitHub Actions | OK (6 de 6, contando os das etapas 2 e 3) |

## Pendências conhecidas (para a etapa 5)

- As mesmas da etapa 3: anonimização após 12 meses e limite por IP atrás do proxy da Vercel.
- `npm audit` da web aponta 13 vulnerabilidades em dependências que já existiam antes desta etapa. Revisar antes do deploy.
- Capa do feirão (foto) ficou fora: a página usa só texto. Pode entrar depois sem mudar o banco (`cover_key` já existe).
