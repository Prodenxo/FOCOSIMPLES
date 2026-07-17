-- ============================================================================
-- Migração: Garantir políticas RLS para tabelas renomeadas
-- ============================================================================
-- Esta migração garante que as políticas RLS estejam configuradas corretamente
-- para as tabelas renomeadas: categorias_id, lancamentos_id, google_tokens_id
-- ============================================================================

-- ============================================================================
-- 1. TABELA categorias_id
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE categorias_id ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own and global categorias" ON categorias_id;
DROP POLICY IF EXISTS "Users can insert own categorias" ON categorias_id;
DROP POLICY IF EXISTS "Users can update own categorias" ON categorias_id;
DROP POLICY IF EXISTS "Users can delete own categorias" ON categorias_id;

-- Criar políticas RLS para categorias_id
CREATE POLICY "Users can view own and global categorias" ON categorias_id
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

CREATE POLICY "Users can insert own categorias" ON categorias_id
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categorias" ON categorias_id
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can delete own categorias" ON categorias_id
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================================================
-- 2. TABELA lancamentos_id
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE lancamentos_id ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own lancamentos" ON lancamentos_id;
DROP POLICY IF EXISTS "Users can view own and global lancamentos" ON lancamentos_id;
DROP POLICY IF EXISTS "Users can insert own lancamentos" ON lancamentos_id;
DROP POLICY IF EXISTS "Users can update own lancamentos" ON lancamentos_id;
DROP POLICY IF EXISTS "Users can delete own lancamentos" ON lancamentos_id;

-- Criar políticas RLS para lancamentos_id
CREATE POLICY "Users can view own and global lancamentos" ON lancamentos_id
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

CREATE POLICY "Users can insert own lancamentos" ON lancamentos_id
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lancamentos" ON lancamentos_id
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can delete own lancamentos" ON lancamentos_id
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================================================
-- 3. TABELA google_tokens_id
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE google_tokens_id ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own tokens" ON google_tokens_id;
DROP POLICY IF EXISTS "Users can insert own tokens" ON google_tokens_id;
DROP POLICY IF EXISTS "Users can update own tokens" ON google_tokens_id;

-- Criar políticas RLS para google_tokens_id
CREATE POLICY "Users can view own tokens" ON google_tokens_id
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON google_tokens_id
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON google_tokens_id
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- Todas as políticas RLS foram configuradas para as tabelas renomeadas.
-- ============================================================================

