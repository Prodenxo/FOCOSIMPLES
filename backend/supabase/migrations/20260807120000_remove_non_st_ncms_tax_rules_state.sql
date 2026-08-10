-- Remove NCMs incorretamente marcados com ST (vestuário, eletrônicos — sem ST no RJ).
-- Camisetas (61091000) e similares devem usar CSOSN 102 / CFOP 5102 por padrão.

delete from public.tax_rules_state
where origin_uf = 'RJ'
  and destination_uf = 'RJ'
  and ncm in (
    '61091000',
    '62034200',
    '64039990',
    '61103000',
    '84713012',
    '85171231',
    '84716053'
  );
