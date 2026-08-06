-- Cache de alíquotas IBPT (De Olho no Imposto) por NCM + UF + EX.
create table if not exists public.ibpt_ncm_cache (
  cache_key text primary key,
  ncm varchar(8) not null,
  uf char(2) not null,
  ex varchar(3) not null default '0',
  nacional numeric(8, 4) not null default 0,
  estadual numeric(8, 4) not null default 0,
  importado numeric(8, 4) not null default 0,
  municipal numeric(8, 4) not null default 0,
  fonte text,
  versao text,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_ibpt_ncm_cache_lookup
  on public.ibpt_ncm_cache (ncm, uf, ex);

comment on table public.ibpt_ncm_cache is
  'Alíquotas IBPT cacheadas por NCM/UF para Lei 12.741/2012 (transparência fiscal NF-e).';
