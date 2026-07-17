# Checklist: CORS no projeto backend na Vercel (meu-financeiro-backend-bk)

Se o frontend em **meu-financeiro-frontend-teste.vercel.app** ainda mostra erro de CORS ao chamar **meu-financeiro-backend-bk.vercel.app**, confira no dashboard da Vercel o seguinte.

## 1. Projeto correto

- Acesse [vercel.com](https://vercel.com) e abra o projeto do **backend** (nome que resulta na URL `meu-financeiro-backend-bk.vercel.app`).

## 2. Root Directory

- Em **Settings > General**, verifique **Root Directory**.
- Deve estar configurado como **`backend`** (a pasta onde estão `package.json`, `vercel.json` e `src/server.js`).
- Se estiver vazio ou com outro valor, o Vercel pode não estar usando este código e o middleware de CORS/OPTIONS não será executado. Ajuste para **backend** e faça um novo deploy.

## 3. Variáveis de ambiente

- Em **Settings > Environment Variables**, confira:

  - **Production e Preview** (marque ambos ao criar/editar):
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - Outras variáveis obrigatórias que o backend usa (ex.: `PLUGNOTAS_WEBHOOK_TOKEN` em produção).

  - Para NFSe (PlugNotas) em produção:
    - `PLUGNOTAS_API_KEY` – token de produção da API PlugNotas. Para atualizar via CLI após `npx vercel login`, execute na pasta backend: `.\scripts\vercel-atualizar-plugnotas-api-key.ps1` (o script lê o valor de `backend/.env` ou usa o padrão).
    - `PLUGNOTAS_API_BASE_URL` – use `https://api.plugnotas.com.br` para produção (opcional se o backend já usar esse padrão).
  - Opcional para CORS (o código já aceita `*.vercel.app` e **sempre** inclui origens Expo Web `http://localhost:8081`, `http://localhost:19006` via `src/config/env.js`):
    - **`CORS_ORIGIN`** – variável **única** que o backend lê para CORS. Lista de origens separadas por vírgula. Exemplo:  
      `https://meu-financeiro-frontend.vercel.app,https://meu-financeiro-frontend-teste.vercel.app`
    - **Não use `EXPO_WEB_ORIGINS`** – o backend **não lê** essa variável; é apenas um nome de constante no código. Para o app Expo Web em `localhost:8081` funcionar, use `CORS_ORIGIN` (ou faça redeploy do código atual, que já faz merge com 8081/19006).
    - `FRONTEND_URL` – usado como fallback para CORS quando `CORS_ORIGIN` não está definido.

- Se `SUPABASE_URL` ou `SUPABASE_ANON_KEY` estiverem faltando, o backend pode falhar ao carregar e as respostas (incluindo OPTIONS) podem vir sem os headers CORS.

## 4. Deploy atualizado

- O middleware que responde ao **OPTIONS** com headers CORS está em `backend/src/server.js` (trecho “Responde ao preflight OPTIONS”).
- Para esse código estar em produção:
  - As alterações precisam estar no repositório (commit/push).
  - O projeto na Vercel deve ter sido deployado **depois** desse commit (deploy automático por push ou “Redeploy” em **Deployments**).
- Em **Deployments**, abra o deploy ativo e confira se o commit é o esperado e se o status é “Ready”.

- **Expo Web (localhost:8081):** Se o app mobile no navegador ainda recebe CORS, use **CORS_ORIGIN** na Vercel (não EXPO_WEB_ORIGINS) e faça **Redeploy** após alterar variáveis ou após subir o código com o merge em `env.js`.

## 5. Teste rápido do backend

- No navegador ou com `curl`, teste o backend diretamente:
  - **GET**  
    `https://meu-financeiro-backend-bk.vercel.app/`  
    ou  
    `https://meu-financeiro-backend-bk.vercel.app/health`  
    Deve retornar 200 e um JSON (ex.: `{"status":"ok"}`).
  - **OPTIONS** (preflight):  
    `curl -i -X OPTIONS "https://meu-financeiro-backend-bk.vercel.app/api/auth/signin" -H "Origin: https://meu-financeiro-frontend-teste.vercel.app"`  
    A resposta deve ter status **204** e o header **Access-Control-Allow-Origin** (com a origem acima ou `*`).

Se o GET funcionar mas o OPTIONS não tiver `Access-Control-Allow-Origin`, o deploy provavelmente não está usando a versão atual de `server.js` (confira Root Directory e redeploy).

## Resumo

| Onde (Vercel – projeto backend) | O que verificar |
|----------------------------------|-----------------|
| Settings > General              | Root Directory = **backend** |
| Settings > Environment Variables| SUPABASE_URL, SUPABASE_ANON_KEY (e demais obrigatórias) para **Production** e **Preview** |
| Deployments                     | Deploy mais recente após o commit que adiciona o middleware OPTIONS em `src/server.js` |
| Teste manual                    | OPTIONS `/api/auth/signin` com header Origin retorna 204 e Access-Control-Allow-Origin |

Não é possível “entrar na Vercel” por aqui; use o dashboard em vercel.com com a conta que gerencia o projeto **meu-financeiro-backend-bk**.

---

## Execução via terminal (após login)

Foi criado um script que faz pelo terminal: link do projeto, listagem de env, adição de `CORS_ORIGIN` (se faltar), redeploy e teste OPTIONS.

1. **Faça login na Vercel (uma vez):** no terminal: `npx vercel login` e conclua o fluxo no navegador. (Sem login, `npx vercel --prod` falha com "The specified token is not valid".)
2. **Execute o script** a partir da pasta **backend**: `.\scripts\vercel-conferir-e-corrigir.ps1`  
   O script verifica o login, vincula o projeto (se precisar), lista as variáveis, adiciona `CORS_ORIGIN` para Production e Preview se não existir, faz deploy de produção e testa o OPTIONS. Na primeira vez em `vercel link`, escolha o time e o projeto **meu-financeiro-backend-bk**.
3. **Root Directory** continua só pelo dashboard: Settings > General > Root Directory = **backend**.

### Atualizar PLUGNOTAS_API_KEY na Vercel

Para definir ou atualizar o token da API PlugNotas (produção) nas variáveis de ambiente do backend na Vercel:

1. Faça login na Vercel (uma vez): `npx vercel login`.
2. Na pasta **backend**, execute: `.\scripts\vercel-atualizar-plugnotas-api-key.ps1`.  
   O script lê o valor de `backend/.env` (chave `PLUGNOTAS_API_KEY`) ou usa o token de produção padrão, remove a variável antiga (se existir) e adiciona para **Production** e **Preview**.
3. Faça redeploy para aplicar (ex.: `npx vercel --prod` ou push para trigger).
