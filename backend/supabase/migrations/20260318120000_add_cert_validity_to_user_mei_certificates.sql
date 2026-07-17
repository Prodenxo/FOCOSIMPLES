-- Coluna expires_at em role_x_user_x_empresa (validade apenas para role usuario)
alter table public.role_x_user_x_empresa
  add column if not exists expires_at timestamptz null;

create index if not exists idx_role_x_user_x_empresa_expires_at
  on public.role_x_user_x_empresa (expires_at)
  where expires_at is not null;
