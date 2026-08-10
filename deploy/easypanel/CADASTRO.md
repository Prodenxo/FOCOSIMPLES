# Cadastrar Foco Simples no Easypanel (do zero)

Repo: **https://github.com/Prodenxo/FOCOSIMPLES** · branch **`main`**

Ordem: **Postgres → Backend → Frontend**

---

## 0. Conectar GitHub (se ainda não fez)

Easypanel → **Settings** → **GitHub** → autorize org **`Prodenxo`**.

---

## 1. Postgres — `focosimples-db`

1. **Create Service → Database → PostgreSQL**
2. Nome: **`focosimples-db`**
3. Database name: **`focosimples`**
4. Anote usuário/senha
5. Abra **PgWeb** e rode (se banco novo), nesta ordem:
   - `backend/db/easypanel/001_init_schema.sql`
   - `backend/db/easypanel/002_indexes_triggers.sql`
   - `backend/db/easypanel/004_nfse_rps_functions.sql`
   - `backend/db/easypanel/006_das_simples.sql`
   - `backend/db/easypanel/007_certificados_empresa_encrypted.sql`
   - `backend/db/easypanel/008_certificados_unique_por_usuario.sql`
   - `backend/supabase/migrations/20260810120000_tax_rules_st_matrix_columns.sql`
6. Seed ST (opcional): `node backend/scripts/one-time/seed-tax-rules-state-rj-retail.mjs`

**Host interno** (use no backend): `focosimples-db:5432`  
(Nome exato aparece em *Connection* do serviço — pode ser `auto_focosimples-db` dependendo do projeto.)

---

## 2. Backend — `focosimples-api`

1. **Create Service → App**
2. Nome: **`focosimples-api`**
3. **Source:** GitHub → `Prodenxo/FOCOSIMPLES` → branch `main`
4. **Build:**
   - Type: **Dockerfile**
   - Caminho de Build (Fonte): **`backend`**
   - Arquivo Dockerfile: **`Dockerfile`** ou **`dockerfile`** (Linux diferencia maiúsculas)
   - Context: **`backend`**
5. **Port:** `3333`
6. **Domains:** gere domínio Easypanel (ex. `focosimples-api.xxxx.easypanel.host`) + HTTPS
7. **Environment:** copie `deploy/easypanel/backend.env.template` e preencha
   - `DATABASE_URL` → host **interno** do Postgres (não IP público)
   - `GOOGLE_REDIRECT_URI` → `https://SUA-URL-BACKEND/api/google-calendar/oauth-callback`
8. **Deploy**

Teste:

```bash
curl https://SUA-URL-BACKEND/health
```

---

## 3. Frontend — `focosimples-web`

1. **Create Service → App**
2. Nome: **`focosimples-web`**
3. **Source:** mesmo repo `Prodenxo/FOCOSIMPLES` → `main`
4. **Build:**
   - Dockerfile: **`Dockerfile`** (raiz do repo)
   - Context: **`.`** (raiz)
5. **Port:** `80`
6. **Domains:** ex. `focosimples.xxxx.easypanel.host` ou aponte `focomei.com.br`
7. **Environment:** copie `deploy/easypanel/frontend.env.template`
   - `EXPO_PUBLIC_MEI_API_URL` = URL pública do **focosimples-api**
   - `EXPO_PUBLIC_INVITE_APP_BASE_URL` = URL pública deste frontend
8. **Deploy** (rebuild obrigatório — Expo embute env no build)

---

## 4. Ajuste final no backend

Volte em **focosimples-api → Environment** e atualize:

```env
CORS_ORIGIN=https://URL-DO-FRONTEND,https://focomei.com.br
FRONTEND_URL=https://URL-DO-FRONTEND
INVITE_APP_BASE_URL=https://URL-DO-FRONTEND
```

**Redeploy** do backend.

---

## 5. Superadmin (primeiro login)

No PgWeb:

```sql
UPDATE public.profiles SET role = 'superadmin' WHERE id = 'UUID-DO-USUARIO';
```

---

## Erros comuns

| Problema | Causa |
|----------|--------|
| Login não funciona | `EXPO_PUBLIC_MEI_API_URL` errado ou backend não redeployado |
| CORS | `CORS_ORIGIN` sem URL exata do frontend (com https, sem barra final) |
| Certificado some após deploy | `MEI_CERT_ENCRYPTION_KEY` diferente do ambiente que cifrou |
| Ativação 40% | Backend antigo ou `AUTH_MODE` ≠ `local` |
| Tela branca | Hard refresh Ctrl+Shift+R após deploy frontend |
