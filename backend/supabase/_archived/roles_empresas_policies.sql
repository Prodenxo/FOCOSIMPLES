-- Ajustes de roles/empresas e políticas RLS

-- Remover UNIQUE indevido em roles_id (permite múltiplos usuários por role)
alter table public.role_x_user_x_empresa
  drop constraint if exists role_x_user_x_empresa_roles_id_key;

-- Funções auxiliares para RLS
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.roles
  from public.role_x_user_x_empresa rx
  join public.roles r on r.id = rx.roles_id
  where rx.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rx.empresas_id
  from public.role_x_user_x_empresa rx
  where rx.user_id = auth.uid()
  limit 1;
$$;

-- RLS para roles
alter table public.roles enable row level security;

create policy if not exists "roles_select_authenticated"
on public.roles
for select
using (auth.role() = 'authenticated');

-- RLS para role_x_user_x_empresa
alter table public.role_x_user_x_empresa enable row level security;

create policy if not exists "role_link_select_self_or_admin"
on public.role_x_user_x_empresa
for select
using (
  user_id = auth.uid()
  or public.current_app_role() = 'superadmin'
  or (public.current_app_role() = 'admin' and empresas_id = public.current_empresa_id())
);

create policy if not exists "role_link_insert_admin"
on public.role_x_user_x_empresa
for insert
with check (
  public.current_app_role() in ('admin','superadmin')
);

create policy if not exists "role_link_update_superadmin"
on public.role_x_user_x_empresa
for update
using (public.current_app_role() = 'superadmin')
with check (true);

-- RLS para empresas
alter table public.empresas enable row level security;

create policy if not exists "empresas_select_self_or_admin"
on public.empresas
for select
using (
  public.current_app_role() = 'superadmin'
  or (public.current_app_role() = 'admin' and id = public.current_empresa_id())
);

-- Permite múltiplos admins por empresa (sem trigger de bloqueio)
drop trigger if exists trg_one_admin_per_empresa on public.role_x_user_x_empresa;
drop function if exists public.ensure_one_admin_per_empresa();
