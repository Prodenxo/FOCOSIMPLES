-- Idempotente: garante trigger que copia categorias globais para novos utilizadores.
-- A migração 20260505130000 pode não ter sido aplicada em todos os ambientes.

CREATE OR REPLACE FUNCTION public.copy_global_categories_to_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categorias_id (user_id, nome, tipo)
  SELECT NEW.id, nome, tipo
  FROM public.categorias_id
  WHERE user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_copy_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_copy_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_global_categories_to_new_user();
