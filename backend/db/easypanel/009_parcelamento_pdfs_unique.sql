-- 009_parcelamento_pdfs_unique.sql
-- Garante 1 PDF cacheado por usuário + número do pedido (AUTH local / upsert).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS parcelamento_pdfs_user_numero_uidx
  ON public.parcelamento_pdfs (user_id, numero_parcelamento);

COMMIT;
