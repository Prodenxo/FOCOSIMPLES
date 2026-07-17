-- Criar tabela para armazenar tokens OAuth do Google Calendar
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por telefone do usuário
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_phone ON google_tokens(user_phone);

-- RLS (Row Level Security) - permitir que usuários vejam apenas seus próprios tokens
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios tokens
CREATE POLICY "Users can view own tokens" ON google_tokens
  FOR SELECT USING (auth.jwt() ->> 'user_metadata' ->> 'phone' = user_phone);

-- Política: usuários podem inserir seus próprios tokens
CREATE POLICY "Users can insert own tokens" ON google_tokens
  FOR INSERT WITH CHECK (auth.jwt() ->> 'user_metadata' ->> 'phone' = user_phone);

-- Política: usuários podem atualizar seus próprios tokens
CREATE POLICY "Users can update own tokens" ON google_tokens
  FOR UPDATE USING (auth.jwt() ->> 'user_metadata' ->> 'phone' = user_phone);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

