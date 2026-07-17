-- ============================================================================
-- Migração: Sincronizar user_metadata.phone com coluna phone de auth.users
-- ============================================================================
-- Esta migração cria uma função e trigger que sincroniza automaticamente
-- o telefone do user_metadata com a coluna phone nativa de auth.users.
-- Isso permite atualizar o telefone sem precisar de SMS provider configurado.
-- ============================================================================

-- Função para sincronizar phone de user_metadata para coluna phone
CREATE OR REPLACE FUNCTION sync_phone_to_auth_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar a coluna phone de auth.users com o valor de user_metadata.phone
  -- Apenas se o telefone foi alterado no user_metadata
  IF NEW.raw_user_meta_data->>'phone' IS DISTINCT FROM OLD.raw_user_meta_data->>'phone' THEN
    UPDATE auth.users
    SET phone = NEW.raw_user_meta_data->>'phone'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS sync_phone_trigger ON auth.users;

-- Criar trigger que executa a função após atualização de user_metadata
CREATE TRIGGER sync_phone_trigger
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (
    -- Apenas executar se o campo phone no metadata foi alterado
    (NEW.raw_user_meta_data->>'phone' IS DISTINCT FROM OLD.raw_user_meta_data->>'phone')
  )
  EXECUTE FUNCTION sync_phone_to_auth_users();

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- O trigger foi configurado para sincronizar automaticamente user_metadata.phone
-- com a coluna phone de auth.users sempre que o metadata for atualizado.
-- ============================================================================

