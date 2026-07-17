-- Migrar tabela google_tokens de user_phone para user_id

-- Primeiro, adicionar a nova coluna user_id
ALTER TABLE google_tokens 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrar dados existentes baseado em user_phone -> user_metadata.phone nos usuários
-- Nota: Esta migração assume que o user_phone corresponde ao phone em user_metadata
-- Se necessário, ajuste a lógica de mapeamento aqui
-- UPDATE google_tokens gt
-- SET user_id = u.id
-- FROM auth.users u
-- WHERE u.raw_user_meta_data->>'phone' = gt.user_phone
-- AND gt.user_id IS NULL;

-- Criar índice na nova coluna
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id);

-- Remover a constraint UNIQUE antiga do user_phone se existir
ALTER TABLE google_tokens DROP CONSTRAINT IF EXISTS google_tokens_user_phone_key;

-- Adicionar constraint UNIQUE no user_id
ALTER TABLE google_tokens ADD CONSTRAINT google_tokens_user_id_key UNIQUE (user_id);

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

-- Remover índice antigo se existir (opcional, pode ser mantido para migração)
-- DROP INDEX IF EXISTS idx_google_tokens_user_phone;

-- Nota: A coluna user_phone será removida em uma migração futura após confirmação
-- de que todos os dados foram migrados e o código foi atualizado
-- ALTER TABLE google_tokens DROP COLUMN IF EXISTS user_phone;

