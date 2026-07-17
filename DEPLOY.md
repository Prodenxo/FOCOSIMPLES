# Deploy — Web (EasyPanel)

> **FOCO MEI:** guia dedicado em [`DEPLOY-FOCO-MEI.md`](./DEPLOY-FOCO-MEI.md)

## Onde fica cada coisa (obrigatório)

| Pasta | O que é | Deploy |
|-------|---------|--------|
| **`frontend/`** | **Frontend de produção** (Expo web + mobile, `focomei.com.br`) | Easypanel com `frontend/Dockerfile` |
| **`backend/`** / **`site/backend/`** | API Express | Easypanel backend |
| **`App/frontend/`** | Cópia local de trabalho (gitignored) — **não** sobe no deploy | Só uso local |

Toda alteração de UI que precisa ir ao site deve ficar em **`frontend/`**. Push do monorepo + **Redeploy** do serviço web no Easypanel.

## Repositórios GitHub

| Repositório | Conteúdo |
|-------------|----------|
| `financas-pessoais-app` / `Meu-financeiro` | Em geral `Site/` (backend + docs) |
| `financas-pessoais-mobile` | Raiz = conteúdo de **`App/frontend`** (Expo) |

O App **não** usa rotas Expo para `/privacidade` — serve `public/privacidade.html` e `public/termos.html` via nginx (Google OAuth).

### Atualizar só o repo do App (sem commits do Site)

No monorepo local, após mudanças em `App/frontend`:

```bash
# Exemplo: remote do app mobile
git remote add app-mobile git@github.com:contabhub/financas-pessoais-mobile.git

# Enviar só a pasta do app (subtree ou cópia manual)
cd App/frontend
git init -b main   # só se for cópia nova
git add .
git commit -m "feat: deploy web Expo + env Docker"
git push app-mobile main
```

No Easypanel do **frontend (meiinfinito.com.br)**:

- **Dockerfile:** `Dockerfile` na raiz do repo mobile (= `App/frontend` local)
- **Não** usar `Site/Dockerfile.frontend` nem `Site/frontend/`

## Testar páginas legais no localhost

| O que você roda | URL | Resultado |
|-----------------|-----|-----------|
| `cd App/frontend` → `npx expo start` | `http://localhost:8081/privacidade` | Redireciona para `/privacidade.html` (HTML estático em `public/`) |
| Mesmo Expo | `http://localhost:8081/privacidade.html` | Abre direto o HTML (igual produção) |
| `cd Site/frontend` → `npm run dev` | `http://localhost:3000/privacidade` | Site Vite antigo (se ainda usar o repo Site) |
| Produção | `https://meiinfinito.com.br/privacidade` | nginx serve o HTML estático (sem Expo Router) |

**Importante:** `npm start` / Expo na porta **8081** é o app mobile/web. As páginas legais **não** são telas React — ficam em `public/privacidade.html` e `public/termos.html`, copiadas no build Docker.

## Pré-requisitos

- Repositório Git com o código do `App/frontend`
- Conta no EasyPanel com acesso ao servidor

## Passo a passo

### 1. Criar o App no EasyPanel

1. Acesse o EasyPanel e clique em **"Create Service" → "App"**
2. Escolha a fonte **"GitHub"** (ou GitLab) e selecione o repositório
3. Em **"Build"**, defina:
   - **Build Type:** `Dockerfile`
   - **Dockerfile Path:** `App/frontend/Dockerfile`
   - **Build Context:** `App/frontend`

### 2. Variáveis de ambiente (Easypanel)

O Expo grava `EXPO_PUBLIC_*` no bundle no **build**. O Dockerfile também gera `/env-config.js` no **startup** a partir do **Environment** do serviço — assim funciona com as mesmas vars do Site (`VITE_*`).

Em **Environment** (ou **Build Arguments**), configure **pelo menos**:

| Variável (App) | Alternativa (Site) | Exemplo |
|----------------|-------------------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` | `https://iqcupswgotsuncysagmj.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` | chave anon do Supabase |
| `EXPO_PUBLIC_MEI_API_URL` | `VITE_API_URL` | `https://auto-back-meufinanceiro-site.4tnf3f.easypanel.host` |

> Se só aparecer “Supabase não configurado”, as vars não chegaram no container: confira nomes acima e faça **Redeploy** (rebuild) após salvar o Environment.

### 3. Configurar a porta

- **Port:** `80`

### 4. Apontar o domínio

Em **"Domains"**, adicione o domínio desejado e ative HTTPS.

---

## Troubleshooting: tela branca

### Cache antigo (muito comum em “só alguns PCs”)

Após deploy, o `index.html` novo referencia chunks `entry-*.js` com hash novo. Se o navegador guardou o **HTML antigo**, ele pede JS que não existe mais → **tela branca** (sem spinner).

**No servidor:** nginx não deve cachear `index.html` (já configurado no `nginx.conf`).

**No navegador afetado:**

1. **Ctrl+Shift+R** (hard refresh) em `https://meiinfinito.com.br`
2. Ou DevTools → Application → Clear site data
3. Na tela de cache antigo, use **“Atualizar agora”** (não só F5) — o app força um reload com bypass de cache (`?_mf_reload=…`)

**Loop “atualizei e voltou na mesma tela”:** acontecia quando o botão só fazia `location.reload()` e o navegador reutilizava o `index.html` antigo. Corrigido em `app/+html.tsx` (não em `web/index.html` — o Expo Router ignora esse arquivo no export).

**Erro `removeChild` / tela “Não foi possível carregar o app”:** o HTML customizado (splash fora do `#root`, portal, anti-tradutor) é injetado no build por **`scripts/patch-web-index.mjs`** (roda no Dockerfile após `expo export`). `web/index.html` **não** entra no bundle SPA. Após alterar `lib/webShellDocument.ts`, rebuild obrigatório no Easypanel do app web.

**No Easypanel:** Redeploy com cache de build limpo após mudanças grandes no frontend.

### Alteração no código não aparece após deploy

1. **Arquivos no lugar certo?** Devem estar em `App/frontend/` (ex.: `screens/Orcamentos/BudgetCategoryRow.tsx`). `Site/frontend/` não conta.

2. **Push no repo certo?** Commit em `Site/` → só sobe **backend**. O frontend precisa de push no repo **`financas-pessoais-mobile`** (raiz = `App/frontend`).

3. **Easypanel:** redeploy do serviço **app/web** (build com `expo export --web`), não do Vite em `Site/`.

4. **Navegador:** `Ctrl+Shift+R` em `https://meiinfinito.com.br`.

### Boot de sessão travado

Se Supabase/rede demorar, o app libera a UI em até **12s** (spinner “Carregando…” em vez de branco infinito).

### Erro de bundle (`n is not a function`, ChunkLoadError)

1. Rebuild obrigatório após `metro.config.js` / `app.json`.
2. F12 → Console (erro vermelho) e Network (`entry-*.js` **404** = cache).
3. Causa histórica: `unstable_enablePackageExports` no Metro (já mitigado no repo).

## Como funciona o build

```
Dockerfile (multi-stage)
│
├── Stage 1 — Node 20 (builder)
│   ├── npm ci
│   └── npx expo export --platform web  →  gera /dist
│
└── Stage 2 — Nginx (serve)
    ├── Copia /dist para /usr/share/nginx/html
    └── Serve com roteamento SPA (todas as rotas → index.html)
```

## Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Build multi-stage (Node + Nginx) |
| `nginx.conf` | Config do Nginx com SPA routing e cache de assets |
