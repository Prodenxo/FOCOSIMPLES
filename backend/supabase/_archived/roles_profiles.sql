create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'usuario' check (role in ('superadmin','admin','usuario','outsider')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.current_role() in ('admin','superadmin'));

create policy "profiles_update_superadmin"
on public.profiles
for update
using (public.current_role() = 'superadmin')
with check (true);

insert into public.profiles (id)
select id from auth.users
on conflict do nothing;

-- Defina manualmente seu superadmin:
-- update public.profiles set role = 'superadmin' where id = 'SEU_USER_ID';
