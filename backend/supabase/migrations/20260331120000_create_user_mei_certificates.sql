-- user_mei_certificates: dados do prestador MEI para prefill NFSe (Épico 2).
--
-- Antes de aplicar em projecto onde a tabela já exista com outro DDL:
-- 1) Executar docs/contracts/sql/information_schema-user_mei_certificates.sql
-- 2) Diff contra esta definição; usar migração ALTER incremental se necessário.
--
-- Ambiente de referência para esta revisão: DDL revisto no repositório
-- financas-pessoais-mobile (workspace local), 2026-03-31.

create table if not exists public.user_mei_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cnpj text,
  razao_social text,
  email text,
  inscricao_municipal text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  codigo_ibge text,
  cep text,
  cidade text,
  uf text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_mei_certificates is
  'Cadastro fiscal do prestador MEI por utilizador; fonte de prefill NFSe (contrato docs/contracts/nfse-prestador-from-mei-certificate.md).';

create index if not exists idx_user_mei_certificates_user_updated
  on public.user_mei_certificates (user_id, updated_at desc);

create index if not exists idx_user_mei_certificates_user_active
  on public.user_mei_certificates (user_id, is_active)
  where is_active = true;

-- updated_at automático
create or replace function public.set_user_mei_certificates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_mei_certificates_updated_at on public.user_mei_certificates;
create trigger trg_user_mei_certificates_updated_at
  before update on public.user_mei_certificates
  for each row execute procedure public.set_user_mei_certificates_updated_at();

alter table public.user_mei_certificates enable row level security;

drop policy if exists "user_mei_certificates_select_own" on public.user_mei_certificates;
create policy "user_mei_certificates_select_own"
  on public.user_mei_certificates
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_mei_certificates_insert_own" on public.user_mei_certificates;
create policy "user_mei_certificates_insert_own"
  on public.user_mei_certificates
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_mei_certificates_update_own" on public.user_mei_certificates;
create policy "user_mei_certificates_update_own"
  on public.user_mei_certificates
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_mei_certificates_delete_own" on public.user_mei_certificates;
create policy "user_mei_certificates_delete_own"
  on public.user_mei_certificates
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Admin BFF: leitura por outro user_id via service_role (fora do cliente anon);
-- não adicionar policy service_role aqui — Edge Function com service_role ignora RLS por defeito.
