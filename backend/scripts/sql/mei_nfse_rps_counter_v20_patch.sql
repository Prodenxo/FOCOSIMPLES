-- v20: permite realinhar contador para BAIXO (contador Postgres não pode ficar à frente da PlugNotas).
-- Rodar no Supabase SQL Editor após mei_nfse_rps_counter_complete.sql

CREATE OR REPLACE FUNCTION mei_nfse_set_rps_last(p_cnpj text, p_last integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last integer := GREATEST(COALESCE(p_last, 0), 0);
BEGIN
  INSERT INTO mei_nfse_rps_counters (cnpj_prestador, last_numero)
  VALUES (p_cnpj, v_last)
  ON CONFLICT (cnpj_prestador) DO UPDATE
    SET last_numero = v_last,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION mei_nfse_set_rps_last(text, integer) TO service_role;
