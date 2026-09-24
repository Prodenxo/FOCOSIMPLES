-- Troca de e-mail de login (AUTH_MODE=local). Só o backend escreve aqui.
create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_change_requests_user_id_idx
  on public.email_change_requests (user_id);

alter table public.email_change_requests enable row level security;
