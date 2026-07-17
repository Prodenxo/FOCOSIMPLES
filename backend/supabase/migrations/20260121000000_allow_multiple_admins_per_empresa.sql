-- Permitir mais de um admin por empresa: remover trigger e função
drop trigger if exists trg_one_admin_per_empresa on public.role_x_user_x_empresa;
drop function if exists public.ensure_one_admin_per_empresa();
