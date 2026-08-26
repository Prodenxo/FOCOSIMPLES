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
4. **Build (campos do Easypanel):**

   | Campo | Valor |
   |-------|--------|
   | Caminho de Build | **`/`** (raiz — **não** `backend`) |
   | Dockerfile | **`dockerfile`** ou **`Dockerfile`** |
   | Porta | **`80`** |

   > Linux do Easypanel é case-sensitive: se o build falhar com "dockerfile not found", use `dockerfile` (minúsculo) — arquivo existe na raiz do repo.

5. **Build Args:** deixe **vazio** (não coloque secrets nem URLs aqui).
6. **Environment:** copie `deploy/easypanel/frontend.env.template` e ajuste URLs:

   ```env
   EXPO_PUBLIC_AUTH_MODE=local
   EXPO_PUBLIC_APP_PRODUCT=focosimples
   EXPO_PUBLIC_MEI_API_URL=https://<URL-DO-BACKEND>.easypanel.host
   EXPO_PUBLIC_INVITE_APP_BASE_URL=https://focosimples.com.br
   ```

   O `docker-entrypoint.sh` gera `env-config.js` na **subida** do container — URLs vão na aba **Environment**, não em Build Args.

7. **Domains:** adicione **`focosimples.com.br`** (e opcionalmente `www.focosimples.com.br`) apontando para o serviço. Mantenha o `*.easypanel.host` para debug se quiser.
8. **Deploy** → aguarde build (~5–10 min, `expo export` é pesado).
9. **Teste:** abra a URL → login local → confira chamadas à API no DevTools (Network).

---

## 4. Ajuste final no backend

Volte em **focosimples-api → Environment** e atualize:

```env
CORS_ORIGIN=https://focosimples.com.br,https://www.focosimples.com.br
FRONTEND_URL=https://focosimples.com.br
INVITE_APP_BASE_URL=https://focosimples.com.br
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
