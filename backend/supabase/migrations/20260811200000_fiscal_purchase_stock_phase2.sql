-- Fiscal Engine v3.1 — Fase 2: compras XML + estoque/lote fiscal

create table if not exists public.fiscal_purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  chave_nfe char(44) not null,
  inf_nfe_id varchar(64),
  modelo smallint,
  serie varchar(10),
  numero varchar(20),
  dh_emi timestamptz,
  emitente_cnpj char(14),
  destinatario_doc char(14),
  document_status varchar(16) not null default 'UNKNOWN',
  protocolo_numero varchar(20),
  protocolo_chave char(44),
  protocolo_cstat varchar(10),
  xml_sha256 char(64) not null,
  parser_version varchar(32) not null,
  parse_status varchar(32) not null default 'PARSED',
  parse_warnings jsonb not null default '[]'::jsonb,
  header_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_purchase_invoices_empresa_chave_unique unique (empresa_id, chave_nfe),
  constraint fiscal_purchase_invoices_document_status_check check (
    document_status in ('AUTHORIZED', 'CANCELED', 'DENIED', 'UNKNOWN')
  )
);

create index if not exists idx_fiscal_purchase_invoices_empresa
  on public.fiscal_purchase_invoices (empresa_id, created_at desc);

create table if not exists public.fiscal_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.fiscal_purchase_invoices(id) on delete cascade,
  numero_item integer not null,
  c_prod varchar(60),
  c_ean varchar(14),
  x_prod text,
  ncm char(8),
  supplier_cest varchar(7),
  cfop_entrada char(4),
  origem varchar(8) not null default 'UNKNOWN',
  u_com varchar(10),
  q_com numeric(21, 10),
  v_un_com numeric(21, 10),
  v_prod numeric(21, 10),
  c_ean_trib varchar(14),
  u_trib varchar(10),
  q_trib numeric(21, 10),
  v_un_trib numeric(21, 10),
  ind_tot smallint,
  desconto numeric(21, 10),
  frete numeric(21, 10),
  seguro numeric(21, 10),
  outras_despesas numeric(21, 10),
  parsed_tax_json jsonb not null default '{}'::jsonb,
  prior_st_status varchar(20) not null default 'UNKNOWN',
  prior_st_evidence_json jsonb not null default '{}'::jsonb,
  catalog_match_status varchar(24) not null default 'UNMATCHED',
  produto_catalogo_id uuid,
  unit_conversion_json jsonb not null default '{}'::jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint fiscal_purchase_items_prior_st_status_check check (
    prior_st_status in ('RETAINED', 'NO_ST_EVIDENCE', 'UNKNOWN')
  ),
  constraint fiscal_purchase_items_catalog_match_check check (
    catalog_match_status in ('UNMATCHED', 'AUTO_SUGGESTED', 'MANUALLY_CONFIRMED')
  ),
  constraint fiscal_purchase_items_invoice_item_unique unique (purchase_invoice_id, numero_item)
);

create index if not exists idx_fiscal_purchase_items_invoice
  on public.fiscal_purchase_items (purchase_invoice_id);

create table if not exists public.fiscal_stock_lots (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  produto_catalogo_id uuid,
  purchase_item_id uuid not null references public.fiscal_purchase_items(id) on delete restrict,
  origem_mercadoria varchar(8) not null default 'UNKNOWN',
  base_unit varchar(10) not null,
  quantidade_inicial numeric(21, 10) not null,
  quantidade_disponivel numeric(21, 10) not null,
  prior_st_status varchar(20) not null,
  prior_st_evidence_json jsonb not null default '{}'::jsonb,
  supplier_cest varchar(7),
  st_retained_values_json jsonb not null default '{}'::jsonb,
  data_entrada date not null,
  status varchar(24) not null default 'PENDING_CATALOG_MATCH',
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_stock_lots_status_check check (
    status in ('PENDING_CATALOG_MATCH', 'NEEDS_REVIEW', 'USABLE', 'BLOCKED', 'DEPLETED')
  ),
  constraint fiscal_stock_lots_qty_non_negative check (quantidade_disponivel >= 0),
  constraint fiscal_stock_lots_purchase_item_unique unique (purchase_item_id)
);

create index if not exists idx_fiscal_stock_lots_empresa_produto
  on public.fiscal_stock_lots (empresa_id, produto_catalogo_id, data_entrada);

create table if not exists public.fiscal_stock_allocations (
  id uuid primary key default gen_random_uuid(),
  stock_lot_id uuid not null references public.fiscal_stock_lots(id) on delete restrict,
  quantidade numeric(21, 10) not null,
  allocation_method varchar(24),
  st_allocation_json jsonb not null default '{}'::jsonb,
  reference_type varchar(32),
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiscal_stock_allocations_lot
  on public.fiscal_stock_allocations (stock_lot_id);

comment on table public.fiscal_purchase_invoices is
  'NF-e de compra importada manualmente (Fiscal Engine v3.1 Fase 2).';
comment on table public.fiscal_stock_lots is
  'Lote fiscal por item de compra — rastreabilidade ST/origem/CEST.';
