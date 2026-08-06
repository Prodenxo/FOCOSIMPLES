-- Catálogo nacional NCM (BrasilAPI / Receita Federal) para autocomplete no cadastro de produtos.

CREATE TABLE IF NOT EXISTS public.ncms (
  code varchar(8) PRIMARY KEY,
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ncms_description_lower
  ON public.ncms (lower(description));

CREATE INDEX IF NOT EXISTS idx_ncms_updated_at
  ON public.ncms (updated_at DESC);

COMMENT ON TABLE public.ncms IS 'Referência NCM (8 dígitos) sincronizada via BrasilAPI — uso global, sem user_id.';
