-- ============================================================================
-- Migração: Configurar políticas RLS para tabela n8n_link
-- ============================================================================
-- Esta migração configura as políticas RLS para a tabela n8n_link,
-- permitindo que usuários vejam e atualizem apenas seus próprios registros.
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE public.n8n_link ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own n8n_link" ON public.n8n_link;
DROP POLICY IF EXISTS "Users can insert own n8n_link" ON public.n8n_link;
DROP POLICY IF EXISTS "Users can update own n8n_link" ON public.n8n_link;

-- Criar política para SELECT: usuários podem ver apenas seus próprios registros
CREATE POLICY "Users can view own n8n_link" ON public.n8n_link
  FOR SELECT USING (auth.uid() = user_id);

-- Criar política para INSERT: usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert own n8n_link" ON public.n8n_link
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Criar política para UPDATE: usuários podem atualizar seus próprios registros
CREATE POLICY "Users can update own n8n_link" ON public.n8n_link
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================
-- As políticas RLS foram configuradas para a tabela n8n_link.
-- Usuários podem ver, inserir e atualizar apenas seus próprios registros.
-- ============================================================================

