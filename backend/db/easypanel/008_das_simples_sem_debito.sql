-- 008_das_simples_sem_debito.sql
-- Permite status sem_debito (Receita MSG_E0139 — sem valor devido).

BEGIN;

ALTER TABLE public.das_simples
  DROP CONSTRAINT IF EXISTS das_simples_status_check;

ALTER TABLE public.das_simples
  ADD CONSTRAINT das_simples_status_check
  CHECK (status = ANY (ARRAY[
    'pago',
    'pendente',
    'erro',
    'gerado',
    'sem_declaracao',
    'sem_debito'
  ]));

COMMIT;
