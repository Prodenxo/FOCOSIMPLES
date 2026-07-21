-- Foco Simples — schema inicial (Postgres EasyPanel, sem Supabase Auth)
-- Banco vazio. user_id / profiles.id referenciam public.users (não auth.users).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Auth próprio (substitui auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  phone text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  banned_until timestamptz,
  deleted_at timestamptz,
  CONSTRAINT users_email_lower_unique UNIQUE (email)
);

CREATE UNIQUE INDEX users_phone_unique
  ON public.users (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'usuario'
    CHECK (role = ANY (ARRAY['superadmin', 'admin', 'usuario', 'outsider'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_update_id text
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  roles text NOT NULL DEFAULT '' UNIQUE
);

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
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
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['pending', 'active', 'rejected'])),
  requested_by uuid REFERENCES public.users (id)
);

CREATE TABLE public.role_x_user_x_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.users (id),
  roles_id uuid REFERENCES public.roles (id),
  empresas_id uuid REFERENCES public.empresas (id),
  status boolean,
  mei boolean,
  expires_at timestamptz
);

CREATE TABLE public.empresa_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresas_id uuid NOT NULL REFERENCES public.empresas (id),
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  invited_email text,
  is_reusable boolean DEFAULT false,
  uses_count integer DEFAULT 0,
  raw_token text
);

CREATE TABLE public.empresa_mei_subscription_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id),
  mei_slots integer NOT NULL CHECK (mei_slots > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending', 'active', 'cancelled'])),
  value_numeric numeric,
  billing_type text,
  external_reference text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stripe_subscription_id text,
  stripe_checkout_session_id text
);

CREATE TABLE public.n8n_link (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid UNIQUE REFERENCES public.users (id),
  user_number text,
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------
CREATE TABLE public.categorias_id (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada', 'saida', 'saída'])),
  cor text,
  criada_em timestamp without time zone DEFAULT timezone('America/Sao_Paulo', now()),
  user_phone numeric,
  user_id uuid REFERENCES public.users (id)
);

CREATE TABLE public.contas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  nome text NOT NULL,
  tipo text NOT NULL
    CHECK (tipo = ANY (ARRAY['corrente', 'poupanca', 'cartao_credito', 'dinheiro', 'outro'])),
  saldo_inicial numeric NOT NULL DEFAULT 0,
  limite_credito numeric,
  dia_fechamento integer CHECK (dia_fechamento IS NULL OR (dia_fechamento >= 1 AND dia_fechamento <= 31)),
  dia_vencimento integer CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31)),
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  of_provider text,
  of_external_id text,
  of_last_synced_at timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  instituicao_id text
);

CREATE TABLE public.contas_moeda_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  moeda text NOT NULL CHECK (char_length(moeda) = 3),
  nome text,
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  dia_do_mes integer NOT NULL CHECK (dia_do_mes >= 1 AND dia_do_mes <= 31),
  valor numeric NOT NULL,
  classificacao text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada', 'saída', 'saida'])),
  status text NOT NULL DEFAULT 'pago',
  obs text,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  max_ocorrencias integer CHECK (max_ocorrencias IS NULL OR (max_ocorrencias >= 1 AND max_ocorrencias <= 1200)),
  ocorrencias_geradas integer NOT NULL DEFAULT 0 CHECK (ocorrencias_geradas >= 0)
);

CREATE TABLE public.recorrencias_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL CHECK (run_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  run_type text NOT NULL DEFAULT 'diario',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recorrencia_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  recorrencia_id uuid NOT NULL REFERENCES public.recorrencias (id),
  ano_mes text NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  motivo text NOT NULL DEFAULT 'manual_delete',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lancamentos_id (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada', 'saida', 'saída'])),
  valor numeric NOT NULL,
  classificacao text NOT NULL,
  criado_em timestamp without time zone DEFAULT timezone('America/Sao_Paulo', now()),
  user_phone numeric,
  categoria text,
  data date,
  status text NOT NULL DEFAULT 'realizado',
  obs text,
  user_id uuid REFERENCES public.users (id),
  recorrencia_id uuid REFERENCES public.recorrencias (id),
  recorrencia_ano_mes text,
  conta_id uuid REFERENCES public.contas_financeiras (id)
);

CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  categorias_id bigint NOT NULL REFERENCES public.categorias_id (id),
  valor_orcado numeric,
  date date
);

-- ---------------------------------------------------------------------------
-- Google / agenda
-- ---------------------------------------------------------------------------
CREATE TABLE public.google_tokens_id (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  refresh_token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id)
);

CREATE TABLE public.google_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  state text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE public.calendar_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  event_date date NOT NULL,
  event_id text,
  event_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.calendar_upcoming_reminder_sent (
  user_id uuid NOT NULL REFERENCES public.users (id),
  event_date date NOT NULL,
  event_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_date, event_key)
);

-- ---------------------------------------------------------------------------
-- MEI / fiscal
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_mei_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id),
  pfx_base64 text,
  passphrase_enc text,
  passphrase_iv text,
  cert_document text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cert_valid_from timestamptz,
  cert_valid_to timestamptz,
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
  rps_serie text DEFAULT '1',
  plugnotas_cert_id text
);

CREATE TABLE public.mei_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'
    CHECK (document_type = ANY (ARRAY['NFSE', 'NFE', 'NFCE', 'CTE'])),
  provider text NOT NULL DEFAULT 'plugnotas',
  archived_at timestamptz,
  metadata_json jsonb
);

CREATE TABLE public.mei_nfse_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  dedupe_key text NOT NULL,
  documento text CHECK (documento IS NULL OR char_length(documento) IN (11, 14)),
  nome text,
  email text,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'
    CHECK (document_type = ANY (ARRAY['NFSE', 'NFE', 'NFCE', 'CTE'])),
  metadata_json jsonb
);

CREATE TABLE public.mei_nfse_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  dedupe_key text NOT NULL,
  codigo text NOT NULL DEFAULT '',
  cnae text NOT NULL DEFAULT '',
  discriminacao text NOT NULL,
  aliquota numeric,
  valor_sugerido numeric,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'NFSE'
    CHECK (document_type = ANY (ARRAY['NFSE', 'NFE', 'NFCE', 'CTE'])),
  metadata_json jsonb
);

CREATE TABLE public.mei_nfse_rps_counters (
  cnpj_prestador text PRIMARY KEY,
  serie text NOT NULL DEFAULT '1',
  lote integer NOT NULL DEFAULT 1,
  last_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.codigosservicos (
  codigo varchar PRIMARY KEY,
  descricao text
);

CREATE TABLE public.das_mei (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  das text NOT NULL,
  periodo_apuracao timestamptz,
  cnpj text,
  enviado_at timestamptz,
  status_de_envio text DEFAULT 'pendente'
);

CREATE TABLE public.das_mensal_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id),
  competencia text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  documento_fiscal text CHECK (documento_fiscal IS NULL OR documento_fiscal ~ '^[0-9]{14}$'),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status = ANY (ARRAY['pago', 'pendente', 'erro'])),
  pdf_bucket text NOT NULL DEFAULT 'mei-das-pdfs',
  pdf_path text NOT NULL,
  source text NOT NULL DEFAULT 'automatico',
  error_message text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.das_mensal_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL CHECK (run_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  run_type text NOT NULL DEFAULT 'automatico',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.parcelamento_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  contribuinte_numero text NOT NULL,
  numero_parcelamento text NOT NULL,
  modalidade text,
  pdf_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Roles seed mínimo
INSERT INTO public.roles (roles) VALUES ('admin'), ('usuario')
ON CONFLICT (roles) DO NOTHING;

COMMIT;
