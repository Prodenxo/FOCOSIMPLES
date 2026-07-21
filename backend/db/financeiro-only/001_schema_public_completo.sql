-- =============================================================================
-- Schema public COMPLETO — Meu Financeiro / FocoMEI / Foco Simples
-- Fonte: dump Supabase Dashboard (mesmo banco, 3 produtos / entregas diferentes).
--
-- Pré-requisito: schema auth com auth.users (projeto Supabase).
-- Se Postgres puro: troque REFERENCES auth.users(id) pela sua tabela de users
-- e remova defaults auth.uid() / triggers em auth.users.
--
-- Tabelas (29): profiles, roles, empresas, role_x_user_x_empresa, empresa_invites, empresa_mei_subscription_lines, categorias_id, contas_financeiras, contas_moeda_global, recorrencias, recorrencias_job_runs, recorrencia_skips, lancamentos_id, orçamentos, n8n_link, google_tokens_id, google_oauth_states, calendar_checklist_completions, calendar_upcoming_reminder_sent, user_mei_certificates, mei_nfse, mei_nfse_clientes, mei_nfse_produtos, mei_nfse_rps_counters, codigosservicos, DAS_mei, das_mensal_status, das_mensal_job_runs, parcelamento_pdfs
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  role text NOT NULL DEFAULT 'usuario'::text CHECK (role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'usuario'::text, 'outsider'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_update_id text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- roles
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  roles text NOT NULL DEFAULT ''::text UNIQUE,
  CONSTRAINT roles_pkey PRIMARY KEY (id, roles)
);

-- empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  empresa text NOT NULL UNIQUE,
  max_mei integer CHECK (max_mei IS NULL OR max_mei >= 0),
  max_usuarios_nao_mei integer CHECK (max_usuarios_nao_mei IS NULL OR max_usuarios_nao_mei >= 0),
  cnpj text,
  razao_social text,
  nome_fantasia text,
  inscricao_estadual text,
  regime_tributario text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  telefone text,
  email text,
  stripe_customer_id text,
  legacy_mei_slots_pix integer NOT NULL DEFAULT 0 CHECK (legacy_mei_slots_pix >= 0),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text])),
  requested_by uuid,
  CONSTRAINT empresas_pkey PRIMARY KEY (id),
  CONSTRAINT empresas_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id)
);

-- role_x_user_x_empresa
CREATE TABLE IF NOT EXISTS public.role_x_user_x_empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  roles_id uuid,
  empresas_id uuid DEFAULT gen_random_uuid(),
  status boolean,
  mei boolean,
  expires_at timestamp with time zone,
  CONSTRAINT role_x_user_x_empresa_pkey PRIMARY KEY (id),
  CONSTRAINT role_x_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT role_x_user_x_empresa_empresas_id_fkey FOREIGN KEY (empresas_id) REFERENCES public.empresas(id),
  CONSTRAINT role_x_user_x_empresa_roles_id_fkey FOREIGN KEY (roles_id) REFERENCES public.roles(id)
);

-- empresa_invites
CREATE TABLE IF NOT EXISTS public.empresa_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresas_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  invited_email text,
  is_reusable boolean DEFAULT false,
  uses_count integer DEFAULT 0,
  raw_token text,
  CONSTRAINT empresa_invites_pkey PRIMARY KEY (id),
  CONSTRAINT empresa_invites_empresas_id_fkey FOREIGN KEY (empresas_id) REFERENCES public.empresas(id),
  CONSTRAINT empresa_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- empresa_mei_subscription_lines
CREATE TABLE IF NOT EXISTS public.empresa_mei_subscription_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  mei_slots integer NOT NULL CHECK (mei_slots > 0),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'cancelled'::text])),
  value_numeric numeric,
  billing_type text,
  external_reference text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  CONSTRAINT empresa_mei_subscription_lines_pkey PRIMARY KEY (id),
  CONSTRAINT empresa_asaas_subscription_lines_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
);

-- categorias_id
CREATE TABLE IF NOT EXISTS public.categorias_id (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'saída'::text])),
  cor text,
  criada_em timestamp without time zone DEFAULT timezone('America/Sao_Paulo'::text, now()),
  user_phone numeric,
  user_id uuid,
  CONSTRAINT categorias_id_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- contas_financeiras
CREATE TABLE IF NOT EXISTS public.contas_financeiras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['corrente'::text, 'poupanca'::text, 'cartao_credito'::text, 'dinheiro'::text, 'outro'::text])),
  saldo_inicial numeric NOT NULL DEFAULT 0,
  limite_credito numeric,
  dia_fechamento integer CHECK (dia_fechamento IS NULL OR dia_fechamento >= 1 AND dia_fechamento <= 31),
  dia_vencimento integer CHECK (dia_vencimento IS NULL OR dia_vencimento >= 1 AND dia_vencimento <= 31),
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  of_provider text,
  of_external_id text,
  of_last_synced_at timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  instituicao_id text,
  CONSTRAINT contas_financeiras_pkey PRIMARY KEY (id),
  CONSTRAINT contas_financeiras_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- contas_moeda_global
CREATE TABLE IF NOT EXISTS public.contas_moeda_global (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  moeda text NOT NULL CHECK (char_length(moeda) = 3),
  nome text,
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0::numeric),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contas_moeda_global_pkey PRIMARY KEY (id),
  CONSTRAINT contas_moeda_global_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- recorrencias
CREATE TABLE IF NOT EXISTS public.recorrencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dia_do_mes integer NOT NULL CHECK (dia_do_mes >= 1 AND dia_do_mes <= 31),
  valor numeric NOT NULL,
  classificacao text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada'::text, 'saída'::text, 'saida'::text])),
  status text NOT NULL DEFAULT 'pago'::text,
  obs text,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  max_ocorrencias integer CHECK (max_ocorrencias IS NULL OR max_ocorrencias >= 1 AND max_ocorrencias <= 1200),
  ocorrencias_geradas integer NOT NULL DEFAULT 0 CHECK (ocorrencias_geradas >= 0),
  CONSTRAINT recorrencias_pkey PRIMARY KEY (id),
  CONSTRAINT recorrencias_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- recorrencias_job_runs
CREATE TABLE IF NOT EXISTS public.recorrencias_job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_key text NOT NULL CHECK (run_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text),
  run_type text NOT NULL DEFAULT 'diario'::text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recorrencias_job_runs_pkey PRIMARY KEY (id)
);

-- recorrencia_skips
CREATE TABLE IF NOT EXISTS public.recorrencia_skips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recorrencia_id uuid NOT NULL,
  ano_mes text NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text),
  motivo text NOT NULL DEFAULT 'manual_delete'::text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recorrencia_skips_pkey PRIMARY KEY (id),
  CONSTRAINT recorrencia_skips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recorrencia_skips_recorrencia_id_fkey FOREIGN KEY (recorrencia_id) REFERENCES public.recorrencias(id)
);

-- lancamentos_id
CREATE TABLE IF NOT EXISTS public.lancamentos_id (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'saída'::text])),
  valor numeric NOT NULL,
  classificacao text NOT NULL,
  criado_em timestamp without time zone DEFAULT timezone('America/Sao_Paulo'::text, now()),
  user_phone numeric,
  categoria text,
  data date,
  status text NOT NULL DEFAULT 'realizado'::text,
  obs text,
  user_id uuid,
  recorrencia_id uuid,
  recorrencia_ano_mes text,
  conta_id uuid,
  CONSTRAINT lancamentos_id_pkey PRIMARY KEY (id),
  CONSTRAINT lancamentos_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT lancamentos_id_recorrencia_id_fkey FOREIGN KEY (recorrencia_id) REFERENCES public.recorrencias(id),
  CONSTRAINT lancamentos_id_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES public.contas_financeiras(id)
);

-- orçamentos
CREATE TABLE IF NOT EXISTS public."orçamentos" (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  categorias_id bigint NOT NULL,
  "valor_orçado" numeric,
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  date date,
  CONSTRAINT "orçamentos_pkey" PRIMARY KEY (id),
  CONSTRAINT "Orçamentos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "orçamentos_categorias_id_fkey" FOREIGN KEY (categorias_id) REFERENCES public.categorias_id(id)
);

-- n8n_link
CREATE TABLE IF NOT EXISTS public.n8n_link (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid() UNIQUE,
  user_number text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT n8n_link_pkey PRIMARY KEY (id),
  CONSTRAINT n8n_link_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- google_tokens_id
CREATE TABLE IF NOT EXISTS public.google_tokens_id (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  access_token text NOT NULL UNIQUE,
  refresh_token text NOT NULL UNIQUE,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL UNIQUE,
  CONSTRAINT google_tokens_id_pkey PRIMARY KEY (id),
  CONSTRAINT google_tokens_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- google_oauth_states
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT google_oauth_states_pkey PRIMARY KEY (id),
  CONSTRAINT google_oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- calendar_checklist_completions
CREATE TABLE IF NOT EXISTS public.calendar_checklist_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_date date NOT NULL,
  event_id text,
  event_key text NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT calendar_checklist_completions_pkey PRIMARY KEY (id)
);

-- calendar_upcoming_reminder_sent
CREATE TABLE IF NOT EXISTS public.calendar_upcoming_reminder_sent (
  user_id uuid NOT NULL,
  event_date date NOT NULL,
  event_key text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT calendar_upcoming_reminder_sent_pkey PRIMARY KEY (user_id, event_date, event_key)
);

-- user_mei_certificates
CREATE TABLE IF NOT EXISTS public.user_mei_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pfx_base64 text,
  passphrase_enc text,
  passphrase_iv text,
  cert_document text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cert_valid_from timestamp with time zone,
  cert_valid_to timestamp with time zone,
  razao_social text,
  nome_fantasia text,
  fiscal_email text,
  regime_tributario text,
  inscricao_municipal text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  ibge_municipio text,
  cidade text,
  uf text,
  optante_simples_nacional boolean DEFAULT true,
  tipo_logradouro text,
  documentos_ativos jsonb,
  rps_lote integer DEFAULT 1,
  rps_numero integer DEFAULT 1,
  rps_serie text DEFAULT '1'::text,
  plugnotas_cert_id text,
  CONSTRAINT user_mei_certificates_pkey PRIMARY KEY (id),
  CONSTRAINT user_mei_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- mei_nfse
CREATE TABLE IF NOT EXISTS public.mei_nfse (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plugnotas_id text,
  protocol text,
  id_integracao text,
  status text,
  cnpj_prestador text,
  cnpj_tomador text,
  payload_json jsonb,
  response_json jsonb,
  pdf_url text,
  xml_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'::text CHECK (document_type = ANY (ARRAY['NFSE'::text, 'NFE'::text, 'NFCE'::text, 'CTE'::text])),
  provider text NOT NULL DEFAULT 'plugnotas'::text,
  archived_at timestamp with time zone,
  metadata_json jsonb,
  CONSTRAINT mei_nfse_pkey PRIMARY KEY (id),
  CONSTRAINT mei_nfse_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- mei_nfse_clientes
CREATE TABLE IF NOT EXISTS public.mei_nfse_clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  documento text CHECK (documento IS NULL OR (char_length(documento) = ANY (ARRAY[11, 14]))),
  nome text,
  email text,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'::text CHECK (document_type = ANY (ARRAY['NFSE'::text, 'NFE'::text, 'NFCE'::text, 'CTE'::text])),
  metadata_json jsonb,
  CONSTRAINT mei_nfse_clientes_pkey PRIMARY KEY (id),
  CONSTRAINT mei_nfse_clientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- mei_nfse_produtos
CREATE TABLE IF NOT EXISTS public.mei_nfse_produtos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  codigo text NOT NULL DEFAULT ''::text,
  cnae text NOT NULL DEFAULT ''::text,
  discriminacao text NOT NULL,
  aliquota numeric,
  valor_sugerido numeric,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'::text CHECK (document_type = ANY (ARRAY['NFSE'::text, 'NFE'::text, 'NFCE'::text, 'CTE'::text])),
  metadata_json jsonb,
  CONSTRAINT mei_nfse_produtos_pkey PRIMARY KEY (id),
  CONSTRAINT mei_nfse_produtos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- mei_nfse_rps_counters
CREATE TABLE IF NOT EXISTS public.mei_nfse_rps_counters (
  cnpj_prestador text NOT NULL,
  serie text NOT NULL DEFAULT '1'::text,
  lote integer NOT NULL DEFAULT 1,
  last_numero integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mei_nfse_rps_counters_pkey PRIMARY KEY (cnpj_prestador)
);

-- codigosservicos
CREATE TABLE IF NOT EXISTS public.codigosservicos (
  codigo character varying NOT NULL,
  descricao text,
  CONSTRAINT codigosservicos_pkey PRIMARY KEY (codigo)
);

-- DAS_mei
CREATE TABLE IF NOT EXISTS public."DAS_mei" (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  "DAS" text NOT NULL,
  periodo_apuracao timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  cnpj text,
  enviado_at timestamp with time zone,
  status_de_envio text DEFAULT 'pendente'::text,
  CONSTRAINT DAS_mei_pkey PRIMARY KEY (id),
  CONSTRAINT DAS_mei_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- das_mensal_status
CREATE TABLE IF NOT EXISTS public.das_mensal_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  competencia text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text),
  documento_fiscal text CHECK (documento_fiscal IS NULL OR documento_fiscal ~ '^[0-9]{14}$'::text),
  status text NOT NULL DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pago'::text, 'pendente'::text, 'erro'::text])),
  pdf_bucket text NOT NULL DEFAULT 'mei-das-pdfs'::text,
  pdf_path text NOT NULL,
  source text NOT NULL DEFAULT 'automatico'::text,
  error_message text,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT das_mensal_status_pkey PRIMARY KEY (id)
);

-- das_mensal_job_runs
CREATE TABLE IF NOT EXISTS public.das_mensal_job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_key text NOT NULL CHECK (run_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text),
  run_type text NOT NULL DEFAULT 'automatico'::text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT das_mensal_job_runs_pkey PRIMARY KEY (id)
);

-- parcelamento_pdfs
CREATE TABLE IF NOT EXISTS public.parcelamento_pdfs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contribuinte_numero text NOT NULL,
  numero_parcelamento text NOT NULL,
  modalidade text,
  pdf_base64 text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parcelamento_pdfs_pkey PRIMARY KEY (id),
  CONSTRAINT parcelamento_pdfs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_contas_financeiras_user_id ON public.contas_financeiras (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_moeda_global_user_id ON public.contas_moeda_global (user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public."orçamentos" (user_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_id_user_id ON public.google_tokens_id (user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_link_user_number ON public.n8n_link (user_number);

CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_user_id ON public.role_x_user_x_empresa (user_id);
CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_empresas_id ON public.role_x_user_x_empresa (empresas_id);
CREATE INDEX IF NOT EXISTS idx_role_x_user_x_empresa_user_status ON public.role_x_user_x_empresa (user_id, status);
CREATE INDEX IF NOT EXISTS idx_empresa_invites_empresas_id ON public.empresa_invites (empresas_id);

CREATE INDEX IF NOT EXISTS idx_mei_nfse_user_id ON public.mei_nfse (user_id);
CREATE INDEX IF NOT EXISTS idx_mei_nfse_clientes_user_id ON public.mei_nfse_clientes (user_id);
CREATE INDEX IF NOT EXISTS idx_mei_nfse_produtos_user_id ON public.mei_nfse_produtos (user_id);
CREATE INDEX IF NOT EXISTS idx_das_mensal_status_user_competencia
  ON public.das_mensal_status (user_id, competencia);

-- ---------------------------------------------------------------------------
-- Funções + triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_recorrencias_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contas_financeiras_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contas_moeda_global_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_global_categories_to_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.categorias_id (user_id, nome, tipo)
  SELECT NEW.id, nome, tipo
  FROM public.categorias_id
  WHERE user_id IS NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'usuario')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recorrencias_atualizado_em ON public.recorrencias;
CREATE TRIGGER trg_recorrencias_atualizado_em
  BEFORE UPDATE ON public.recorrencias
  FOR EACH ROW EXECUTE FUNCTION public.set_recorrencias_atualizado_em();

DROP TRIGGER IF EXISTS trg_contas_financeiras_atualizado_em ON public.contas_financeiras;
CREATE TRIGGER trg_contas_financeiras_atualizado_em
  BEFORE UPDATE ON public.contas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_contas_financeiras_atualizado_em();

DROP TRIGGER IF EXISTS trg_contas_moeda_global_atualizado_em ON public.contas_moeda_global;
CREATE TRIGGER trg_contas_moeda_global_atualizado_em
  BEFORE UPDATE ON public.contas_moeda_global
  FOR EACH ROW EXECUTE FUNCTION public.set_contas_moeda_global_atualizado_em();

DROP TRIGGER IF EXISTS update_google_tokens_id_updated_at ON public.google_tokens_id;
CREATE TRIGGER update_google_tokens_id_updated_at
  BEFORE UPDATE ON public.google_tokens_id
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_copy_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_copy_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.copy_global_categories_to_new_user();

-- ---------------------------------------------------------------------------
-- Seeds mínimos
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (roles) VALUES ('admin'), ('usuario')
ON CONFLICT (roles) DO NOTHING;

INSERT INTO public.categorias_id (nome, tipo, user_id)
SELECT v.nome, v.tipo, NULL
FROM (
  VALUES
    ('Salário', 'entrada'),
    ('Freelance', 'entrada'),
    ('Investimentos', 'entrada'),
    ('Outros (entrada)', 'entrada'),
    ('Alimentação', 'saida'),
    ('Moradia', 'saida'),
    ('Transporte', 'saida'),
    ('Saúde', 'saida'),
    ('Educação', 'saida'),
    ('Lazer', 'saida'),
    ('Assinaturas', 'saida'),
    ('Compras', 'saida'),
    ('Contas', 'saida'),
    ('Outros (saída)', 'saida')
) AS v(nome, tipo)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categorias_id c
  WHERE c.user_id IS NULL
    AND lower(c.nome) = lower(v.nome)
    AND lower(replace(c.tipo, 'í', 'i')) = lower(replace(v.tipo, 'í', 'i'))
);

COMMIT;
