-- Contador atômico de DPS/RPS por CNPJ prestador (evita E0014 com múltiplas instâncias do backend).
-- Executar uma vez no Supabase SQL Editor (produção).

CREATE TABLE IF NOT EXISTS mei_nfse_rps_counters (
  cnpj_prestador text PRIMARY KEY,
  serie text NOT NULL DEFAULT '1',
  lote integer NOT NULL DEFAULT 1,
  last_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION mei_nfse_reserve_rps(p_cnpj text, p_floor integer DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
  v_floor integer := GREATEST(COALESCE(p_floor, 0), 0);
BEGIN
  INSERT INTO mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_floor)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = GREATEST(mei_nfse_rps_counters.last_numero, v_floor),
        updated_at = now();

  UPDATE mei_nfse_rps_counters
  SET last_numero = mei_nfse_rps_counters.last_numero + 1,
      updated_at = now()
  WHERE cnpj_prestador = p_cnpj
  RETURNING last_numero INTO v_next;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION mei_nfse_reserve_rps(text, integer) TO service_role;

-- Alinha o contador ao maior DPS já usado, sem incrementar (pós-E0014 / bootstrap).
CREATE OR REPLACE FUNCTION mei_nfse_sync_rps_floor(p_cnpj text, p_floor integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor integer := GREATEST(COALESCE(p_floor, 0), 0);
BEGIN
  INSERT INTO mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_floor)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = GREATEST(mei_nfse_rps_counters.last_numero, v_floor),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION mei_nfse_sync_rps_floor(text, integer) TO service_role;
