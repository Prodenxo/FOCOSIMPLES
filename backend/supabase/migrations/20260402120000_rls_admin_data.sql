-- RLS para dados financeiros (admins e superadmins)
-- Dependências: public.current_app_role() e public.current_empresa_id()

-- Função helper para validar se admin pode ver usuário alvo
create or replace function public.admin_can_view_user(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    case
      when public.current_app_role() = 'superadmin' then true
      when public.current_app_role() = 'admin' then exists (
        select 1
        from public.role_x_user_x_empresa rx
        where rx.user_id = target_user_id
          and rx.empresas_id = public.current_empresa_id()
      )
      else false
    end;
$$;

-- Tabela: lancamentos_id
alter table public.lancamentos_id enable row level security;

drop policy if exists "lancamentos_select_self_or_admin" on public.lancamentos_id;
create policy "lancamentos_select_self_or_admin"
on public.lancamentos_id
for select
using (
  user_id = auth.uid()
  or public.admin_can_view_user(user_id)
);

drop policy if exists "lancamentos_insert_self" on public.lancamentos_id;
create policy "lancamentos_insert_self"
on public.lancamentos_id
for insert
with check (user_id = auth.uid());

drop policy if exists "lancamentos_update_self" on public.lancamentos_id;
create policy "lancamentos_update_self"
on public.lancamentos_id
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "lancamentos_delete_self" on public.lancamentos_id;
create policy "lancamentos_delete_self"
on public.lancamentos_id
for delete
using (user_id = auth.uid());

-- Tabela: categorias_id
alter table public.categorias_id enable row level security;

drop policy if exists "categorias_select_self_global_or_admin" on public.categorias_id;
create policy "categorias_select_self_global_or_admin"
on public.categorias_id
for select
using (
  user_id = auth.uid()
  or user_id is null
  or public.admin_can_view_user(user_id)
);

drop policy if exists "categorias_insert_self" on public.categorias_id;
create policy "categorias_insert_self"
on public.categorias_id
for insert
with check (user_id = auth.uid());

drop policy if exists "categorias_update_self" on public.categorias_id;
create policy "categorias_update_self"
on public.categorias_id
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "categorias_delete_self" on public.categorias_id;
create policy "categorias_delete_self"
on public.categorias_id
for delete
using (user_id = auth.uid());

-- RPCs para consulta admin (respeitam RLS)
create or replace function public.admin_user_transactions(target_user_id uuid)
returns setof public.lancamentos_id
language sql
stable
as $$
  select *
  from public.lancamentos_id
  where user_id = target_user_id
  order by criado_em desc;
$$;

create or replace function public.admin_user_categories(target_user_id uuid)
returns setof public.categorias_id
language sql
stable
as $$
  select *
  from public.categorias_id
  where user_id = target_user_id
     or user_id is null
  order by nome;
$$;

create or replace function public.admin_user_balance(target_user_id uuid)
returns table (
  balance numeric,
  total_entradas numeric,
  total_saidas numeric
)
language sql
stable
as $$
  select
    coalesce(sum(case when l.tipo = 'entrada' then l.valor else 0 end), 0) -
      coalesce(sum(case when l.tipo <> 'entrada' then l.valor else 0 end), 0) as balance,
    coalesce(sum(case when l.tipo = 'entrada' then l.valor else 0 end), 0) as total_entradas,
    coalesce(sum(case when l.tipo <> 'entrada' then l.valor else 0 end), 0) as total_saidas
  from public.lancamentos_id l
  where l.user_id = target_user_id;
$$;

grant select on public.lancamentos_id to authenticated;
grant select on public.categorias_id to authenticated;

grant execute on function public.admin_user_transactions(uuid) to authenticated;
grant execute on function public.admin_user_categories(uuid) to authenticated;
grant execute on function public.admin_user_balance(uuid) to authenticated;
grant execute on function public.admin_can_view_user(uuid) to authenticated;
