-- Fiscal Engine v3.1 — shadow stock ledger virtual (Fase 7A final)
-- Observabilidade only — NÃO altera fiscal_stock_lots real

create table if not exists public.fiscal_shadow_stock_allocations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  shadow_emission_identity text not null,
  comparison_id text,
  mei_nota_record_id uuid,
  commercial_sale_item_id text,
  item_index integer not null default 0,
  fifo_order integer not null default 0,
  stock_lot_id uuid not null,
  quantity numeric(20, 10) not null,
  origem_mercadoria varchar(1),
  prior_st_status varchar(32),
  status varchar(16) not null default 'CONFIRMED',
  created_at timestamptz not null default now(),
  constraint fiscal_shadow_stock_allocations_emission_lot_unique
    unique (empresa_id, shadow_emission_identity, stock_lot_id, item_index, fifo_order),
  constraint fiscal_shadow_stock_allocations_status_check
    check (status in ('PLANNED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'VOIDED'))
);

create index if not exists idx_fiscal_shadow_stock_allocations_lot
  on public.fiscal_shadow_stock_allocations (empresa_id, stock_lot_id, status);

create index if not exists idx_fiscal_shadow_stock_allocations_emission
  on public.fiscal_shadow_stock_allocations (empresa_id, shadow_emission_identity);

comment on table public.fiscal_shadow_stock_allocations is
  'Ledger virtual shadow — simula consumo fiscal observado após emissão legada bem-sucedida.';

comment on column public.fiscal_shadow_stock_allocations.status is
  'CONFIRMED após emissão OK; VOIDED reservado para cancelamento fiscal futuro (não implementado na Fase 7A).';
