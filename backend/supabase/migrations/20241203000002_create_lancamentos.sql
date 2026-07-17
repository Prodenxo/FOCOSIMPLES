-- Criar tabela para armazenar lançamentos financeiros (transações)
CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saída', 'saida')),
  valor NUMERIC(10, 2) NOT NULL,
  classificacao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pago',
  data DATE,
  categoria TEXT,
  obs TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id ON lancamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_criado_em ON lancamentos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);

-- RLS (Row Level Security) - permitir que usuários vejam apenas seus próprios lançamentos
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios lançamentos
CREATE POLICY "Users can view own lancamentos" ON lancamentos
  FOR SELECT USING (auth.uid() = user_id);

-- Política: usuários podem inserir seus próprios lançamentos
CREATE POLICY "Users can insert own lancamentos" ON lancamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar seus próprios lançamentos
CREATE POLICY "Users can update own lancamentos" ON lancamentos
  FOR UPDATE USING (auth.uid() = user_id);

-- Política: usuários podem deletar seus próprios lançamentos
CREATE POLICY "Users can delete own lancamentos" ON lancamentos
  FOR DELETE USING (auth.uid() = user_id);

