-- Ajustes de roles/empresas e políticas RLS
-- Remover UNIQUE indevido em roles_id (permite múltiplos usuários por role)
alter table public.role_x_user_x_empresa
  drop constraint if exists role_x_user_x_empresa_roles_id_key;

-- Funções auxiliares para RLS
create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select r.roles
  from public.role_x_user_x_empresa rx
  join public.roles r on r.id = rx.roles_id
  where rx.user_id = auth.uid()
  order by rx.created_at desc
  limit 1;
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select rx.empresas_id
  from public.role_x_user_x_empresa rx
  where rx.user_id = auth.uid()
  order by rx.created_at desc
  limit 1;
$$;

-- RLS para roles
alter table public.roles enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
on public.roles
for select
using (auth.role() = 'authenticated');

-- RLS para role_x_user_x_empresa
alter table public.role_x_user_x_empresa enable row level security;

drop policy if exists "role_link_select_self_or_admin" on public.role_x_user_x_empresa;
create policy "role_link_select_self_or_admin"
on public.role_x_user_x_empresa
for select
using (
  user_id = auth.uid()
  or public.current_app_role() = 'superadmin'
  or (public.current_app_role() = 'admin' and empresas_id = public.current_empresa_id())
);

drop policy if exists "role_link_insert_admin" on public.role_x_user_x_empresa;
create policy "role_link_insert_admin"
on public.role_x_user_x_empresa
for insert
with check (
  public.current_app_role() in ('admin','superadmin')
);

drop policy if exists "role_link_update_superadmin" on public.role_x_user_x_empresa;
create policy "role_link_update_superadmin"
on public.role_x_user_x_empresa
for update
using (public.current_app_role() = 'superadmin');

-- RLS para empresas
alter table public.empresas enable row level security;

drop policy if exists "empresas_select_self_or_admin" on public.empresas;
create policy "empresas_select_self_or_admin"
on public.empresas
for select
using (
  public.current_app_role() = 'superadmin'
  or (public.current_app_role() = 'admin' and id = public.current_empresa_id())
);

-- Trigger para garantir apenas 1 admin por empresa
create or replace function public.ensure_one_admin_per_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id uuid;
begin
  select id into admin_role_id from public.roles where roles = 'admin' limit 1;
  if admin_role_id is null then
    raise exception 'Role admin não encontrada';
  end if;

  if new.roles_id = admin_role_id then
    if exists (
      select 1
      from public.role_x_user_x_empresa
      where empresas_id = new.empresas_id
        and roles_id = admin_role_id
        and id <> coalesce(new.id, gen_random_uuid())
    ) then
      raise exception 'Essa empresa já possui um Admin';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_one_admin_per_empresa on public.role_x_user_x_empresa;
create trigger trg_one_admin_per_empresa
before insert or update on public.role_x_user_x_empresa
for each row execute procedure public.ensure_one_admin_per_empresa();
