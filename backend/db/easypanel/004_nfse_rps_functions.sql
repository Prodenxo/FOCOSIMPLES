-- Contadores RPS atômicos + índices de dedupe do catálogo NFSe (EasyPanel / AUTH local)

CREATE OR REPLACE FUNCTION public.mei_nfse_reserve_rps(p_cnpj text, p_floor integer DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_floor integer := GREATEST(COALESCE(p_floor, 0), 0);
BEGIN
  INSERT INTO public.mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_floor)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = GREATEST(public.mei_nfse_rps_counters.last_numero, v_floor),
        updated_at = now();

  UPDATE public.mei_nfse_rps_counters
  SET last_numero = public.mei_nfse_rps_counters.last_numero + 1,
      updated_at = now()
  WHERE cnpj_prestador = p_cnpj
  RETURNING last_numero INTO v_next;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.mei_nfse_sync_rps_floor(p_cnpj text, p_floor integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_floor integer := GREATEST(COALESCE(p_floor, 0), 0);
BEGIN
  INSERT INTO public.mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_floor)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = GREATEST(public.mei_nfse_rps_counters.last_numero, v_floor),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.mei_nfse_set_rps_last(p_cnpj text, p_last integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_last integer := GREATEST(COALESCE(p_last, 0), 0);
BEGIN
  INSERT INTO public.mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_last)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = v_last,
        updated_at = now();
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS mei_nfse_clientes_user_type_dedupe_uidx
  ON public.mei_nfse_clientes (user_id, document_type, dedupe_key);

CREATE UNIQUE INDEX IF NOT EXISTS mei_nfse_produtos_user_type_dedupe_uidx
  ON public.mei_nfse_produtos (user_id, document_type, dedupe_key);
