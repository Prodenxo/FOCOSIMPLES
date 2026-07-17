-- Referência à recorrência e mês de ocorrência (idempotência na materialização)
ALTER TABLE public.lancamentos_id
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES public.recorrencias(id) ON DELETE SET NULL;

ALTER TABLE public.lancamentos_id
  ADD COLUMN IF NOT EXISTS recorrencia_ano_mes TEXT;

CREATE INDEX lancamentos_id_recorrencia_idx ON public.lancamentos_id(recorrencia_id)
  WHERE recorrencia_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_id_recorrencia_mes_unique
  ON public.lancamentos_id (user_id, recorrencia_id, recorrencia_ano_mes)
  WHERE recorrencia_id IS NOT NULL AND recorrencia_ano_mes IS NOT NULL AND user_id IS NOT NULL;
