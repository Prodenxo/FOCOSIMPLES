-- Foco Simples — indexes + triggers (EasyPanel / public.users)
-- Rodar depois de 001_init_schema.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_recorrencias_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contas_financeiras_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contas_moeda_global_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Copia categorias globais (user_id IS NULL) para o novo usuário
CREATE OR REPLACE FUNCTION public.copy_global_categories_to_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.categorias_id (user_id, nome, tipo)
  SELECT NEW.id, nome, tipo
  FROM public.categorias_id
  WHERE user_id IS NULL;
  RETURN NEW;
END;
$$;

-- Perfil padrão ao criar user
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'usuario')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_google_tokens_id_updated_at ON public.google_tokens_id;
CREATE TRIGGER update_google_tokens_id_updated_at
  BEFORE UPDATE ON public.google_tokens_id
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_recorrencias_atualizado_em ON public.recorrencias;
CREATE TRIGGER trg_recorrencias_atualizado_em
  BEFORE UPDATE ON public.recorrencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recorrencias_atualizado_em();

DROP TRIGGER IF EXISTS trg_contas_financeiras_atualizado_em ON public.contas_financeiras;
CREATE TRIGGER trg_contas_financeiras_atualizado_em
  BEFORE UPDATE ON public.contas_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contas_financeiras_atualizado_em();

DROP TRIGGER IF EXISTS trg_contas_moeda_global_atualizado_em ON public.contas_moeda_global;
CREATE TRIGGER trg_contas_moeda_global_atualizado_em
  BEFORE UPDATE ON public.contas_moeda_global
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contas_moeda_global_atualizado_em();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_user_created_create_profile ON public.users;
CREATE TRIGGER on_user_created_create_profile
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();

DROP TRIGGER IF EXISTS on_user_created_copy_categories ON public.users;
CREATE TRIGGER on_user_created_copy_categories
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_global_categories_to_new_user();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

CREATE INDEX IF NOT EXISTS idx_lancamentos_id_user_id ON public.lancamentos_id (user_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_id_criado_em ON public.lancamentos_id (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_id_data ON public.lancamentos_id (data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_id_tipo ON public.lancamentos_id (tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_id_status ON public.lancamentos_id (status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_id_recorrencia
  ON public.lancamentos_id (recorrencia_id)
  WHERE recorrencia_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_id_recorrencia_mes_unique
  ON public.lancamentos_id (recorrencia_id, recorrencia_ano_mes)
  WHERE recorrencia_id IS NOT NULL AND recorrencia_ano_mes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_id_user_id ON public.categorias_id (user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_id_nome ON public.categorias_id (nome);
CREATE INDEX IF NOT EXISTS idx_categorias_id_tipo ON public.categorias_id (tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_id_user_tipo ON public.categorias_id (user_id, tipo);

CREATE INDEX IF NOT EXISTS idx_recorrencias_user_id ON public.recorrencias (user_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_ativo ON public.recorrencias (ativo);
CREATE INDEX IF NOT EXISTS idx_recorrencias_user_ativo ON public.recorrencias (user_id, ativo);
CREATE INDEX IF NOT EXISTS idx_recorrencias_limite
  ON public.recorrencias (user_id)
  WHERE ativo = true AND max_ocorrencias IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recorrencias_job_runs_run_key
  ON public.recorrencias_job_runs (run_key);

CREATE INDEX IF NOT EXISTS idx_google_tokens_id_user_id ON public.google_tokens_id (user_id);

CREATE INDEX IF NOT EXISTS idx_contas_financeiras_user_id ON public.contas_financeiras (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_moeda_global_user_id ON public.contas_moeda_global (user_id);

CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_user_id
  ON public.role_x_user_x_empresa (user_id);
CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_empresas_id
  ON public.role_x_user_x_empresa (empresas_id);
CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_user_status
  ON public.role_x_user_x_empresa (user_id, status);

CREATE INDEX IF NOT EXISTS idx_mei_nfse_user_id ON public.mei_nfse (user_id);
CREATE INDEX IF NOT EXISTS idx_mei_nfse_clientes_user_id ON public.mei_nfse_clientes (user_id);
CREATE INDEX IF NOT EXISTS idx_mei_nfse_produtos_user_id ON public.mei_nfse_produtos (user_id);

CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public.orcamentos (user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_link_user_number ON public.n8n_link (user_number);

CREATE INDEX IF NOT EXISTS idx_empresa_invites_empresas_id ON public.empresa_invites (empresas_id);
CREATE INDEX IF NOT EXISTS idx_das_mensal_status_user_competencia
  ON public.das_mensal_status (user_id, competencia);

COMMIT;
