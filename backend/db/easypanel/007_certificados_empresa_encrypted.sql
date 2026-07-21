-- 007_certificados_empresa_encrypted.sql
-- Extende user_mei_certificates para vínculo por empresa, metadados e PFX cifrado (AES-256-GCM).
-- Modelo Integra Contador (DAS Simples): contratante = plataforma; autor = contribuinte = CNPJ da empresa;
-- termo Autentica Procurador assinado com o A1 da própria empresa (ICGERENCIADOR-019).

ALTER TABLE public.user_mei_certificates
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id),
  ADD COLUMN IF NOT EXISTS razao_social_titular text,
  ADD COLUMN IF NOT EXISTS numero_serie text,
  ADD COLUMN IF NOT EXISTS emissor text,
  ADD COLUMN IF NOT EXISTS thumbprint text,
  ADD COLUMN IF NOT EXISTS pfx_enc text,
  ADD COLUMN IF NOT EXISTS pfx_iv text,
  ADD COLUMN IF NOT EXISTS pfx_auth_tag text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'VALIDO'
    CHECK (status = ANY (ARRAY['VALIDO', 'EXPIRADO', 'REVOGADO', 'SUBSTITUIDO', 'REMOVIDO'])),
  ADD COLUMN IF NOT EXISTS ultima_utilizacao_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS user_mei_certificates_empresa_id_ativo_uidx
  ON public.user_mei_certificates (empresa_id)
  WHERE empresa_id IS NOT NULL AND status = 'VALIDO';

CREATE INDEX IF NOT EXISTS user_mei_certificates_thumbprint_idx
  ON public.user_mei_certificates (thumbprint)
  WHERE thumbprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fiscal_certificate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas (id),
  user_id uuid REFERENCES public.users (id),
  acao text NOT NULL,
  cnpj text,
  detalhe_nao_sensivel text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fiscal_certificate_audit_empresa_created_idx
  ON public.fiscal_certificate_audit (empresa_id, created_at DESC);

COMMENT ON COLUMN public.user_mei_certificates.pfx_enc IS
  'PKCS#12 reempacotado, cifrado AES-256-GCM (sem PFX em claro). Preferir a pfx_base64 legado.';
COMMENT ON COLUMN public.user_mei_certificates.pfx_base64 IS
  'LEGADO: PFX em base64 sem cifrar. Novos uploads devem usar pfx_enc/pfx_iv/pfx_auth_tag.';
