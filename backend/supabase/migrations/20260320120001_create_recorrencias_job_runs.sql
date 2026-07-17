-- Controle de execução diária do job de materialização (lock por dia)
CREATE TABLE IF NOT EXISTS public.recorrencias_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'diario',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recorrencias_job_runs_run_unique UNIQUE (run_key, run_type)
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_job_runs_run_key ON public.recorrencias_job_runs(run_key);

ALTER TABLE public.recorrencias_job_runs ENABLE ROW LEVEL SECURITY;
-- Sem políticas: authenticated/anon não acessam; service_role ignora RLS.
