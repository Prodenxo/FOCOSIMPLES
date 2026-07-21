# Postgres EasyPanel (Foco Simples)

Banco dedicado, **sem Supabase**. Schemas:

1. `001_init_schema.sql` — tabelas
2. `002_indexes_triggers.sql` — indexes + triggers
3. `003_seed_categories.sql` — categorias seed (opcional)
4. `004_nfse_rps_functions.sql` — RPCs RPS + índices dedupe catálogo NFSe

## Connection (rede interna EasyPanel)

```env
AUTH_MODE=local
DATABASE_URL=postgres://postgres:SENHA@auto_focosimples-db:5432/focosimples?sslmode=disable
AUTH_JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
APP_PRODUCT=focosimples
```

- Host interno: `auto_focosimples-db`
- Porta: `5432`
- Database: `focosimples`

Não commite a senha. Não cole a URL completa com senha em issues/chat.

## Aplicar schemas (PgWeb / DbGate)

1. Abra PgWeb no serviço `focosimples-db`
2. Cole e execute `001_init_schema.sql` (se ainda não rodou)
3. Cole e execute `002_indexes_triggers.sql`
4. Cole e execute `004_nfse_rps_functions.sql` (emissão NFS-e)
5. Confira:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
SELECT * FROM public.roles;
SELECT proname FROM pg_proc WHERE proname LIKE 'mei_nfse_%';
```

## Auth local

Com `AUTH_MODE=local`, o backend usa `public.users` + JWT próprio:

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/session`

Com `useServiceRole`, o client Supabase é substituído por um adaptador Postgres (`pgSupabaseCompat`) para notas/certificado/RPS.

## Superadmin

Após criar o primeiro usuário:

```sql
UPDATE public.profiles SET role = 'superadmin' WHERE id = 'UUID-DO-USER';
```

## Diferenças vs Supabase

| Antes | Agora |
|---|---|
| `auth.users` | `public.users` |
| `orçamentos` / `valor_orçado` | `orcamentos` / `valor_orcado` |
| `DAS_mei` | `das_mei` |
| RLS / `auth.uid()` | Autorização no backend |
