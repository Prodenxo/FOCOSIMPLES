-- Patch v17: função para alinhar contador após E0014 (rodar no Supabase se já executou mei_nfse_rps_counter.sql).

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

-- Não é necessário INSERT/SELECT manual por cliente.
-- A tabela mei_nfse_rps_counters tem uma linha por CNPJ prestador (PRIMARY KEY).
-- O backend chama mei_nfse_reserve_rps / mei_nfse_sync_rps_floor com o CNPJ de cada emissão.
--
-- Bootstrap manual (opcional, só se um CNPJ ficou desalinhado após migração):
-- SELECT mei_nfse_sync_rps_floor('00000000000000', 123);  -- substitua CNPJ e maior DPS conhecido
