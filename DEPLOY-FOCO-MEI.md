# Deploy — FOCO MEI (Easypanel)

Serviço web **FOCO MEI**: frontend Expo (`App/frontend`) — notas fiscais, DAS, certificado e parcelamentos MEI.

Compartilha **backend** (`Site/backend`) e **Supabase** com meiinfinito; só o serviço de frontend é novo.

---

## 1. Criar o serviço no Easypanel

1. **Create Service → App**
2. **Nome do serviço:** `FOCO MEI`
3. **Source:** GitHub — mesmo repo do app (`financas-pessoais-mobile` ou monorepo com subpasta)
4. **Build**
   - Type: **Dockerfile**
   - Dockerfile path: `Dockerfile` (raiz do repo mobile) **ou** `App/frontend/Dockerfile` (monorepo)
   - Build context: pasta do `App/frontend`
5. **Port:** `80`
6. **Domains:** ex. `focomei.com.br` ou subdomínio Easypanel — ative HTTPS

---

## 2. Variáveis de ambiente (Environment)

Mesmos valores do backend/Site (copie do serviço que já funciona):

| Variável | Alternativa legada | Descrição |
|----------|-------------------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` | Chave anon pública |
| `EXPO_PUBLIC_MEI_API_URL` | `VITE_API_URL` | URL pública do backend (Site) |
| `EXPO_PUBLIC_INVITE_APP_BASE_URL` | — | URL pública deste app (ex. `https://focomei.com.br`) |

> Após salvar o Environment, faça **Redeploy** (rebuild) para o bundle e o `env-config.js` refletirem as vars.

---

## 3. O que **não** duplicar

| Recurso | Ação |
|---------|------|
| Backend API | Reutilizar serviço `Site` existente (`Dockerfile.backend`) |
| Supabase / Postgres | Mesmo projeto |
| `.env` do backend | Sem alteração obrigatória |

---

## 4. Pós-deploy (checklist)

- [ ] Login e redirect para home MEI
- [ ] Emitir/consultar nota fiscal
- [ ] `/privacidade` e `/termos` abrem HTML estático
- [ ] Google OAuth (se usar): redirect URI com **domínio do FOCO MEI**
- [ ] `EXPO_PUBLIC_INVITE_APP_BASE_URL` = domínio final do serviço

---

## 5. Repositório Git

Se usar monorepo local, publique só `App/frontend` no repo do app:

```bash
cd App/frontend
git add .
git commit -m "feat: deploy FOCO MEI no Easypanel"
git push origin main
```

No Easypanel do **FOCO MEI**, conecte esse repo e redeploy após cada push relevante.

---

## 6. Diferença vs meiinfinito.com.br

| | meiinfinito (legado) | FOCO MEI (novo) |
|--|---------------------|-----------------|
| Serviço Easypanel | App web anterior | **FOCO MEI** (novo) |
| Código | Mesma base `App/frontend` | Branch/commit com branding FOCO MEI |
| Backend | Compartilhado | Compartilhado |
| Domínio | Próprio | Próprio (configurar no passo 1) |
