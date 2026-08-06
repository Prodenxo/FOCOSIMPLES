-- Seed: ST varejo RJ → RJ (carga inicial motor tributário NF-e).
-- Idempotente: ON CONFLICT atualiza has_st/cfop_st.

insert into public.tax_rules_state (ncm, origin_uf, destination_uf, has_st, cfop_st, updated_at)
values
  -- Bebidas
  ('22021000', 'RJ', 'RJ', true, '5405', now()),
  ('22030000', 'RJ', 'RJ', true, '5405', now()),
  ('22011000', 'RJ', 'RJ', true, '5405', now()),
  ('22029000', 'RJ', 'RJ', true, '5405', now()),
  ('22029900', 'RJ', 'RJ', true, '5405', now()),
  ('22029100', 'RJ', 'RJ', true, '5405', now()),
  ('22042200', 'RJ', 'RJ', true, '5405', now()),
  -- Alimentos
  ('19053100', 'RJ', 'RJ', true, '5405', now()),
  ('19059090', 'RJ', 'RJ', true, '5405', now()),
  ('18063210', 'RJ', 'RJ', true, '5405', now()),
  ('18069000', 'RJ', 'RJ', true, '5405', now()),
  ('04011010', 'RJ', 'RJ', true, '5405', now()),
  ('04012010', 'RJ', 'RJ', true, '5405', now()),
  ('04015010', 'RJ', 'RJ', true, '5405', now()),
  ('04061090', 'RJ', 'RJ', true, '5405', now()),
  ('04032000', 'RJ', 'RJ', true, '5405', now()),
  ('21069090', 'RJ', 'RJ', true, '5405', now()),
  -- Higiene e perfumaria
  ('33051000', 'RJ', 'RJ', true, '5405', now()),
  ('34011190', 'RJ', 'RJ', true, '5405', now()),
  ('33061000', 'RJ', 'RJ', true, '5405', now()),
  ('33049990', 'RJ', 'RJ', true, '5405', now()),
  ('33079000', 'RJ', 'RJ', true, '5405', now()),
  ('33030010', 'RJ', 'RJ', true, '5405', now()),
  -- Limpeza
  ('34022000', 'RJ', 'RJ', true, '5405', now()),
  ('34029039', 'RJ', 'RJ', true, '5405', now()),
  ('38089419', 'RJ', 'RJ', true, '5405', now()),
  ('34025000', 'RJ', 'RJ', true, '5405', now()),
  -- Outros varejo
  ('24022000', 'RJ', 'RJ', true, '5405', now()),
  ('85061000', 'RJ', 'RJ', true, '5405', now()),
  ('85066000', 'RJ', 'RJ', true, '5405', now()),
  ('85395200', 'RJ', 'RJ', true, '5405', now()),
  ('85395000', 'RJ', 'RJ', true, '5405', now())
on conflict (ncm, origin_uf, destination_uf) do update set
  has_st = excluded.has_st,
  cfop_st = excluded.cfop_st,
  updated_at = now();
