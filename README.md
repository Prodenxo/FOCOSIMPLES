# FocoSimples

Produto irmão do FocoMEI: **mesmo layout** (financeiro + emissão de notas), cliente/domínio/base **separados**, foco em **Simples Nacional**.

Este pacote é uma cópia do `frontend/` do FocoMEI com brand `FocoSimples`.

## O que já vem

- Financeiro (visão geral, transações, contas, etc.)
- Fluxo de certificado + notas (base PlugNotas do FocoMEI — validar no Simples)
- Shell/layout iguais ao FocoMEI
- `EXPO_PUBLIC_APP_PRODUCT=focosimples`

## O que você precisa criar (fora do código)

1. **Projeto Supabase novo** (schema do FocoMEI, **sem** dados de usuário)
2. **Backend** apontando para esse Supabase (pode ser cópia do `site/backend` / `backend` com outro `.env`)
3. **Domínio** + serviço no Easypanel (`Dockerfile` deste pasta)
4. Credenciais PlugNotas / certificado para teste de nota
5. **DAS Serpro** — se não der hoje, fica para outro dia (não bloqueia nota + financeiro)

## Subir local

```bash
cd apps/focosimples
cp .env.example .env
# preencher Supabase + API
npm install --legacy-peer-deps
npx expo start --web
```

## Deploy

Mesmo padrão do FocoMEI: Easypanel → Dockerfile nesta pasta → vars `EXPO_PUBLIC_*` → Redeploy.

Ver também `DEPLOY.md`.

## Escopo honesto do dia 1

| Must | Nice / depois |
|------|----------------|
| App no ar com brand FocoSimples | DAS Serpro completo |
| Login + financeiro | Limpeza de todos os textos “MEI” |
| Tentar emitir nota | Domínio definitivo + loja |

Não misturar `.env` / Supabase com o FocoMEI de produção.
