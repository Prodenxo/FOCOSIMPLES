-- Novos vínculos não devem nascer com MEI ligado (era default true desde 20260317).
alter table public.role_x_user_x_empresa
  alter column mei set default false;
