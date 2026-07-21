-- DAS Simples Nacional (PGDAS-D) — persistência local de PDF/status
BEGIN;

CREATE TABLE IF NOT EXISTS public.das_simples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  cnpj text NOT NULL,
  periodo_apuracao text NOT NULL CHECK (periodo_apuracao ~ '^[0-9]{6}$'),
  competencia text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status = ANY (ARRAY['pago', 'pendente', 'erro', 'gerado', 'sem_declaracao'])),
  pdf_base64 text,
  numero_documento text,
  valor_total numeric,
  detalhamento_json jsonb,
  error_message text,
  source text NOT NULL DEFAULT 'pgdasd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, periodo_apuracao)
);

CREATE INDEX IF NOT EXISTS idx_das_simples_user_periodo
  ON public.das_simples (user_id, periodo_apuracao DESC);

COMMIT;
