-- Matriz ST: CEST padrão e CFOPs explícitos por rota
alter table public.tax_rules_state add column if not exists cest_default varchar(7);
alter table public.tax_rules_state add column if not exists cfop_interno varchar(4);
alter table public.tax_rules_state add column if not exists cfop_interestadual_pf varchar(4);

comment on column public.tax_rules_state.cest_default is
  'CEST sugerido quando o NCM possui ST (matriz fiscal).';
comment on column public.tax_rules_state.cfop_interno is
  'CFOP venda estadual com ST (padrão 5405).';
comment on column public.tax_rules_state.cfop_interestadual_pf is
  'CFOP venda interestadual PF/não contribuinte com ST (padrão 6108).';

-- Bebidas com ST — CEST genérico quando não informado no produto
update public.tax_rules_state
set cest_default = '0300100',
    cfop_interno = coalesce(cfop_interno, '5405'),
    cfop_interestadual_pf = coalesce(cfop_interestadual_pf, '6108'),
    updated_at = now()
where has_st = true
  and ncm like '2202%'
  and cest_default is null;

update public.tax_rules_state
set cest_default = '0300300',
    cfop_interno = coalesce(cfop_interno, '5405'),
    cfop_interestadual_pf = coalesce(cfop_interestadual_pf, '6108'),
    updated_at = now()
where has_st = true
  and ncm like '2203%'
  and cest_default is null;
