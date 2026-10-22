# Etapa 6 — Acesso da equipe (senha e convites)

**Data:** 2026-10-22 · **Branch:** `claude/acesso-equipe`

## Problema encontrado

Convidar alguém criava a pessoa **sem senha** e o vínculo ficava "Convidado" para sempre: não havia
como definir a senha nem ativar o convite. Também não havia como trocar a própria senha
(necessário para trocar as senhas da demonstração).

## O que mudou

| Para quem | Como funciona |
| --- | --- |
| Dono / gerente | Equipe → **Convidar membro** → aparece o link na hora, com botão **Enviar por WhatsApp**. Para quem já entrou, o botão vira **Link para senha nova** (esqueceu a senha). |
| Pessoa convidada | Abre o link no celular, cria a senha (8+ caracteres, letras e números) e entra. |
| Quem já tem conta em outra loja | O link pede a senha que ela já usa (não troca a senha). |
| Qualquer pessoa | **Minha senha** no menu (`/conta`): troca a senha e sai dos outros aparelhos. |

Sem e-mail: o link vai pelo WhatsApp, que as lojas já usam. Custo zero.

## Regras de segurança

- Link de uso único; convite vale 7 dias, senha nova vale 24 horas; gerar outro cancela o anterior.
- No banco fica só o hash SHA-256 do link (tabela `access_links`).
- Gerente não gera link para o dono; ninguém gera para si mesmo.
- Uma loja não redefine a senha de quem também está ativo em outra loja (evita uma loja tomar a conta usada na outra).
- Senha redefinida encerra todas as sessões; troca de senha encerra as outras sessões.
- Limite de tentativas: 10/min para concluir o link e para trocar a senha.
- Tudo auditado: `ACCESS_LINK_CREATE`, `ACCESS_LINK_INVITE_ACCEPT`, `ACCESS_LINK_PASSWORD_RESET`, `USER_PASSWORD_CHANGE`.

## Limite conhecido

O **dono** que esquece a senha e é o único dono da loja não tem quem gere o link. Por enquanto: me
avise que faço a redefinição direto no banco. Recuperação por e-mail fica para depois (exige serviço de e-mail).

## Verificação

| Verificação | Onde |
| --- | --- |
| Testes unitários da API (regras do link, senha, concorrência) | ambiente de desenvolvimento: 85 suítes, 531 testes |
| e2e da API: convite, link anterior cancelado, uso único, redefinição derruba sessões, troca de senha, conta existente, bloqueio entre lojas | GitHub Actions |
| e2e no celular: dono convida → vendedor cria senha no celular → entra → troca a senha | GitHub Actions |
