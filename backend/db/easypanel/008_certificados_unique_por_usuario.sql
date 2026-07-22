-- Multi-cliente (contador): 1 certificado ativo por usuário, não por empresa.
-- Antes: UNIQUE(empresa_id) WHERE VALIDO — impedia N clientes no mesmo escritório.

DROP INDEX IF EXISTS public.user_mei_certificates_empresa_id_ativo_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS user_mei_certificates_user_id_ativo_uidx
  ON public.user_mei_certificates (user_id)
  WHERE status = 'VALIDO';
