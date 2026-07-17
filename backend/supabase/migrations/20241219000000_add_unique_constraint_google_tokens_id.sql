-- ============================================================================
-- Adicionar Constraint UNIQUE em user_id na tabela google_tokens_id
-- ============================================================================
-- Esta migração garante que a tabela google_tokens_id tenha uma constraint
-- UNIQUE em user_id, necessária para o uso de onConflict no código.
-- ============================================================================

-- Verificar se a tabela google_tokens_id existe, se não, criar a partir de google_tokens
DO $$
BEGIN
  -- Se a tabela google_tokens_id não existe, criar a partir de google_tokens
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'google_tokens_id'
  ) THEN
    -- Criar tabela google_tokens_id baseada em google_tokens
    CREATE TABLE google_tokens_id AS 
    SELECT * FROM google_tokens WHERE 1=0;
    
    -- Adicionar colunas se necessário
    ALTER TABLE google_tokens_id 
      ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS access_token TEXT NOT NULL,
      ADD COLUMN IF NOT EXISTS refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Migrar dados de google_tokens para google_tokens_id
    INSERT INTO google_tokens_id (id, user_id, access_token, refresh_token, expires_at, created_at, updated_at)
    SELECT id, user_id, access_token, refresh_token, expires_at, created_at, updated_at
    FROM google_tokens
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Adicionar constraint UNIQUE em user_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'google_tokens_id'
    AND c.conname = 'google_tokens_id_user_id_key'
  ) THEN
    ALTER TABLE google_tokens_id 
    ADD CONSTRAINT google_tokens_id_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Garantir que há um índice em user_id para performance
CREATE INDEX IF NOT EXISTS idx_google_tokens_id_user_id ON google_tokens_id(user_id);

-- Habilitar RLS se não estiver habilitado
ALTER TABLE google_tokens_id ENABLE ROW LEVEL SECURITY;

-- Garantir que as políticas RLS existem
DO $$
BEGIN
  -- Política SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tokens_id' 
    AND policyname = 'Users can view own tokens'
  ) THEN
    CREATE POLICY "Users can view own tokens" ON google_tokens_id
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  -- Política INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tokens_id' 
    AND policyname = 'Users can insert own tokens'
  ) THEN
    CREATE POLICY "Users can insert own tokens" ON google_tokens_id
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- Política UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tokens_id' 
    AND policyname = 'Users can update own tokens'
  ) THEN
    CREATE POLICY "Users can update own tokens" ON google_tokens_id
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- A tabela google_tokens_id agora tem:
-- - Constraint UNIQUE em user_id (necessária para onConflict)
-- - Índice em user_id para performance
-- - Políticas RLS configuradas
-- ============================================================================

