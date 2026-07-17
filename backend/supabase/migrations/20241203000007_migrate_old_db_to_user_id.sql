-- ============================================================================
-- Migração do Banco de Dados Antigo para user_id
-- ============================================================================
-- Este script adapta o banco de dados antigo (que usa user_phone) para usar
-- user_id como identificador de usuário em todas as tabelas.
-- 
-- O script é idempotente e pode ser executado múltiplas vezes sem problemas.
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÕES E TRIGGERS AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. MIGRAÇÃO DA TABELA google_tokens
-- ============================================================================

-- Criar tabela google_tokens se não existir
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar coluna user_id se não existir
ALTER TABLE google_tokens 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrar dados existentes de user_phone para user_id
-- Mapeia através de auth.users.raw_user_meta_data->>'phone'
UPDATE google_tokens gt
SET user_id = u.id
FROM auth.users u
WHERE u.raw_user_meta_data->>'phone' = gt.user_phone
  AND gt.user_id IS NULL
  AND gt.user_phone IS NOT NULL;

-- Criar índice em user_id
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id);

-- Criar índice em user_phone (se ainda não existir) para compatibilidade
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_phone ON google_tokens(user_phone);

-- Remover constraint UNIQUE antiga do user_phone se existir
ALTER TABLE google_tokens DROP CONSTRAINT IF EXISTS google_tokens_user_phone_key;

-- Adicionar constraint UNIQUE no user_id (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'google_tokens_user_id_key'
  ) THEN
    ALTER TABLE google_tokens ADD CONSTRAINT google_tokens_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas baseadas em user_phone
DROP POLICY IF EXISTS "Users can view own tokens" ON google_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON google_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON google_tokens;

-- Criar novas políticas baseadas em user_id usando auth.uid()
CREATE POLICY "Users can view own tokens" ON google_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON google_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON google_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Criar/atualizar trigger para updated_at
DROP TRIGGER IF EXISTS update_google_tokens_updated_at ON google_tokens;
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. MIGRAÇÃO DA TABELA lancamentos
-- ============================================================================

-- Criar tabela lancamentos se não existir
CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saída', 'saida')),
  valor NUMERIC(10, 2) NOT NULL,
  classificacao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pago',
  data DATE,
  categoria TEXT,
  obs TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Verificar se existe coluna user_phone e migrar para user_id se necessário
DO $$
BEGIN
  -- Se existe user_phone, adicionar user_id e migrar dados
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lancamentos' AND column_name = 'user_phone'
  ) THEN
    -- Adicionar user_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'lancamentos' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE lancamentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Migrar dados de user_phone para user_id
    UPDATE lancamentos l
    SET user_id = u.id
    FROM auth.users u
    WHERE u.raw_user_meta_data->>'phone' = l.user_phone::TEXT
      AND l.user_id IS NULL
      AND l.user_phone IS NOT NULL;
  ELSE
    -- Se não existe user_phone, apenas adicionar user_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'lancamentos' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE lancamentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Tornar user_id nullable para permitir transações globais
ALTER TABLE lancamentos 
  ALTER COLUMN user_id DROP NOT NULL;

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id ON lancamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_criado_em ON lancamentos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);

-- Habilitar RLS
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Users can view own and global lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Users can insert own lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Users can update own lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Users can delete own lancamentos" ON lancamentos;

-- Criar novas políticas RLS
-- SELECT: usuários podem ver suas próprias transações e transações globais (user_id IS NULL)
CREATE POLICY "Users can view own and global lancamentos" ON lancamentos
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- INSERT: usuários podem inserir apenas suas próprias transações (não podem inserir globais)
CREATE POLICY "Users can insert own lancamentos" ON lancamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: usuários podem atualizar apenas suas próprias transações (não globais)
CREATE POLICY "Users can update own lancamentos" ON lancamentos
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- DELETE: usuários podem deletar apenas suas próprias transações (não globais)
CREATE POLICY "Users can delete own lancamentos" ON lancamentos
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================================================
-- 4. MIGRAÇÃO DA TABELA categorias
-- ============================================================================

-- Criar tabela categorias se não existir
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saída', 'saida'))
);

-- Verificar se existe coluna user_phone e migrar para user_id se necessário
DO $$
BEGIN
  -- Se existe user_phone, adicionar user_id e migrar dados
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categorias' AND column_name = 'user_phone'
  ) THEN
    -- Adicionar user_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categorias' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE categorias ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Migrar dados de user_phone para user_id
    UPDATE categorias c
    SET user_id = u.id
    FROM auth.users u
    WHERE u.raw_user_meta_data->>'phone' = c.user_phone::TEXT
      AND c.user_id IS NULL
      AND c.user_phone IS NOT NULL;
  ELSE
    -- Se não existe user_phone, apenas adicionar user_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categorias' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE categorias ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Garantir que user_id seja nullable (para categorias globais)
-- Não precisa de ALTER COLUMN porque já é nullable por padrão quando adicionado

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_categorias_user_id ON categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON categorias(nome);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo ON categorias(tipo);

-- Índice composto para busca eficiente de categorias do usuário ou globais
CREATE INDEX IF NOT EXISTS idx_categorias_user_tipo ON categorias(user_id, tipo);

-- Habilitar RLS
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own and global categorias" ON categorias;
DROP POLICY IF EXISTS "Users can insert own categorias" ON categorias;
DROP POLICY IF EXISTS "Users can update own categorias" ON categorias;
DROP POLICY IF EXISTS "Users can delete own categorias" ON categorias;

-- Criar novas políticas RLS
-- SELECT: usuários podem ver suas próprias categorias e categorias globais (user_id IS NULL)
CREATE POLICY "Users can view own and global categorias" ON categorias
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- INSERT: usuários podem inserir suas próprias categorias (não podem inserir globais)
CREATE POLICY "Users can insert own categorias" ON categorias
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: usuários podem atualizar apenas suas próprias categorias (não globais)
CREATE POLICY "Users can update own categorias" ON categorias
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- DELETE: usuários podem deletar apenas suas próprias categorias (não globais)
CREATE POLICY "Users can delete own categorias" ON categorias
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================================================
-- 5. CORRIGIR SEQUÊNCIA DA TABELA categorias (se necessário)
-- ============================================================================

-- Garantir que a sequência esteja sincronizada com o maior ID existente
DO $$
DECLARE
    max_id INTEGER;
BEGIN
    -- Encontrar o maior ID existente
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM categorias;
    
    -- Atualizar a sequência para começar após o maior ID existente
    IF max_id > 0 THEN
        PERFORM setval('categorias_id_seq', max_id, true);
    END IF;
END $$;

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- Todas as tabelas foram adaptadas para usar user_id como base.
-- Os dados existentes foram migrados de user_phone para user_id.
-- As políticas RLS foram atualizadas para usar auth.uid() = user_id.
-- 
-- Nota: A coluna user_phone foi mantida nas tabelas para compatibilidade
-- e pode ser removida em uma migração futura após confirmação.
-- ============================================================================

