-- ============================================================================
-- Migração: Atualizar user_id na tabela categorias_id baseado em user_phone
-- ============================================================================
-- Este script atualiza a coluna user_id na tabela categorias_id com os IDs
-- dos usuários de auth.users, baseado no mapeamento dos números de telefone
-- armazenados em user_phone.
-- 
-- O script é idempotente e pode ser executado múltiplas vezes sem problemas.
-- ============================================================================

-- ============================================================================
-- MIGRAÇÃO DA TABELA categorias_id
-- ============================================================================

-- Verificar se existe coluna user_phone e migrar para user_id se necessário
DO $$
BEGIN
  -- Verificar se a tabela categorias_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'categorias_id'
  ) THEN
    -- Se existe user_phone, adicionar user_id e migrar dados
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categorias_id' AND column_name = 'user_phone'
    ) THEN
      -- Adicionar user_id se não existir
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorias_id' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE categorias_id 
          ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      END IF;
      
      -- Migrar dados de user_phone para user_id
      -- Apenas atualiza registros onde user_id IS NULL para evitar sobrescrever dados existentes
      UPDATE categorias_id c
      SET user_id = u.id
      FROM auth.users u
      WHERE u.raw_user_meta_data->>'phone' = c.user_phone::TEXT
        AND c.user_id IS NULL
        AND c.user_phone IS NOT NULL;
    ELSE
      -- Se não existe user_phone, apenas adicionar user_id se não existir
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorias_id' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE categorias_id 
          ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- Garantir que user_id seja nullable (para permitir categorias globais, se necessário)
-- Apenas se a coluna existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categorias_id' AND column_name = 'user_id'
  ) THEN
    -- Tentar remover NOT NULL se existir (pode falhar silenciosamente se já for nullable)
    BEGIN
      ALTER TABLE categorias_id 
        ALTER COLUMN user_id DROP NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN
        -- Ignorar erro se a coluna já for nullable
        NULL;
    END;
  END IF;
END $$;

-- Criar índices para busca rápida (se não existirem)
CREATE INDEX IF NOT EXISTS idx_categorias_id_user_id ON categorias_id(user_id);

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- A tabela categorias_id foi atualizada com user_id baseado em user_phone.
-- Os dados existentes foram migrados de user_phone para user_id através do
-- mapeamento com auth.users.raw_user_meta_data->>'phone'.
-- 
-- Nota: A coluna user_phone foi mantida para compatibilidade e pode ser
-- removida em uma migração futura após confirmação.
-- ============================================================================

