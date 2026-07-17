-- Criar tabela para armazenar categorias de transações
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saída', 'saida'))
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_categorias_user_id ON categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON categorias(nome);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo ON categorias(tipo);

-- Índice composto para busca eficiente de categorias do usuário ou globais
CREATE INDEX IF NOT EXISTS idx_categorias_user_tipo ON categorias(user_id, tipo);

-- RLS (Row Level Security) - permitir que usuários vejam suas categorias e categorias globais
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver suas próprias categorias e categorias globais (user_id IS NULL)
CREATE POLICY "Users can view own and global categorias" ON categorias
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Política: usuários podem inserir suas próprias categorias (não podem inserir globais)
CREATE POLICY "Users can insert own categorias" ON categorias
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar apenas suas próprias categorias (não globais)
CREATE POLICY "Users can update own categorias" ON categorias
  FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Política: usuários podem deletar apenas suas próprias categorias (não globais)
CREATE POLICY "Users can delete own categorias" ON categorias
  FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

