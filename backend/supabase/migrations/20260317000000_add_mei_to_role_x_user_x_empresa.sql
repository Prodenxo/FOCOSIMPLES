-- Coluna mei em role_x_user_x_empresa (MEI habilitado por usuário, alinhado ao site)
alter table public.role_x_user_x_empresa
  add column if not exists mei boolean default true;
