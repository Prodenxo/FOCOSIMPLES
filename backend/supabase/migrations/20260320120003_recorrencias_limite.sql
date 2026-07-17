-- Adiciona limite opcional de ocorrências para recorrências
-- max_ocorrencias: quantas vezes a recorrência deve materializar lançamentos (NULL = indefinido)
-- ocorrencias_geradas: contador automático de quantas já foram criadas pelo job de materialização

ALTER TABLE public.recorrencias
  ADD COLUMN IF NOT EXISTS max_ocorrencias INT NULL
    CHECK (max_ocorrencias IS NULL OR max_ocorrencias BETWEEN 1 AND 1200);

ALTER TABLE public.recorrencias
  ADD COLUMN IF NOT EXISTS ocorrencias_geradas INT NOT NULL DEFAULT 0
    CHECK (ocorrencias_geradas >= 0);

-- Índice parcial: ajuda o robô a localizar rapidamente recorrências com limite definido
CREATE INDEX IF NOT EXISTS idx_recorrencias_limite
  ON public.recorrencias (user_id, ativo)
  WHERE max_ocorrencias IS NOT NULL;
