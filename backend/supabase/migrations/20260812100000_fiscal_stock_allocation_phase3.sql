-- Fiscal Engine v3.1 — Fase 3: alocação/reserva FIFO de estoque fiscal

create table if not exists public.fiscal_stock_allocation_requests (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  allocation_request_id varchar(128) not null,
  commercial_sale_id uuid,
  commercial_sale_item_id uuid,
  produto_catalogo_id uuid not null,
  quantidade_solicitada numeric(21, 10) not null,
  status varchar(16) not null default 'COMPLETED',
  resolution_status varchar(24),
  issues_json jsonb not null default '[]'::jsonb,
  allocation_audit_json jsonb not null default '{}'::jsonb,
  engine_schema_version varchar(16) not null default '3.1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_stock_allocation_requests_status_check check (
    status in ('COMPLETED', 'FAILED')
  ),
  constraint fiscal_stock_allocation_requests_empresa_key_unique unique (empresa_id, allocation_request_id)
);

create index if not exists idx_fiscal_stock_allocation_requests_empresa_produto
  on public.fiscal_stock_allocation_requests (empresa_id, produto_catalogo_id, created_at desc);

alter table public.fiscal_stock_allocations
  add column if not exists empresa_id uuid,
  add column if not exists allocation_request_uuid uuid references public.fiscal_stock_allocation_requests(id) on delete restrict,
  add column if not exists commercial_sale_id uuid,
  add column if not exists commercial_sale_item_id uuid,
  add column if not exists purchase_item_id uuid references public.fiscal_purchase_items(id) on delete restrict,
  add column if not exists purchase_invoice_id uuid references public.fiscal_purchase_invoices(id) on delete restrict,
  add column if not exists produto_catalogo_id uuid,
  add column if not exists status varchar(16) not null default 'RESERVED',
  add column if not exists origem_mercadoria varchar(8),
  add column if not exists prior_st_status varchar(20),
  add column if not exists prior_st_evidence_json jsonb not null default '{}'::jsonb,
  add column if not exists supplier_cest varchar(7),
  add column if not exists stock_unit_resolution_json jsonb not null default '{}'::jsonb,
  add column if not exists base_unit varchar(10),
  add column if not exists allocation_audit_json jsonb not null default '{}'::jsonb,
  add column if not exists engine_schema_version varchar(16) not null default '3.1.0',
  add column if not exists updated_at timestamptz not null default now();

alter table public.fiscal_stock_allocations
  drop constraint if exists fiscal_stock_allocations_status_check;

alter table public.fiscal_stock_allocations
  add constraint fiscal_stock_allocations_status_check check (
    status in ('RESERVED', 'CONSUMED', 'RELEASED')
  );

create index if not exists idx_fiscal_stock_allocations_empresa_request
  on public.fiscal_stock_allocations (empresa_id, allocation_request_uuid);

create index if not exists idx_fiscal_stock_allocations_empresa_lot_status
  on public.fiscal_stock_allocations (empresa_id, stock_lot_id, status);

comment on table public.fiscal_stock_allocation_requests is
  'Pedido idempotente de alocação fiscal (Fase 3) — CommercialSaleItem → FIFO → reserva.';
