-- Regras de ST interestadual por NCM + UF origem + UF destino (motor tributário NF-e).
create table if not exists public.tax_rules_state (
  id bigserial primary key,
  ncm varchar(8) not null,
  origin_uf char(2) not null,
  destination_uf char(2) not null,
  has_st boolean not null default false,
  cfop_st varchar(4),
  updated_at timestamptz not null default now(),
  constraint tax_rules_state_unique_route unique (ncm, origin_uf, destination_uf)
);

create index if not exists idx_tax_rules_state_lookup
  on public.tax_rules_state (ncm, origin_uf, destination_uf);

comment on table public.tax_rules_state is
  'Incidência de ST interestadual por NCM e par de UFs (origem → destino).';
