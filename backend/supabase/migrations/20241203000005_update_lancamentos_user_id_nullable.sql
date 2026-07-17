-- Permitir user_id NULL na tabela lancamentos para transações globais
ALTER TABLE lancamentos 
  ALTER COLUMN user_id DROP NOT NULL;

-- Remover política antiga de SELECT
DROP POLICY IF EXISTS "Users can view own lancamentos" ON lancamentos;

-- Nova política: usuários podem ver suas próprias transações e transações globais (user_id IS NULL)
CREATE POLICY "Users can view own and global lancamentos" ON lancamentos
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Manter políticas de INSERT/UPDATE/DELETE restritas (usuários só podem modificar suas próprias transações)
-- As políticas existentes já estão corretas, mas vamos garantir que estão atualizadas

-- Política: usuários podem inserir apenas suas próprias transações (não podem inserir globais)
-- A política existente já está correta, mas vamos recriar para garantir consistência
DROP POLICY IF EXISTS "Users can insert own lancamentos" ON lancamentos;
CREATE POLICY "Users can insert own lancamentos" ON lancamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar apenas suas próprias transações (não globais)
DROP POLICY IF EXISTS "Users can update own lancamentos" ON lancamentos;
CREATE POLICY "Users can update own lancamentos" ON lancamentos
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Política: usuários podem deletar apenas suas próprias transações (não globais)
DROP POLICY IF EXISTS "Users can delete own lancamentos" ON lancamentos;
CREATE POLICY "Users can delete own lancamentos" ON lancamentos
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

