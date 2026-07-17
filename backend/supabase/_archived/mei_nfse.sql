create table if not exists public.mei_nfse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plugnotas_id text,
  protocol text,
  id_integracao text,
  status text,
  cnpj_prestador text,
  cnpj_tomador text,
  payload_json jsonb,
  response_json jsonb,
  pdf_url text,
  xml_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mei_nfse_user_id_idx on public.mei_nfse(user_id);
create index if not exists mei_nfse_plugnotas_id_idx on public.mei_nfse(plugnotas_id);
create index if not exists mei_nfse_id_integracao_idx on public.mei_nfse(id_integracao);
create unique index if not exists mei_nfse_user_id_id_integracao_uq
  on public.mei_nfse(user_id, id_integracao)
  where id_integracao is not null;

alter table public.mei_nfse enable row level security;

create policy "mei_nfse_select_own"
on public.mei_nfse
for select
using (user_id = auth.uid());

create policy "mei_nfse_insert_own"
on public.mei_nfse
for insert
with check (user_id = auth.uid());

create policy "mei_nfse_update_own"
on public.mei_nfse
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
